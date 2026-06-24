using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.Infrastructure.Persistence;

public class CategoryRepository : ICategoryRepository
{
    private readonly ExpenseTrackerDbContext _context;

    public CategoryRepository(ExpenseTrackerDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Category>> ListByUserAsync(Guid userId)
    {
        // Global query filter already handles: system categories + user's own categories
        return await _context.Categories
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<Category?> FindByIdAsync(Guid id)
    {
        return await _context.Categories.FindAsync(id);
    }

    public async Task AddAsync(Category category)
    {
        await _context.Categories.AddAsync(category);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Category category)
    {
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Category category)
    {
        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> HasTransactionsAsync(Guid categoryId)
    {
        return await _context.Transactions
            .AnyAsync(t => t.CategoryId == categoryId);
    }
}
