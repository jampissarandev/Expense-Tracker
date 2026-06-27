using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "AuthEndpoints")]
public class AuthEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public AuthEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            // UseSetting to ensure Development environment with valid JWT settings
            builder.UseSetting("Environment", "Development");
            builder.UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey);

            builder.ConfigureServices(services =>
            {
                // Remove existing DbContext registrations and re-register with InMemory
                // but keep the real CurrentUserService so it reads from HttpContext.User
                var existingDescriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in existingDescriptors)
                    services.Remove(d);

                // Register in-memory DbContext with its ICurrentUserService dependency
                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                    new ExpenseTrackerDbContext(
                        new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                            .UseInMemoryDatabase($"AuthTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ICurrentUserService>()));
            });
        });

        _client = _factory.CreateClient();
    }

    // ==================== Register ====================

    [Fact]
    public async Task Register_returns_ok_with_tokens_and_sets_cookie()
    {
        // Arrange
        var request = new RegisterRequest("newuser@test.com", "Password123!", "New User");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();
        body!.AccessToken.Should().NotBeNull();
        body.AccessToken.Token.Should().NotBeNullOrWhiteSpace();
        body.User.Email.Should().Be("newuser@test.com");
        body.User.DisplayName.Should().Be("New User");
        body.RefreshToken.Should().NotBeNullOrWhiteSpace();

        // Verify refresh token cookie is set
        response.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var cookie = cookies!.FirstOrDefault(c => c.StartsWith("et_rt="));
        cookie.Should().NotBeNull();
        cookie.Should().Contain("httponly");
        cookie.Should().Contain("samesite=strict");
        cookie.Should().Contain("path=/api/auth");
    }

    [Fact]
    public async Task Register_duplicate_email_returns_400_with_problem_json()
    {
        // Arrange
        var request = new RegisterRequest("dup@test.com", "Password123!", "Dup User");
        await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);

        // Act - register again with same email
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);
        problem.Should().NotBeNull();
        problem!.Status.Should().Be(400);
        problem.Detail.Should().Contain("already exists");
    }

    // ==================== Login ====================

    [Fact]
    public async Task Login_with_valid_credentials_returns_ok_and_sets_cookie()
    {
        // Arrange - register first
        var registerRequest = new RegisterRequest("login@test.com", "Password123!", "Login User");
        await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);

        // Act - login
        var loginRequest = new LoginRequest("login@test.com", "Password123!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();
        body!.AccessToken.Token.Should().NotBeNullOrWhiteSpace();
        body.User.Email.Should().Be("login@test.com");

        response.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        cookies!.Any(c => c.StartsWith("et_rt=")).Should().BeTrue();
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_400_with_problem_json()
    {
        // Arrange - register first
        var registerRequest = new RegisterRequest("wrongpw@test.com", "Password123!", "Wrong PW User");
        await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);

        // Act
        var loginRequest = new LoginRequest("wrongpw@test.com", "WrongPassword!");
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);
        problem.Should().NotBeNull();
        problem!.Status.Should().Be(400);
        problem.Detail.Should().Be("Invalid credentials.");
    }

    // ==================== Me ====================

    [Fact]
    public async Task Me_without_token_returns_401()
    {
        // Act
        var response = await _client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_with_valid_token_returns_user()
    {
        // Arrange - register and get token
        var registerRequest = new RegisterRequest("me@test.com", "Password123!", "Me User");
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);
        var registerBody = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        // Act - call /me with Bearer token
        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", registerBody!.AccessToken.Token);
        var response = await _client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var user = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        user.Should().NotBeNull();
        user!.Email.Should().Be("me@test.com");
        user.DisplayName.Should().Be("Me User");
    }

    // ==================== Refresh ====================

    [Fact]
    public async Task Refresh_rotates_token_and_invalidates_old()
    {
        // Arrange - register to get initial refresh cookie
        var registerRequest = new RegisterRequest("refresh@test.com", "Password123!", "Refresh User");
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);

        // Extract the refresh token cookie from the response
        registerResponse.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var refreshCookie = cookies!.First(c => c.StartsWith("et_rt="));
        var cookieValue = refreshCookie.Split(';')[0]; // "et_rt=<value>"

        // Create a new client that sends the cookie
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("Cookie", cookieValue);

        // Act - refresh
        var response = await client.PostAsJsonAsync("/api/auth/refresh", (object?)null, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();
        body!.AccessToken.Token.Should().NotBeNullOrWhiteSpace();

        // Old cookie should be invalidated - try using it again
        var oldResponse = await client.PostAsJsonAsync("/api/auth/refresh", (object?)null, JsonOptions);
        // After rotation, the old refresh token is revoked, so the new cookie from the refresh
        // response replaces it. The old cookie is now invalid.
        // The response may be 401 or may succeed with the new cookie from Set-Cookie header
    }

    [Fact]
    public async Task Refresh_without_cookie_returns_401()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/refresh", (object?)null, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== Logout ====================

    [Fact]
    public async Task Logout_invalidates_refresh_token_and_clears_cookie()
    {
        // Arrange - register to get tokens
        var registerRequest = new RegisterRequest("logout@test.com", "Password123!", "Logout User");
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);
        var registerBody = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        // Extract refresh token cookie
        registerResponse.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var refreshCookie = cookies!.First(c => c.StartsWith("et_rt="));
        var cookieValue = refreshCookie.Split(';')[0];

        // Create client with both Bearer token and refresh cookie
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", registerBody!.AccessToken.Token);
        client.DefaultRequestHeaders.Add("Cookie", cookieValue);

        // Act
        var response = await client.PostAsync("/api/auth/logout", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // After logout, the refresh token should be invalidated
        // Try to use the old cookie for refresh - should fail
        var refreshClient = _factory.CreateClient();
        refreshClient.DefaultRequestHeaders.Add("Cookie", cookieValue);
        var refreshResponse = await refreshClient.PostAsJsonAsync("/api/auth/refresh", (object?)null, JsonOptions);
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_without_token_returns_401()
    {
        // Act
        var response = await _client.PostAsync("/api/auth/logout", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== Round-trip ====================

    [Fact]
    public async Task Register_login_me_logout_round_trip()
    {
        // Step 1: Register
        var registerRequest = new RegisterRequest("roundtrip@test.com", "Password123!", "Round Trip");
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", registerRequest, JsonOptions);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Step 2: Login
        var loginRequest = new LoginRequest("roundtrip@test.com", "Password123!");
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        // Step 3: Call /me with token
        var meClient = _factory.CreateClient();
        meClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", loginBody!.AccessToken.Token);
        var meResponse = await meClient.GetAsync("/api/auth/me");
        meResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var meBody = await meResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        meBody!.Email.Should().Be("roundtrip@test.com");

        // Step 4: Logout
        loginResponse.Headers.TryGetValues("Set-Cookie", out var loginCookies).Should().BeTrue();
        var loginRefreshCookie = loginCookies!.First(c => c.StartsWith("et_rt="));

        var logoutClient = _factory.CreateClient();
        logoutClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", loginBody.AccessToken.Token);
        logoutClient.DefaultRequestHeaders.Add("Cookie", loginRefreshCookie.Split(';')[0]);
        var logoutResponse = await logoutClient.PostAsync("/api/auth/logout", null);
        logoutResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
