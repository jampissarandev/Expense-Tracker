using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Dashboard;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(Guid userId, TransactionType? type = null);
}
