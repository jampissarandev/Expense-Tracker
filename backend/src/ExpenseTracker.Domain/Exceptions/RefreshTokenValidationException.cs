namespace ExpenseTracker.Domain.Exceptions;

public class RefreshTokenValidationException : DomainException
{
    public RefreshTokenValidationException(string message) : base(message)
    {
    }
}
