using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "GlobalRateLimitEndpoints")]
public class GlobalRateLimitTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public GlobalRateLimitTests(WebApplicationFactory<Program> factory)
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
                            .UseInMemoryDatabase($"GlobalRateLimitTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ICurrentUserService>()));
            });
        });

        _client = _factory.CreateClient();
    }

    private async Task<string> RegisterAndGetTokenAsync(string email = "ratelimit@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Rate Limit User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body.AccessToken.Token;
    }

    [Fact]
    public async Task Authenticated_requests_succeed_up_to_limit()
    {
        // Arrange
        await RegisterAndGetTokenAsync("global-limit-pass@test.com");

        // Act — first 200 GET requests should all succeed (return 200 or 4xx for
        // business logic, but never 429 for the global rate limit).
        for (int i = 0; i < 200; i++)
        {
            var response = await _client.GetAsync("/api/transactions");
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                because: $"request {i + 1} of 200 should not be rate-limited");
        }
    }

    [Fact]
    public async Task Request_beyond_limit_returns_429()
    {
        // Arrange
        await RegisterAndGetTokenAsync("global-limit-block@test.com");

        // Act — exhaust the 200-request window
        for (int i = 0; i < 200; i++)
        {
            await _client.GetAsync("/api/transactions");
        }

        // 201st request should be rejected
        var rateLimited = await _client.GetAsync("/api/transactions");

        // Assert
        rateLimited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Auth_rate_limit_is_separate_from_global_limit()
    {
        // The global limit (200/min) should not affect the auth endpoint's own
        // limit (5/min). Verify that the auth endpoint still blocks at 5.
        for (int i = 0; i < 5; i++)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new LoginRequest("doesnotexist@test.com", "WrongPassword!"), JsonOptions);
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        var rateLimited = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest("doesnotexist@test.com", "WrongPassword!"), JsonOptions);
        rateLimited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Health_endpoint_is_not_affected_by_global_rate_limit()
    {
        // /health is not on a controller with [EnableRateLimiting("GlobalRateLimit")]
        // so it should never return 429 regardless of volume.
        for (int i = 0; i < 210; i++)
        {
            var response = await _client.GetAsync("/health");
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                because: "health endpoint has no global rate limit");
        }
    }

    [Fact]
    public async Task Global_rate_limit_applies_to_categories_endpoint()
    {
        // Arrange — register and set auth header
        await RegisterAndGetTokenAsync("global-limit-cat@test.com");

        // Act — exhaust the limit via /api/categories
        for (int i = 0; i < 200; i++)
        {
            await _client.GetAsync("/api/categories");
        }

        // 201st request to a different controller should still be blocked
        // (partition is per user, shared across all GlobalRateLimit controllers
        // for the same user — see B1 C-option deviation note)
        var rateLimited = await _client.GetAsync("/api/categories");
        rateLimited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Rate_limit_is_per_user_not_shared_across_users()
    {
        // C-option deviation: limit is partitioned by user id, not by IP.
        // User A exhausting their quota must NOT affect user B's budget.

        // Arrange — user A exhausts their 200/min window
        await RegisterAndGetTokenAsync("per-user-a@test.com");
        for (int i = 0; i < 200; i++)
            await _client.GetAsync("/api/transactions");

        // Sanity: user A is now blocked
        (await _client.GetAsync("/api/transactions"))
            .StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        // Act — register a fresh user B and hit the same endpoint
        await RegisterAndGetTokenAsync("per-user-b@test.com");
        var userBResponse = await _client.GetAsync("/api/transactions");

        // Assert — user B has their own independent bucket
        userBResponse.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
            because: "user B's budget is partitioned independently from user A's");
    }
}
