namespace ExpenseTracker.Application.Abstractions;

public interface IJwtTokenService
{
    /// <summary>
    /// Generates a signed JWT access token for the given user.
    /// Returns the token string and its expiration time.
    /// </summary>
    JwtTokenResult GenerateToken(Guid userId, string email);
}

public record JwtTokenResult(string Token, DateTimeOffset ExpiresAt);
