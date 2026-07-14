using System.Net;
using System.Text.Json;
using ExpenseTracker.Domain.Exceptions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace ExpenseTracker.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IWebHostEnvironment _environment;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger,
        IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/problem+json";

        var (statusCode, detail) = exception switch
        {
            BadHttpRequestException badRequest
                => (HttpStatusCode.RequestEntityTooLarge, badRequest.Message),
            NotFoundException notFound
                => (HttpStatusCode.NotFound, notFound.Message),
            ForbiddenException forbidden
                => (HttpStatusCode.Forbidden, forbidden.Message),
            DomainValidationException validation
                => (HttpStatusCode.BadRequest, validation.Message),
            RefreshTokenValidationException tokenValidation
                => (HttpStatusCode.Unauthorized, tokenValidation.Message),
            UnauthorizedAccessException unauthorized
                => (HttpStatusCode.Unauthorized, unauthorized.Message),
            _
                => (HttpStatusCode.InternalServerError, "An unexpected error occurred.")
        };

        context.Response.StatusCode = (int)statusCode;

        var problemDetails = new ProblemDetails
        {
            Status = (int)statusCode,
            Title = GetTitle(statusCode),
            Detail = detail,
            Type = $"https://httpstatuses.com/{(int)statusCode}",
            Instance = context.Request.Path
        };

        // Include a correlation id for debugging. Prefer the X-Request-Id
        // resolved by RequestIdMiddleware (echoed on the response so the
        // client and operator share one handle); fall back to ASP.NET's
        // TraceIdentifier if the middleware was somehow bypassed.
        //
        // C2 / R9 — Trace-ID disclosure is gated by environment: helpful in
        // Development (engineers correlate a 5xx with server logs during
        // deploys) but a correlation handle for attackers in Production.
        // The correlation id is still logged server-side via _logger above,
        // so on-call engineers can find the request — they just don't get
        // the id from the response body in non-Development environments.
        var correlationId = context.Items[RequestIdMiddleware.RequestIdItemKey] as string
            ?? context.TraceIdentifier;
        if (_environment.IsDevelopment() && correlationId != null)
        {
            problemDetails.Extensions["traceId"] = correlationId;
        }

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, options));
    }

    private static string GetTitle(HttpStatusCode statusCode) => statusCode switch
    {
        HttpStatusCode.BadRequest => "Bad Request",
        HttpStatusCode.Unauthorized => "Unauthorized",
        HttpStatusCode.Forbidden => "Forbidden",
        HttpStatusCode.NotFound => "Not Found",
        HttpStatusCode.InternalServerError => "Internal Server Error",
        _ => "Error"
    };
}
