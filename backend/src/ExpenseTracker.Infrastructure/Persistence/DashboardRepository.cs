using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.Infrastructure.Persistence;

public class DashboardRepository : IDashboardRepository
{
    private readonly ExpenseTrackerDbContext _context;

    public DashboardRepository(ExpenseTrackerDbContext context)
    {
        _context = context;
    }

    public async Task<CurrentMonthTotals> GetCurrentMonthTotalsAsync(Guid userId)
    {
        var now = DateTimeOffset.UtcNow;
        var year = now.Year;
        var month = now.Month;
        var firstDay = new DateOnly(year, month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);

        var income = await _context.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.Type == TransactionType.Income
                     && t.OccurredOn >= firstDay && t.OccurredOn <= lastDay)
            .SumAsync(t => t.Amount);

        var expense = await _context.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.Type == TransactionType.Expense
                     && t.OccurredOn >= firstDay && t.OccurredOn <= lastDay)
            .SumAsync(t => t.Amount);

        return new CurrentMonthTotals(income, expense, year, month);
    }

    public async Task<IReadOnlyList<MonthlyAggregate>> GetLast6MonthsAsync(Guid userId)
    {
        var now = DateTimeOffset.UtcNow;
        var currentYear = now.Year;
        var currentMonth = now.Month;

        // Build the 6-month window: current month and 5 previous months
        var months = new List<(int Year, int Month)>();
        for (var i = 0; i < 6; i++)
        {
            var date = new DateTime(currentYear, currentMonth, 1).AddMonths(-i);
            months.Add((date.Year, date.Month));
        }
        months.Reverse(); // chronological order

        var fromMonth = months.First();
        var fromDate = new DateOnly(fromMonth.Year, fromMonth.Month, 1);
        var toDate = new DateOnly(now.Year, now.Month, 1).AddMonths(1).AddDays(-1);

        // Fetch all transactions in the 6-month window
        var transactions = await _context.Transactions
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.OccurredOn >= fromDate && t.OccurredOn <= toDate)
            .Select(t => new { t.Type, t.Amount, t.OccurredOn })
            .ToListAsync();

        // Group by month
        var grouped = transactions
            .GroupBy(t => new { t.OccurredOn.Year, t.OccurredOn.Month })
            .ToDictionary(
                g => (g.Key.Year, g.Key.Month),
                g => new
                {
                    Income = g.Where(x => x.Type == TransactionType.Income).Sum(x => x.Amount),
                    Expense = g.Where(x => x.Type == TransactionType.Expense).Sum(x => x.Amount)
                });

        // Fill missing months with zeros
        var result = months.Select(m => new MonthlyAggregate(
            m.Year,
            m.Month,
            grouped.TryGetValue(m, out var g) ? g.Income : 0m,
            grouped.TryGetValue(m, out g) ? g.Expense : 0m))
            .ToList();

        return result;
    }

    public async Task<IReadOnlyList<CategoryAggregate>> GetByCategoryAsync(Guid userId, TransactionType type)
    {
        var now = DateTimeOffset.UtcNow;
        var firstDay = new DateOnly(now.Year, now.Month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);

        // Load filtered transactions with category navigation into memory,
        // then aggregate client-side. This avoids EF translation issues with
        // GroupBy + navigation properties on non-relational providers (InMemory)
        // and keeps the query simple for PostgreSQL.
        var transactions = await _context.Transactions
            .AsNoTracking()
            .Include(t => t.Category)
            .Where(t => t.UserId == userId && t.Type == type
                     && t.OccurredOn >= firstDay && t.OccurredOn <= lastDay)
            .ToListAsync();

        var aggregates = transactions
            .GroupBy(t => new { t.CategoryId, t.Category.Name })
            .Select(g => new CategoryAggregate(
                g.Key.CategoryId,
                g.Key.Name,
                g.Sum(x => x.Amount),
                g.Count()))
            .OrderByDescending(x => x.Total)
            .Take(10)
            .ToList();

        return aggregates;
    }

    public async Task<IReadOnlyList<AggregateByCategoryAndMonth>> GetByCategoryAndMonthAsync(
        Guid userId, TransactionType type)
    {
        var now = DateTimeOffset.UtcNow;
        var firstDay = new DateOnly(now.Year, now.Month, 1);
        var lastDay = firstDay.AddMonths(1).AddDays(-1);

        var transactions = await _context.Transactions
            .AsNoTracking()
            .Include(t => t.Category)
            .Where(t => t.UserId == userId && t.Type == type
                     && t.OccurredOn >= firstDay && t.OccurredOn <= lastDay)
            .ToListAsync();

        var aggregates = transactions
            .GroupBy(t => new { t.CategoryId, t.Category.Name, t.OccurredOn.Year, t.OccurredOn.Month })
            .Select(g => new AggregateByCategoryAndMonth(
                g.Key.CategoryId,
                g.Key.Name,
                g.Key.Year,
                g.Key.Month,
                g.Sum(x => x.Amount)))
            .OrderByDescending(x => x.Total)
            .Take(10)
            .ToList();

        return aggregates;
    }
}
