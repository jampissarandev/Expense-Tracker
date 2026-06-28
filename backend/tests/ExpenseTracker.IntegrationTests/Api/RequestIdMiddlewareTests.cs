using System.Net;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

/// <summary>
/// Verifies C1 / R17: Request-ID propagation middleware.
///
/// Behavior contract:
/// - When the client sends an <c>X-Request-Id</c> header, the middleware
///   echoes it back in the response.
/// - When the client omits the header, the middleware generates a non-empty
///   value and exposes it via the response header.
/// - The response header is the same value the server used for log
///   correlation (we don't re-read the response in this test, but the
///   server-side pipeline uses HttpContext.Items["RequestId"]).
/// - The header is added before downstream handlers run, so it is present
///   on error responses (4xx/5xx) as well as success (2xx).
/// </summary>
[Trait("Category", "RequestId")]
public class RequestIdMiddlewareTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string HeaderName = "X-Request-Id";

    private readonly WebApplicationFactory<Program> _factory;

    public RequestIdMiddlewareTests(WebApplicationFactory<Program> factory)
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
                            .UseInMemoryDatabase($"RequestIdTest_{dbGuid}")
                            .Options,
                        sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>()));
            });
        });
    }

    [Fact]
    public async Task Incoming_request_id_header_is_echoed_in_response()
    {
        // Arrange
        var client = _factory.CreateClient();
        const string sent = "abc-123-test-correlation";

        // Act
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add(HeaderName, sent);
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.TryGetValues(HeaderName, out var values).Should().BeTrue();
        values!.Single().Should().Be(sent);
    }

    [Fact]
    public async Task Missing_request_id_header_is_generated_and_returned()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — no X-Request-Id sent
        var response = await client.GetAsync("/health");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.TryGetValues(HeaderName, out var values).Should().BeTrue();
        values!.Single().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Generated_request_id_is_unique_per_request()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — two consecutive requests without an X-Request-Id header
        var r1 = await client.GetAsync("/health");
        var r2 = await client.GetAsync("/health");

        // Assert — each response gets a different generated id
        r1.Headers.GetValues(HeaderName).Single().Should().NotBe(
            r2.Headers.GetValues(HeaderName).Single());
    }

    [Fact]
    public async Task Request_id_header_is_present_on_error_responses()
    {
        // Arrange — /api/auth/refresh with no body is a 400 (no cookie)
        var client = _factory.CreateClient();
        const string sent = "error-correlation-id-42";

        // Act
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add(HeaderName, sent);
        var response = await client.SendAsync(request);

        // Assert — the request ran far enough for the middleware to set the
        // header; status is non-success, but the header must still echo.
        response.StatusCode.Should().NotBe(HttpStatusCode.OK);
        response.Headers.TryGetValues(HeaderName, out var values).Should().BeTrue();
        values!.Single().Should().Be(sent);
    }
}
