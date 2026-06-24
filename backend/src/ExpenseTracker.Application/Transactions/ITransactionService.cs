using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;

namespace ExpenseTracker.Application.Transactions;

public interface ITransactionService
{
    Task<PagedResult<TransactionDto>> ListAsync(Guid userId, TransactionFilter filter);
    Task<TransactionDto> GetByIdAsync(Guid userId, Guid id);
    Task<TransactionDto> CreateAsync(Guid userId, CreateTransactionRequest request);
    Task<TransactionDto> UpdateAsync(Guid userId, Guid id, UpdateTransactionRequest request);
    Task DeleteAsync(Guid userId, Guid id);
}
