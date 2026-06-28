using Serilog.Context;

namespace ExpenseTracker.Api.Middleware;

/// <summary>
/// C1 / R17 — Request-ID propagation middleware.
///
/// Responsibilities:
/// <list type="bullet">
/// <item>Read the inbound <c>X-Request-Id</c> request header.</item>
/// <item>Generate a new 32-char hex id if the header is missing, empty,
///       or contains a value longer than <see cref="MaxHeaderLength"/>.</item>
/// <item>Store the resolved value on <see cref="HttpContext.Items"/> under
///       the <see cref="RequestIdItemKey"/> key so downstream middleware
///       (notably <c>GlobalExceptionMiddleware</c> and the Serilog
///       request-logging enricher) can read it.</item>
/// <item>Push the value into the Serilog <see cref="LogContext"/> as
///       <c>RequestId</c> so every log entry inside the request scope
///       carries the same correlation handle.</item>
/// <item>Echo the value back on the response as <c>X-Request-Id</c> —
///       set <em>before</em> the response begins streaming so it survives
///       downstream error paths that may short-circuit the body.</item>
/// </list>
///
/// Why set the response header before awaiting <c>next</c>?
/// If we only set the header after <c>await next()</c>, a downstream
/// middleware that throws and triggers the exception handler would commit
/// the response before we ran. Setting the header up-front guarantees it
/// is on the wire regardless of what happens inside the pipeline.
/// </summary>
public class RequestIdMiddleware
{
    /// <summary>Wire header read from the request and written back on the response.</summary>
    public const string HeaderName = "X-Request-Id";

    /// <summary>Key used in <see cref="HttpContext.Items"/> to publish the id within the request scope.</summary>
    public const string RequestIdItemKey = "RequestId";

    /// <summary>Serilog <see cref="LogContext"/> property name.</summary>
    public const string LogPropertyName = "RequestId";

    /// <summary>Reject inbound headers longer than this to prevent log-flooding attacks.</summary>
    private const int MaxHeaderLength = 128;

    private readonly RequestDelegate _next;

    public RequestIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = ResolveRequestId(context);

        // Publish for in-process consumers (exception handler, controllers).
        context.Items[RequestIdItemKey] = requestId;

        // Echo on the response up-front so error paths keep the header.
        context.Response.OnStarting(() =>
        {
            // Idempotency: don't double-set if something downstream already set it.
            if (!context.Response.Headers.ContainsKey(HeaderName))
            {
                context.Response.Headers[HeaderName] = requestId;
            }
            return Task.CompletedTask;
        });

        // Enrich the Serilog scope so every log entry written by code in
        // `next` (including MVC controllers, infrastructure services,
        // and the SecurityEventLogger) carries { RequestId = "…" }.
        using (LogContext.PushProperty(LogPropertyName, requestId))
        {
            await _next(context);
        }
    }

    /// <summary>
    /// Read <c>X-Request-Id</c> from the request. If missing, empty,
    /// whitespace, or excessively long, generate a new 32-char hex id.
    /// </summary>
    private static string ResolveRequestId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(HeaderName, out var values))
        {
            var inbound = values.ToString();
            if (!string.IsNullOrWhiteSpace(inbound) && inbound.Length <= MaxHeaderLength)
            {
                return inbound;
            }
        }

        // "N" format = 32 hex digits, no hyphens. Compact, log-friendly.
        return Guid.NewGuid().ToString("N");
    }
}
