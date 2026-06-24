using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Dashboard;

/// <summary>
/// Dashboard-specific read queries that bypass the standard repository
/// to perform server-side aggregation via raw SQL for performance.
/// </summary>
public interface IDashboardRepository
{
    Task<CurrentMonthTotals> GetCurrentMonthTotalsAsync(Guid userId);

    Task<IReadOnlyList<MonthlyAggregate>> GetLast6MonthsAsync(Guid userId);

    Task<IReadOnlyList<CategoryAggregate>> GetByCategoryAsync(Guid userId, TransactionType type);

    Task<IReadOnlyList<AggregateByCategoryAndMonth>> GetByCategoryAndMonthAsync(
        Guid userId, TransactionType type);
}

public record CurrentMonthTotals(decimal Income, decimal Expense, int Year, int Month);

public record MonthlyAggregate(int Year, int Month, decimal Income, decimal Expense);

public record CategoryAggregate(Guid CategoryId, string Name, decimal Total, int Count);

public record AggregateByCategoryAndMonth(Guid CategoryId, string Name, int Year, int Month, decimal Total);
