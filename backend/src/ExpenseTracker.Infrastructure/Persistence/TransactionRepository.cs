using ExpenseTracker.Application.Abstractions;
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

        // User isolation: global query filter already enforces this when
        // ICurrentUserService is set. We also apply an explicit Where as a
        // belt-and-braces measure for the unit test path where the filter
        // is not configured.
        query = query.Where(t => t.UserId == userId);

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

        var items = await query
            .OrderByDescending(t => t.OccurredOn)
            .ThenByDescending(t => t.CreatedAt)
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
