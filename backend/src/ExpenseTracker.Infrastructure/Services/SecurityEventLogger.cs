using System.Security.Cryptography;
using System.Text;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExpenseTracker.Infrastructure.Services;

/// <summary>
/// Serilog-backed implementation of <see cref="ISecurityEventLogger"/>.
///
/// Logs are emitted through the ASP.NET Core <see cref="ILogger{TCategoryName}"/>
/// so that Serilog's structured properties flow through the existing pipeline
/// (enriched with MachineName, ThreadId, and — once C1 ships — RequestId).
///
/// Email addresses are never written to the log in raw form. They are
/// normalized (trim + ToLowerInvariant) and SHA-256 hashed; the first 16
/// hex characters of the digest are used as a stable correlation handle.
/// This is sufficient to correlate events for the same email across
/// log entries without exposing the address itself.
/// </summary>
public class SecurityEventLogger : ISecurityEventLogger
{
    private readonly ILogger<SecurityEventLogger> _logger;
    private readonly SecurityEventSettings _settings;

    public SecurityEventLogger(
        ILogger<SecurityEventLogger> logger,
        IOptions<SecurityEventSettings> settings)
    {
        _logger = logger;
        _settings = settings.Value;
    }

    // ==================== Register ====================

    public Task LogRegisterSuccessAsync(Guid userId, string email)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogInformation(
            "Security event: auth.register.success UserId: {UserId} EmailHash: {EmailHash}",
            userId, ComputeEmailHash(email));
        return Task.CompletedTask;
    }

    public Task LogRegisterFailureDuplicateAsync(string email)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogWarning(
            "Security event: auth.register.failure.duplicate EmailHash: {EmailHash}",
            ComputeEmailHash(email));
        return Task.CompletedTask;
    }

    // ==================== Login ====================

    public Task LogLoginSuccessAsync(Guid userId, string email)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogInformation(
            "Security event: auth.login.success UserId: {UserId} EmailHash: {EmailHash}",
            userId, ComputeEmailHash(email));
        return Task.CompletedTask;
    }

    public Task LogLoginFailureUnknownUserAsync(string email)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogWarning(
            "Security event: auth.login.failure.unknown_user EmailHash: {EmailHash}",
            ComputeEmailHash(email));
        return Task.CompletedTask;
    }

    public Task LogLoginFailureBadPasswordAsync(Guid userId, string email)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogWarning(
            "Security event: auth.login.failure.bad_password UserId: {UserId} EmailHash: {EmailHash}",
            userId, ComputeEmailHash(email));
        return Task.CompletedTask;
    }

    // ==================== Refresh ====================

    public Task LogRefreshSuccessAsync(Guid userId, Guid oldTokenId, Guid newTokenId)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogInformation(
            "Security event: auth.refresh.success UserId: {UserId} OldTokenId: {OldTokenId} NewTokenId: {NewTokenId}",
            userId, oldTokenId, newTokenId);
        return Task.CompletedTask;
    }

    public Task LogRefreshFailureAsync(Guid? tokenId, string reason)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        if (tokenId.HasValue)
        {
            _logger.LogWarning(
                "Security event: auth.refresh.failure.invalid TokenId: {TokenId} Reason: {Reason}",
                tokenId.Value, reason);
        }
        else
        {
            _logger.LogWarning(
                "Security event: auth.refresh.failure.invalid Reason: {Reason}",
                reason);
        }
        return Task.CompletedTask;
    }

    // ==================== Logout ====================

    public Task LogLogoutSuccessAsync(Guid userId, Guid tokenId)
    {
        if (!IsEnabled()) return Task.CompletedTask;
        _logger.LogInformation(
            "Security event: auth.logout.success UserId: {UserId} TokenId: {TokenId}",
            userId, tokenId);
        return Task.CompletedTask;
    }

    // ==================== Helpers ====================

    private bool IsEnabled() => _settings.Enabled;

    /// <summary>
    /// Returns the first 16 hex characters (64 bits) of SHA-256(normalized email).
    /// The full 256-bit digest is overkill for log correlation; 64 bits is
    /// ~1.8 × 10^19 possible values — collision-resistant for the scale of
    /// any single application.
    /// </summary>
    internal static string ComputeEmailHash(string email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
    }
}
