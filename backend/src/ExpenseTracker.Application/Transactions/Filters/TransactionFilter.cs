using ExpenseTracker.Application.Common;
using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Transactions.Filters;

/// <summary>
/// Query filter for <see cref="ITransactionService.ListAsync"/>.
/// All fields are optional; null means "no filter on this field".
/// Date ranges are inclusive on both ends (occurred_on BETWEEN from AND to).
/// </summary>
public sealed record TransactionFilter
{
    public TransactionType? Type { get; init; }
    public Guid? CategoryId { get; init; }
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public TransactionSortBy? SortBy { get; init; }
    public SortOrder? SortOrder { get; init; }

    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 20;
}
