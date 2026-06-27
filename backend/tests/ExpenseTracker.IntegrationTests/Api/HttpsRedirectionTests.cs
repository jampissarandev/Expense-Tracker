using System.Net;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

/// <summary>
/// Verifies HTTPS enforcement and HSTS header behavior (A2 / R2).
/// In Production: HSTS header present on every response.
/// In Development: no HSTS header, no HTTPS redirect (current behavior preserved).
/// HTTPS redirect (301/302) is verified manually via curl against a real
/// Kestrel server because WebApplicationFactory uses an in-memory transport
/// that does not distinguish HTTP from HTTPS.
/// </summary>
[Trait("Category", "HttpsRedirection")]
public class HttpsRedirectionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HttpsRedirectionTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");
            builder.UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey);

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
                            .UseInMemoryDatabase($"HttpsTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });
    }

    private static WebApplicationFactory<Program> CreateProductionFactory()
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("Environment", "Production");
                builder.UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey);
                builder.UseSetting("Jwt:Issuer", "Test");
                builder.UseSetting("Jwt:Audience", "Test");
                builder.UseSetting("ConnectionStrings:DefaultConnection", "Host=localhost;Database=unused");

                builder.ConfigureServices(services =>
                {
                    // Replace DbContext with InMemory
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
                                .UseInMemoryDatabase($"HttpsProdTest_{dbGuid}")
                                .Options,
                            sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
                });
            });
    }

    // --- HSTS header tests ---

    [Fact]
    public async Task Development_health_response_does_not_contain_hsts_header()
    {
        // Act
        var response = await _factory.CreateClient().GetAsync("/health");

        // Assert — HSTS header must be absent in Development
        response.Headers.Contains("Strict-Transport-Security").Should().BeFalse();
    }

    [Fact]
    public async Task Production_health_response_contains_hsts_header()
    {
        // Arrange
        var client = CreateProductionFactory().CreateClient();

        // Act
        var response = await client.GetAsync("/health");

        // Assert — HSTS header must be present in Production with the values
        // required by hstspreload.org submission requirements.
        response.Headers.TryGetValues("Strict-Transport-Security", out var values).Should().BeTrue();
        var hstsValue = values!.Single();
        hstsValue.Should().Contain("max-age=31536000");
        hstsValue.Should().Contain("includeSubDomains");
        hstsValue.Should().Contain("preload");
    }

    [Fact]
    public async Task Production_api_response_contains_hsts_header()
    {
        // Arrange — HSTS must be on every response, not just /health
        var client = CreateProductionFactory().CreateClient();

        // Act — request an unknown API path; we just need to inspect headers,
        // the 404 status does not matter for this assertion.
        var response = await client.GetAsync("/api/this-does-not-exist");

        // Assert
        response.Headers.TryGetValues("Strict-Transport-Security", out var values).Should().BeTrue();
        var hstsValue = values!.Single();
        hstsValue.Should().Contain("max-age=31536000");
        hstsValue.Should().Contain("includeSubDomains");
        hstsValue.Should().Contain("preload");
    }

    // --- Development behavior tests ---

    [Fact]
    public async Task Development_does_not_redirect_http_to_https()
    {
        // Act — request over HTTP (in-memory server is always http)
        var response = await _factory.CreateClient().GetAsync("/health");

        // Assert — should be 200 OK, NOT a redirect
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
