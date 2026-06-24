using System.Net;
using System.Text.Json;
using ExpenseTracker.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace ExpenseTracker.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
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

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/problem+json";

        var (statusCode, detail) = exception switch
        {
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

        // Include a traceId for debugging
        if (context.TraceIdentifier != null)
        {
            problemDetails.Extensions["traceId"] = context.TraceIdentifier;
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
