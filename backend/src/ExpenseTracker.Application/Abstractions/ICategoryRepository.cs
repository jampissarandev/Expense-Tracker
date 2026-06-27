using ExpenseTracker.Domain.Entities;

namespace ExpenseTracker.Application.Abstractions;

public interface ICategoryRepository
{
    Task<IReadOnlyList<Category>> ListByUserAsync(Guid userId);
    Task<Category?> FindByIdAsync(Guid id);
    Task AddAsync(Category category);
    Task UpdateAsync(Category category);
    Task DeleteAsync(Category category);
    /// <summary>
    /// Returns true if the given user owns at least one transaction that
    /// references <paramref name="categoryId"/>.  Used to guard category
    /// deletion — a user may only delete their own categories that have no
    /// transactions belonging to that user.
    /// </summary>
    Task<bool> HasTransactionsForUserAsync(Guid categoryId, Guid userId);
}
