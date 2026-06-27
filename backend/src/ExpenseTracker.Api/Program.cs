using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
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

// JWT Bearer Authentication
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;

// Fail-fast: refuse to start in non-Development environments with a weak or missing secret (R-3).
if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
        throw new InvalidOperationException(
            "Jwt:SecretKey must be at least 32 characters in non-Development environments. " +
            "Set it via environment variable (Jwt__SecretKey), user-secrets, or a secrets manager.");
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

// Rate limiting — strict limit on auth endpoints
// Disabled in E2E test environments (set E2E_TESTS=true) so Playwright
// suites that register many users in quick succession are not blocked.
if (!string.Equals(builder.Configuration["E2E_TESTS"], "true", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddRateLimiter(options =>
    {
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

// Global exception handler (must be first)
app.UseMiddleware<GlobalExceptionMiddleware>();

// Serilog request logging (after exception handler so errors are captured)
app.UseSerilogRequestLogging();

// CORS — must be before auth for preflight requests
app.UseCors("AllowFrontend");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Rate limiting — before auth to block excessive requests early
// Skipped when E2E_TESTS=true (no rate limiter registered in that case).
if (!string.Equals(builder.Configuration["E2E_TESTS"], "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseRateLimiter();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health check endpoint (no auth)
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
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
});

app.Run();
