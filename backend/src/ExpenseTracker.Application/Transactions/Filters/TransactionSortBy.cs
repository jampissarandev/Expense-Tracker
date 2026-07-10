namespace ExpenseTracker.Application.Transactions.Filters;

/// <summary>
/// Columns that can be used to sort the transaction list.
/// Each value maps to a property on <see cref="Domain.Entities.Transaction"/>
/// (or its navigation) for server-side ordering.
/// </summary>
public enum TransactionSortBy
{
    OccurredOn = 0,
    Type = 1,
    CategoryName = 2,
    Amount = 3,
    Note = 4
}
