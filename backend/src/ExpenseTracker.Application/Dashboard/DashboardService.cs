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
        var currentMonthTask = _repository.GetCurrentMonthTotalsAsync(userId);
        var last6MonthsTask = _repository.GetLast6MonthsAsync(userId);
        var byCategoryType = type ?? TransactionType.Expense;
        var byCategoryTask = _repository.GetByCategoryAsync(userId, byCategoryType);

        await Task.WhenAll(currentMonthTask, last6MonthsTask, byCategoryTask);

        var currentMonth = await currentMonthTask;
        var last6Months = await last6MonthsTask;
        var byCategory = await byCategoryTask;

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
