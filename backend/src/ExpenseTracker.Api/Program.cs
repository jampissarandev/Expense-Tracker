using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http.Features;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth;
using ExpenseTracker.Application.Categories;
using ExpenseTracker.Application.Transactions;
using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Application.Exports;
using ExpenseTracker.Infrastructure.Configuration;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Services;
using ExpenseTracker.Api.Middleware;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// A5 / R6: Limit request body size to 64 KB (generous headroom for a transaction
// with a long note). Kestrel's default is 30 MB — 600,000× larger than needed.
// This is the global ceiling; individual endpoints also declare [RequestSizeLimit]
// as defense-in-depth.
builder.WebHost.ConfigureKestrel(opts =>
{
    opts.Limits.MaxRequestBodySize = 64_000;
});

// A5 / R6: Match multipart body limit to Kestrel's. The app has no multipart
// endpoints today, but cheap defense-in-depth in case a future upload route
// forgets to declare its own limit.
builder.Services.Configure<FormOptions>(opts =>
{
    opts.MultipartBodyLengthLimit = 64_000;
});

// Serilog structured logging
builder.Host.UseSerilog((context, services, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

// Add services to the container.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// Auth services
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
builder.Services.AddScoped<ISecurityEventLogger, SecurityEventLogger>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Category services
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<ICategoryService, CategoryService>();

// Transaction services
builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
builder.Services.AddScoped<ITransactionService, TransactionService>();

// Dashboard services
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IDashboardService, DashboardService>();

// Export services
builder.Services.AddScoped<IExportService, ExportService>();

// FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateCategoryRequestValidator>();

// JWT settings
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
builder.Services.Configure<RefreshTokenSettings>(builder.Configuration.GetSection(RefreshTokenSettings.SectionName));
builder.Services.Configure<SecurityEventSettings>(builder.Configuration.GetSection(SecurityEventSettings.SectionName));

// JWT Bearer Authentication
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;

// Fail-fast: refuse to start in non-Development environments with a weak or missing secret (R-3).
if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
        throw new InvalidOperationException(
            "Jwt:SecretKey must be at least 32 characters in non-Development environments. " +
            "Set it via environment variable (Jwt__SecretKey), " +
            "via `dotnet user-secrets set Jwt:SecretKey <value> --project backend/src/ExpenseTracker.Api`, " +
            "or via a secrets manager.");
}
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = true; // Map 'sub' → ClaimTypes.NameIdentifier
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
        ClockSkew = TimeSpan.Zero // No tolerance for expired tokens
    };
});
// CORS — allow frontend dev server (and Lighthouse preview port 4173) with credentials
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173", // Vite dev server
                "http://localhost:4173"  // Vite preview / sirv (used by Lighthouse CI)
            )
              .AllowCredentials()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Rate limiting — disabled in E2E test environments (set E2E_TESTS=true) so
// Playwright suites that register many users in quick succession are not blocked.
if (!string.Equals(builder.Configuration["E2E_TESTS"], "true", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddRateLimiter(options =>
    {
        // B1 / R7 — partition per authenticated user (JWT 'sub' claim), with
        // IP fallback for any future anonymous traffic on GlobalRateLimit.
        // Per-user (not per-IP) so an attacker cannot bypass by rotating IPs,
        // matching the R11 threat model. See docs/plans/security-hardening.md
        // §B1 "C-option deviation" for the full rationale.
        options.AddPolicy("GlobalRateLimit", context =>
        {
            var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var partitionKey = !string.IsNullOrEmpty(userId)
                ? $"user:{userId}"
                : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

            return RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey,
                _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 200,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 4,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                });
        });

        options.AddFixedWindowLimiter("AuthRateLimit", config =>
        {
            config.PermitLimit = 5;
            config.Window = TimeSpan.FromMinutes(1);
            config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            config.QueueLimit = 0;
        });

        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    });
}

// Health checks — EF Core DbContext ping
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ExpenseTrackerDbContext>("database");
builder.Services.AddDbContext<ExpenseTrackerDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// C1 / R17 — Request-ID propagation. Must run BEFORE the global exception
// handler and Serilog request logging so:
//   1. Errors caught by GlobalExceptionMiddleware can include the RequestId
//      in the problem+json response (the `traceId` extension field).
//   2. Every Serilog request-log entry is enriched with { RequestId = "…" }
//      via the LogContext (FromLogContext enricher is already enabled in
//      appsettings.json).
app.UseMiddleware<RequestIdMiddleware>();

// Global exception handler (must be first)
app.UseMiddleware<GlobalExceptionMiddleware>();

// HTTPS redirection (A2 / R2) — outside Development only.
// HSTS is NOT emitted by UseHsts() here because that helper requires the
// incoming request itself to be HTTPS, which fails behind a reverse proxy.
// Instead, we add a small inline middleware that emits the header directly,
// so it is present regardless of transport. `preload` is included so the
// host is eligible for the HSTS preload list once the operator confirms
// the requirements (https://hstspreload.org/#submission-requirements).
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
    app.Use(async (context, next) =>
    {
        context.Response.Headers["Strict-Transport-Security"] =
            "max-age=31536000; includeSubDomains; preload";
        await next();
    });
}

// Serilog request logging (after exception handler so errors are captured).
// C1 / R17: Enrich the per-request log line with the X-Request-Id
// resolved by RequestIdMiddleware. We use EnrichDiagnosticContext
// (not LogContext) because UseSerilogRequestLogging emits its completion
// log AFTER the response has been sent, by which time the LogContext
// scope from RequestIdMiddleware has been unwound. DiagnosticContext is
// attached to the request log entry itself and survives the unwind.
// The custom message template references the property by name so the
// rendered line includes the RequestId alongside method/path/status.
app.UseSerilogRequestLogging(opts =>
{
    opts.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms RequestId={RequestId}";

    opts.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        if (httpContext.Items.TryGetValue(RequestIdMiddleware.RequestIdItemKey, out var requestIdObj)
            && requestIdObj is string requestId
            && !string.IsNullOrEmpty(requestId))
        {
            diagnosticContext.Set(RequestIdMiddleware.LogPropertyName, requestId);
        }
    };
});

// CORS — must be before auth for preflight requests
app.UseCors("AllowFrontend");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Rate limiting — after UseAuthentication so the per-user partition
// can read the JWT 'sub' claim, but before UseAuthorization so unauth
// requests still hit AuthRateLimit. See B1 / R7 C-option deviation.
// Skipped when E2E_TESTS=true (no rate limiter registered in that case).
if (!string.Equals(builder.Configuration["E2E_TESTS"], "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseAuthentication();
    app.UseRateLimiter();
}
else
{
    app.UseAuthentication();
}

app.UseAuthorization();

app.MapControllers();

// Health check endpoint (no auth)
// A3 / R3: In Production, return only { "status": "…" } (≤ 30 bytes) so
// scanners cannot fingerprint the backing store.  Development keeps the
// full payload (database status + timestamp) for debugging.
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";

        if (app.Environment.IsDevelopment())
        {
            // Development: rich payload for debugging
            var databaseEntry = report.Entries.TryGetValue("database", out var dbEntry)
                ? dbEntry.Status.ToString()
                : "Unknown";
            var result = JsonSerializer.Serialize(new
            {
                status = report.Status.ToString(),
                database = databaseEntry,
                timestamp = DateTime.UtcNow
            });
            await context.Response.WriteAsync(result);
        }
        else
        {
            // Production / Staging: minimal payload — status only
            if (report.Status != HealthStatus.Healthy)
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;

            var result = JsonSerializer.Serialize(new
            {
                status = report.Status.ToString()
            });
            await context.Response.WriteAsync(result);
        }
    }
});

app.Run();
