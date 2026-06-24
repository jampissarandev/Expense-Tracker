using System.Security.Cryptography;
using System.Text;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Exceptions;
using ExpenseTracker.Infrastructure.Configuration;
using ExpenseTracker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ExpenseTracker.Infrastructure.Services;

public class RefreshTokenService : IRefreshTokenService
{
    private readonly ExpenseTrackerDbContext _dbContext;
    private readonly RefreshTokenSettings _settings;

    public RefreshTokenService(
        ExpenseTrackerDbContext dbContext,
        IOptions<RefreshTokenSettings> settings)
    {
        _dbContext = dbContext;
        _settings = settings.Value;
    }

    public async Task<(string PlaintextToken, RefreshToken RefreshToken)> GenerateAsync(Guid userId)
    {
        // Generate cryptographically secure random token
        var tokenBytes = RandomNumberGenerator.GetBytes(_settings.TokenLengthBytes);
        var plaintextToken = Convert.ToBase64String(tokenBytes);
        var tokenHash = ComputeHash(plaintextToken);

        var expiresAt = DateTimeOffset.UtcNow.AddDays(_settings.ExpirationDays);
        var refreshToken = new RefreshToken(userId, tokenHash, expiresAt);

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync();

        return (plaintextToken, refreshToken);
    }

    public async Task<RefreshToken> ValidateAsync(string plaintextToken)
    {
        var tokenHash = ComputeHash(plaintextToken);

        var refreshToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);

        if (refreshToken is null)
            throw new RefreshTokenValidationException("Refresh token not found.");

        if (refreshToken.IsRevoked)
            throw new RefreshTokenValidationException("Token has been revoked.");

        if (refreshToken.IsExpired)
            throw new RefreshTokenValidationException("Token has expired.");

        return refreshToken;
    }

    public async Task<(string PlaintextToken, RefreshToken RefreshToken)> RotateAsync(RefreshToken currentToken)
    {
        // Generate new token
        var tokenBytes = RandomNumberGenerator.GetBytes(_settings.TokenLengthBytes);
        var newPlaintextToken = Convert.ToBase64String(tokenBytes);
        var newTokenHash = ComputeHash(newPlaintextToken);

        var expiresAt = DateTimeOffset.UtcNow.AddDays(_settings.ExpirationDays);
        var newRefreshToken = new RefreshToken(currentToken.UserId, newTokenHash, expiresAt);

        // Revoke the old token with reference to the new one
        currentToken.Revoke(newRefreshToken.Id);

        _dbContext.RefreshTokens.Add(newRefreshToken);
        await _dbContext.SaveChangesAsync();

        return (newPlaintextToken, newRefreshToken);
    }

    public async Task RevokeAsync(RefreshToken token)
    {
        token.Revoke();
        await _dbContext.SaveChangesAsync();
    }

    private static string ComputeHash(string plaintext)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToBase64String(bytes);
    }
}
