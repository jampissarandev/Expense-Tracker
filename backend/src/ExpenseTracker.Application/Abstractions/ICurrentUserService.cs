namespace ExpenseTracker.Application.Abstractions;

public interface ICurrentUserService
{
    Guid? UserId { get; }
}
