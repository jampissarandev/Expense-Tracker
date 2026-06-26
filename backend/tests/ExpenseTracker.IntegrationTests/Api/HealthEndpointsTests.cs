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
