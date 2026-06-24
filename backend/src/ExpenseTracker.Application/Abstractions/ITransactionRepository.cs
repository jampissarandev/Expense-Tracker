using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Entities;

namespace ExpenseTracker.Application.Abstractions;

public interface ITransactionRepository
{
    Task<(IReadOnlyList<Transaction> Items, int TotalCount)> ListAsync(
        Guid userId,
        TransactionFilter filter);

    Task<Transaction?> GetByIdAsync(Guid userId, Guid id);

    Task AddAsync(Transaction transaction);

    Task UpdateAsync(Transaction transaction);

    Task DeleteAsync(Transaction transaction);
}
