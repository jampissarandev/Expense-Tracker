using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Dashboard;

public class DashboardService : IDashboardService
{
    private readonly IDashboardRepository _repository;

    public DashboardService(IDashboardRepository repository)
    {
        _repository = repository;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(Guid userId, TransactionType? type = null)
    {
        // IMPORTANT: Do NOT run these repository calls in parallel.
        // They share the scoped `ExpenseTrackerDbContext`, and EF Core's
        // DbContext is not thread-safe — concurrent queries on the same
        // instance throw `InvalidOperationException: A second operation
        // was started on this context instance...`. Await sequentially
        // (each call completes before the next begins). If parallelism
        // is ever needed, switch to `IDbContextFactory<T>` and create a
        // fresh context per call.
        var currentMonth = await _repository.GetCurrentMonthTotalsAsync(userId);
        var last6Months = await _repository.GetLast6MonthsAsync(userId);
        var byCategoryType = type ?? TransactionType.Expense;
        var byCategory = await _repository.GetByCategoryAsync(userId, byCategoryType);

        var currentMonthDto = new CurrentMonthDto(
            currentMonth.Income,
            currentMonth.Expense,
            currentMonth.Income - currentMonth.Expense,
            currentMonth.Year,
            currentMonth.Month);

        var byCategoryDtos = byCategory
            .Select(c => new CategoryTotalDto(c.CategoryId, c.Name, c.Total, c.Count))
            .ToList();

        return new DashboardSummaryDto(
            currentMonthDto,
            last6Months.Select(m => new MonthlyTotalDto(m.Year, m.Month, m.Income, m.Expense)).ToList(),
            byCategoryDtos);
    }
}
