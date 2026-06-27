using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "HealthEndpoints")]
public class HealthEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public HealthEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");

            builder.ConfigureServices(services =>
            {
                // Replace DbContext with InMemory for test isolation
                var descriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in descriptors)
                    services.Remove(d);

                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                    new ExpenseTrackerDbContext(
                        new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                            .UseInMemoryDatabase($"HealthTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });

        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Health_endpoint_returns_200_with_status()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/json");

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        body.TryGetProperty("status", out var status).Should().BeTrue();
        status.GetString().Should().Be("Healthy");

        body.TryGetProperty("database", out var db).Should().BeTrue();
        db.GetString().Should().Be("Healthy");

        body.TryGetProperty("timestamp", out var timestamp).Should().BeTrue();
        timestamp.GetDateTime().Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(30));
    }

    [Fact]
    public async Task Health_endpoint_does_not_require_auth()
    {
        // Act - no auth headers set
        var response = await _client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

// ── A3 / R3: Production health gating ──────────────────────────────────────
// In Production, /health must return only { "status": "Healthy" } (200) or
// { "status": "Unhealthy" } (503). The `database` and `timestamp` fields are
// omitted so that scanners cannot fingerprint the backing store.

[Trait("Category", "HealthEndpoints")]
public class HealthEndpointProductionGatingTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// Build a WebApplicationFactory configured for the given environment
    /// with an InMemory database so startup succeed.
    /// </summary>
    private static WebApplicationFactory<Program> CreateFactory(string environment)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", environment);

            // Supply a valid JWT secret so the fail-fast guard in Program.cs passes
            // in non-Development environments.
            builder.UseSetting("Jwt:SecretKey",
                "TestSecretKey_ThisIsAtLeast32Characters!");

            builder.ConfigureServices(services =>
            {
                // Replace DbContext with InMemory for test isolation
                var descriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in descriptors)
                    services.Remove(d);

                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                    new ExpenseTrackerDbContext(
                        new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                            .UseInMemoryDatabase($"HealthGatingTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });
    }

    [Fact]
    public async Task Production_health_returns_only_status_field()
    {
        // Arrange
        using var factory = CreateFactory("Production");
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert — status code preserved
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body, JsonOptions);

        // Must contain "status"
        json.TryGetProperty("status", out var status).Should().BeTrue();
        status.GetString().Should().Be("Healthy");

        // Must NOT contain "database" or "timestamp"
        json.TryGetProperty("database", out _).Should().BeFalse(
            "database field must be omitted in Production to avoid leaking store details");
        json.TryGetProperty("timestamp", out _).Should().BeFalse(
            "timestamp field must be omitted in Production to keep response minimal");
    }

    [Fact]
    public async Task Production_health_response_body_is_at_most_30_bytes()
    {
        // Arrange
        using var factory = CreateFactory("Production");
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        var body = await response.Content.ReadAsStringAsync();
        // {"status":"Healthy"} = 22 bytes; allow some headroom but cap at 30
        body.Length.Should().BeLessThanOrEqualTo(30,
            "Production health response must be compact to avoid information leakage");
    }

    [Fact]
    public async Task Development_health_returns_full_payload()
    {
        // Arrange — Development should still include database and timestamp
        using var factory = CreateFactory("Development");
        using var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        body.TryGetProperty("status", out var status).Should().BeTrue();
        status.GetString().Should().Be("Healthy");

        body.TryGetProperty("database", out var db).Should().BeTrue(
            "database field must be present in Development for debugging");
        db.GetString().Should().Be("Healthy");

        body.TryGetProperty("timestamp", out var timestamp).Should().BeTrue(
            "timestamp field must be present in Development for debugging");
        timestamp.GetDateTime().Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(30));
    }
}
