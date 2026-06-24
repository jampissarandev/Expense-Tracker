using ExpenseTracker.Application.Abstractions;

namespace ExpenseTracker.Infrastructure.Services;

public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string HashPassword(string plaintext)
    {
        return BCrypt.Net.BCrypt.HashPassword(plaintext, WorkFactor);
    }

    public bool VerifyPassword(string plaintext, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(plaintext, hash);
    }
}
