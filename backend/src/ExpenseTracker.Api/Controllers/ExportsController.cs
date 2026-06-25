using System.Globalization;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Exports;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpenseTracker.Api.Controllers;

[ApiController]
[Route("api/exports")]
[Authorize]
public class ExportsController : ControllerBase
{
    private readonly IExportService _exportService;
    private readonly ICurrentUserService _currentUserService;

    public ExportsController(IExportService exportService, ICurrentUserService currentUserService)
    {
        _exportService = exportService;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Export transactions as CSV with optional filters.
    /// GET /api/exports/transactions.csv?type=&categoryId=&from=&to=
    /// </summary>
    [HttpGet("transactions.csv")]
    public async Task<IActionResult> ExportTransactions(
        [FromQuery] TransactionType? type = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null)
    {
        var userId = GetRequiredUserId();
        var filter = new TransactionFilter
        {
            Type = type,
            CategoryId = categoryId,
            From = ParseDate(from),
            To = ParseDate(to)
        };

        var stream = await _exportService.BuildTransactionsCsvAsync(userId, filter);
        var fileName = $"transactions-{DateTime.UtcNow:yyyyMMdd}.csv";
        return File(stream, "text/csv; charset=utf-8", fileName);
    }

    /// <summary>
    /// Export monthly summary as CSV with optional date range.
    /// GET /api/exports/summary.csv?from=&to=
    /// </summary>
    [HttpGet("summary.csv")]
    public async Task<IActionResult> ExportSummary(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null)
    {
        var userId = GetRequiredUserId();
        var stream = await _exportService.BuildSummaryCsvAsync(userId, ParseDate(from), ParseDate(to));
        var fileName = $"summary-{DateTime.UtcNow:yyyyMMdd}.csv";
        return File(stream, "text/csv; charset=utf-8", fileName);
    }

    private Guid GetRequiredUserId() =>
        _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");

    private static DateOnly? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return d;
        if (DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out d))
            return d;
        // Throw a domain validation exception so the global exception
        // middleware maps it to HTTP 400 (Bad Request) instead of 500.
        throw new DomainValidationException(
            $"Date '{raw}' is not in a recognized format. Use yyyy-MM-dd.");
    }
}
