using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Dashboard;

public record DashboardSummaryDto(
    CurrentMonthDto CurrentMonth,
    IReadOnlyList<MonthlyTotalDto> Last6Months,
    IReadOnlyList<CategoryTotalDto> ByCategory);

public record CurrentMonthDto(
    decimal Income,
    decimal Expense,
    decimal Balance,
    int Year,
    int Month);

public record MonthlyTotalDto(
    int Year,
    int Month,
    decimal Income,
    decimal Expense);

public record CategoryTotalDto(
    Guid CategoryId,
    string Name,
    decimal Total,
    int Count);
