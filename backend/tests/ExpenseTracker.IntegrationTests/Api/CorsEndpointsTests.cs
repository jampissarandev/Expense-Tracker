using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "CorsEndpoints")]
public class CorsEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public CorsEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace DbContext with InMemory so actual POST requests don't hit real DB
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
                            .UseInMemoryDatabase($"CorsTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });
    }

    [Fact]
    public async Task Preflight_request_with_valid_origin_returns_cors_headers()
    {
        // Arrange
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", "http://localhost:5173");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        // Act
        var response = await client.SendAsync(request);

        // Assert - CORS middleware responds to preflight with 204 NoContent
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins).Should().BeTrue();
        origins!.Should().Contain("http://localhost:5173");

        response.Headers.TryGetValues("Access-Control-Allow-Credentials", out var credentials).Should().BeTrue();
        credentials!.Should().Contain("true");

        response.Headers.TryGetValues("Access-Control-Allow-Methods", out var methods).Should().BeTrue();
    }

    [Fact]
    public async Task Preflight_request_with_invalid_origin_does_not_return_cors_headers()
    {
        // Arrange
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", "http://malicious-site.com");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        // Act
        var response = await client.SendAsync(request);

        // Assert - non-matching origin should not include CORS allow headers
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins).Should().BeFalse();
    }

    [Fact]
    public async Task Actual_request_with_valid_origin_includes_cors_header()
    {
        // Arrange
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login");
        request.Headers.Add("Origin", "http://localhost:5173");
        request.Content = JsonContent.Create(
            new LoginRequest("nonexistent@test.com", "irrelevant"),
            options: JsonOptions);

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins).Should().BeTrue();
        origins!.Should().Contain("http://localhost:5173");

        response.Headers.TryGetValues("Access-Control-Allow-Credentials", out var credentials).Should().BeTrue();
        credentials!.Should().Contain("true");
    }

    [Fact]
    public async Task Actual_request_with_invalid_origin_does_not_include_cors_header()
    {
        // Arrange
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login");
        request.Headers.Add("Origin", "http://malicious-site.com");
        request.Content = JsonContent.Create(
            new LoginRequest("nonexistent@test.com", "irrelevant"),
            options: JsonOptions);

        // Act
        var response = await client.SendAsync(request);

        // Assert - non-matching origin should not include CORS allow header
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins).Should().BeFalse();
    }
}
