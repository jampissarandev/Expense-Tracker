using ExpenseTracker.Domain.Entities;

namespace ExpenseTracker.Application.Abstractions;

public interface ICategoryRepository
{
    Task<IReadOnlyList<Category>> ListByUserAsync(Guid userId);
    Task<Category?> FindByIdAsync(Guid id);
    Task AddAsync(Category category);
    Task UpdateAsync(Category category);
    Task DeleteAsync(Category category);
    Task<bool> HasTransactionsAsync(Guid categoryId);
}
