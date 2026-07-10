namespace ExpenseTracker.Application.Common;

/// <summary>
/// Direction for server-side sort operations.
/// Maps to <c>ORDER BY ... ASC</c> / <c>DESC</c> in SQL.
/// </summary>
public enum SortOrder
{
    Asc = 0,
    Desc = 1
}
