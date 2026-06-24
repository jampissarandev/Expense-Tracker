using System.Globalization;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Transactions;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpenseTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionService _transactionService;
    private readonly ICurrentUserService _currentUserService;

    public TransactionsController(
        ITransactionService transactionService,
        ICurrentUserService currentUserService)
    {
        _transactionService = transactionService;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<TransactionDto>>> List(
        [FromQuery] TransactionType? type = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = TransactionFilter.DefaultPageSize)
    {
        var userId = GetRequiredUserId();
        var filter = new TransactionFilter
        {
            Type = type,
            CategoryId = categoryId,
            From = ParseDate(from),
            To = ParseDate(to),
            Page = page,
            PageSize = pageSize
        };
        var result = await _transactionService.ListAsync(userId, filter);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TransactionDto>> GetById(Guid id)
    {
        var userId = GetRequiredUserId();
        var tx = await _transactionService.GetByIdAsync(userId, id);
        return Ok(tx);
    }

    [HttpPost]
    public async Task<ActionResult<TransactionDto>> Create([FromBody] CreateTransactionRequest request)
    {
        var userId = GetRequiredUserId();
        var tx = await _transactionService.CreateAsync(userId, request);
        return CreatedAtAction(nameof(GetById), new { id = tx.Id }, tx);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TransactionDto>> Update(Guid id, [FromBody] UpdateTransactionRequest request)
    {
        var userId = GetRequiredUserId();
        var tx = await _transactionService.UpdateAsync(userId, id, request);
        return Ok(tx);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetRequiredUserId();
        await _transactionService.DeleteAsync(userId, id);
        return NoContent();
    }

    private Guid GetRequiredUserId() =>
        _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");

    private static DateOnly? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        // Accept either ISO date (yyyy-MM-dd) or full ISO 8601 datetime.
        if (DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return d;
        if (DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out d))
            return d;
        throw new ArgumentException(
            $"Date '{raw}' is not in a recognized format. Use yyyy-MM-dd.",
            nameof(raw));
    }
}
