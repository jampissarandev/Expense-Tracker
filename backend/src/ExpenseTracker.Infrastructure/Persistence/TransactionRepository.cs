using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Common;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.Infrastructure.Persistence;

public class TransactionRepository : ITransactionRepository
{
    private readonly ExpenseTrackerDbContext _context;

    public TransactionRepository(ExpenseTrackerDbContext context)
    {
        _context = context;
    }

    public async Task<(IReadOnlyList<Transaction> Items, int TotalCount)> ListAsync(
        Guid userId,
        TransactionFilter filter)
    {
        IQueryable<Transaction> query = _context.Transactions
            .AsNoTracking()
            .Include(t => t.Category);

        // User isolation is handled by the EF Core global query filter on
        // Transaction (see ExpenseTrackerDbContext.OnModelCreating). No
        // explicit Where(t => t.UserId == userId) here — the global filter
        // is the single source of truth. Regression-proofed by
        // GlobalQueryFilterTests.TransactionRepository_ListAsync_returns_only_current_users_data.

        if (filter.Type.HasValue)
            query = query.Where(t => t.Type == filter.Type.Value);

        if (filter.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == filter.CategoryId.Value);

        if (filter.From.HasValue)
            query = query.Where(t => t.OccurredOn >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(t => t.OccurredOn <= filter.To.Value);

        var totalCount = await query.CountAsync();

        var page = filter.Page <= 0 ? 1 : filter.Page;
        var pageSize = filter.PageSize <= 0
            ? TransactionFilter.DefaultPageSize
            : Math.Min(filter.PageSize, TransactionFilter.MaxPageSize);

        // Apply dynamic sort if SortBy is specified; fall back to default.
        IOrderedQueryable<Transaction> ordered;
        if (filter.SortBy.HasValue)
        {
            var isAsc = filter.SortOrder == SortOrder.Asc;
            ordered = filter.SortBy.Value switch
            {
                TransactionSortBy.OccurredOn => isAsc
                    ? query.OrderBy(t => t.OccurredOn)
                    : query.OrderByDescending(t => t.OccurredOn),
                TransactionSortBy.Type => isAsc
                    ? query.OrderBy(t => t.Type)
                    : query.OrderByDescending(t => t.Type),
                TransactionSortBy.CategoryName => isAsc
                    ? query.OrderBy(t => t.Category.Name)
                    : query.OrderByDescending(t => t.Category.Name),
                TransactionSortBy.Amount => isAsc
                    ? query.OrderBy(t => t.Amount)
                    : query.OrderByDescending(t => t.Amount),
                TransactionSortBy.Note => isAsc
                    ? query.OrderBy(t => t.Note ?? string.Empty)
                    : query.OrderByDescending(t => t.Note ?? string.Empty),
                _ => query.OrderByDescending(t => t.OccurredOn),
            };
        }
        else
        {
            ordered = query.OrderByDescending(t => t.OccurredOn);
        }

        // Always add CreatedAt as tiebreaker for stable ordering.
        ordered = ordered.ThenByDescending(t => t.CreatedAt);

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Transaction?> GetByIdAsync(Guid userId, Guid id)
    {
        return await _context.Transactions
            .Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
    }

    public async Task AddAsync(Transaction transaction)
    {
        await _context.Transactions.AddAsync(transaction);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Transaction transaction)
    {
        // Mark navigation property as modified only if loaded; otherwise EF
        // tracks the entity already (we just modified its properties).
        if (_context.Entry(transaction).State == EntityState.Detached)
        {
            _context.Transactions.Attach(transaction);
        }
        _context.Entry(transaction).State = EntityState.Modified;
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Transaction transaction)
    {
        _context.Transactions.Remove(transaction);
        await _context.SaveChangesAsync();
    }
}
