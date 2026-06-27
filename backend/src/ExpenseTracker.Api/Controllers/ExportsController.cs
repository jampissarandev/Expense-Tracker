using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Common;
using ExpenseTracker.Application.Exports;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Enums;
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
            From = DateOnlyParser.Parse(from),
            To = DateOnlyParser.Parse(to)
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
        var stream = await _exportService.BuildSummaryCsvAsync(userId, DateOnlyParser.Parse(from), DateOnlyParser.Parse(to));
        var fileName = $"summary-{DateTime.UtcNow:yyyyMMdd}.csv";
        return File(stream, "text/csv; charset=utf-8", fileName);
    }

    private Guid GetRequiredUserId() =>
        _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");
}
