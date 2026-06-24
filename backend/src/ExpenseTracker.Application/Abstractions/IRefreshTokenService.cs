using ExpenseTracker.Domain.Entities;

namespace ExpenseTracker.Application.Abstractions;

public interface IRefreshTokenService
{
    /// <summary>
    /// Generates a new refresh token, persists it, and returns the plaintext token (for the cookie)
    /// along with the entity.
    /// </summary>
    Task<(string PlaintextToken, RefreshToken RefreshToken)> GenerateAsync(Guid userId);

    /// <summary>
    /// Finds an active (non-expired, non-revoked) refresh token by its plaintext value.
    /// Throws RefreshTokenValidationException if not found, expired, or revoked.
    /// </summary>
    Task<RefreshToken> ValidateAsync(string plaintextToken);

    /// <summary>
    /// Rotates the refresh token: revokes the old one, creates a new one.
    /// Returns the new plaintext token and entity.
    /// </summary>
    Task<(string PlaintextToken, RefreshToken RefreshToken)> RotateAsync(RefreshToken currentToken);

    /// <summary>
    /// Revokes the given refresh token.
    /// </summary>
    Task RevokeAsync(RefreshToken token);
}
