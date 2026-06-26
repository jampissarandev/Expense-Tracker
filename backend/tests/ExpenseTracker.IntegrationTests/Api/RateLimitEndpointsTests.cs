using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "RateLimitEndpoints")]
public class RateLimitEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public RateLimitEndpointsTests(WebApplicationFactory<Program> factory)
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
                            .UseInMemoryDatabase($"RateLimitTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });

        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Auth_rate_limit_blocks_after_5_requests_per_minute()
    {
        // Arrange
        var loginRequest = new LoginRequest("rate-limit-test@test.com", "WrongPassword!");

        // Act - first 5 requests should be processed (return 400 for bad credentials)
        for (int i = 0; i < 5; i++)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

            // Verify it's a problem detail, not a rate limit response
            var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);
            problem.Should().NotBeNull();
            problem!.Status.Should().Be(400);
        }

        // 6th request should be rate limited
        var rateLimited = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);

        // Assert
        rateLimited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Non_auth_endpoints_are_not_rate_limited()
    {
        // This tests that the rate limit policy is scoped to AuthController only.
        // We send requests to a non-auth endpoint and verify they're not blocked.
        // The rate limit is 5 req/min on auth; we send 10 requests to /health
        // to verify it's not affected.

        for (int i = 0; i < 10; i++)
        {
            var response = await _client.GetAsync("/health");
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests);
        }
    }
}
