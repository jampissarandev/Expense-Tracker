using System.Text;
using System.Text.Json;
using ExpenseTracker.Api.Middleware;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Middleware;

/// <summary>
/// Verifies C2 / R9: Trace-ID disclosure is gated by environment.
///
/// Behavior contract:
/// - In <b>Development</b>, error responses include the <c>traceId</c> extension
///   so engineers can correlate a 5xx with server logs during a deploy.
/// - In <b>Production</b> (or any non-Development environment), the
///   <c>traceId</c> extension is <b>omitted</b> from the response body so an
///   external attacker cannot use it as a correlation handle. The correlation
///   id is still logged server-side by the middleware's <c>ILogger</c>.
/// - The gating must not affect any other ProblemDetails field (status, title,
///   detail, type, instance).
/// </summary>
[Trait("Category", "GlobalExceptionMiddleware")]
public class GlobalExceptionMiddlewareTests
{
    private const string CorrelationId = "test-correlation-id-abc-123";
    private const string Path = "/api/test";

    // ── Development: traceId is INCLUDED ────────────────────────────────────

    [Fact]
    public async Task InDevelopment_traceId_is_included_in_error_response()
    {
        // Arrange
        var env = FakeEnvironment("Development");
        var middleware = CreateMiddleware(env, throwOnNext: new InvalidOperationException("boom"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status500InternalServerError);
        body.Should().Contain("\"traceId\"");
        body.Should().Contain(CorrelationId);
    }

    // ── Production: traceId is OMITTED ──────────────────────────────────────

    [Fact]
    public async Task InProduction_traceId_is_omitted_from_error_response()
    {
        // Arrange
        var env = FakeEnvironment("Production");
        var middleware = CreateMiddleware(env, throwOnNext: new InvalidOperationException("boom"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status500InternalServerError);
        body.Should().NotContain("\"traceId\"");
        body.Should().NotContain(CorrelationId);
    }

    [Fact]
    public async Task InStaging_traceId_is_omitted_from_error_response()
    {
        // Arrange
        var env = FakeEnvironment("Staging");
        var middleware = CreateMiddleware(env, throwOnNext: new InvalidOperationException("boom"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status500InternalServerError);
        body.Should().NotContain("\"traceId\"");
    }

    [Fact]
    public async Task InTest_traceId_is_omitted_from_error_response()
    {
        // Arrange
        var env = FakeEnvironment("Test");
        var middleware = CreateMiddleware(env, throwOnNext: new InvalidOperationException("boom"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status500InternalServerError);
        body.Should().NotContain("\"traceId\"");
    }

    // ── Other ProblemDetails fields are preserved regardless of env ────────

    [Fact]
    public async Task InProduction_other_ProblemDetails_fields_are_preserved()
    {
        // Arrange
        var env = FakeEnvironment("Production");
        var middleware = CreateMiddleware(env, throwOnNext: new InvalidOperationException("boom"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert — status, title, detail, type, instance must still be present
        statusCode.Should().Be(StatusCodes.Status500InternalServerError);
        body.Should().Contain("\"status\":500");
        body.Should().Contain("\"title\":\"Internal Server Error\"");
        body.Should().Contain("\"detail\":\"An unexpected error occurred.\"");
        body.Should().Contain("\"type\":\"https://httpstatuses.com/500\"");
        body.Should().Contain($"\"instance\":\"{Path}\"");
    }

    // ── Status code mapping is unchanged across environments ───────────────

    [Fact]
    public async Task NotFoundException_maps_to_404_regardless_of_env()
    {
        // Arrange
        var env = FakeEnvironment("Production");
        var middleware = CreateMiddleware(env, throwOnNext: new NotFoundException("user not found"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status404NotFound);
        body.Should().Contain("\"status\":404");
        body.Should().Contain("\"detail\":\"user not found\"");
        body.Should().NotContain("\"traceId\"");
    }

    [Fact]
    public async Task DomainValidationException_maps_to_400_regardless_of_env()
    {
        // Arrange
        var env = FakeEnvironment("Development");
        var middleware = CreateMiddleware(env, throwOnNext: new DomainValidationException("invalid email"));

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status400BadRequest);
        body.Should().Contain("\"status\":400");
        body.Should().Contain("\"detail\":\"invalid email\"");
    }

    // ── Success path: no body, no problem details ──────────────────────────

    [Fact]
    public async Task When_next_completes_normally_no_response_body_is_written()
    {
        // Arrange
        var env = FakeEnvironment("Production");
        RequestDelegate next = (ctx) => Task.CompletedTask;
        var middleware = new GlobalExceptionMiddleware(
            next,
            Substitute.For<ILogger<GlobalExceptionMiddleware>>(),
            env);

        // Act
        var (statusCode, body) = await InvokeAsync(middleware);

        // Assert
        statusCode.Should().Be(StatusCodes.Status200OK);
        body.Should().BeEmpty();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static IWebHostEnvironment FakeEnvironment(string name)
    {
        var env = Substitute.For<IWebHostEnvironment>();
        env.EnvironmentName = name;
        return env;
    }

    private static GlobalExceptionMiddleware CreateMiddleware(
        IWebHostEnvironment env,
        Exception throwOnNext)
    {
        RequestDelegate next = (ctx) => throw throwOnNext;
        return new GlobalExceptionMiddleware(
            next,
            Substitute.For<ILogger<GlobalExceptionMiddleware>>(),
            env);
    }

    private static async Task<(int StatusCode, string Body)> InvokeAsync(
        GlobalExceptionMiddleware middleware)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = Path;
        // Pre-populate the RequestId item so the middleware picks it up via
        // HttpContext.Items (the path the production code takes).
        context.Items[RequestIdMiddleware.RequestIdItemKey] = CorrelationId;
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync();
        return (context.Response.StatusCode, body);
    }
}