using ExpenseTracker.Domain.Entities;

namespace ExpenseTracker.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> FindByEmailAsync(string email);
    Task<User?> FindByIdAsync(Guid id);
    Task AddAsync(User user);
    Task<bool> ExistsByEmailAsync(string email);
}
