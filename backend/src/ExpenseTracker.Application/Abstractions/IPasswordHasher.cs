namespace ExpenseTracker.Application.Abstractions;

public interface IPasswordHasher
{
    string HashPassword(string plaintext);
    bool VerifyPassword(string plaintext, string hash);
}
