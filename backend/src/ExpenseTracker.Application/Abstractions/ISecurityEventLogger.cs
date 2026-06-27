namespace ExpenseTracker.Application.Abstractions;

/// <summary>
/// Structured security-event logger for OWASP A09 (Security Logging &amp; Monitoring Failures).
/// Emits dedicated events for register/login/refresh/logout so that brute-force
/// attacks, account enumeration, and suspicious activity are observable from
/// Serilog output without log-file grepping.
///
/// PII policy: emails are SHA-256 hashed (first 16 hex chars, lowercased + trimmed
/// before hashing) — never logged in raw form. Token ids and user ids are
/// non-PII correlation handles and are logged in full.
/// </summary>
public interface ISecurityEventLogger
{
    // Register
    Task LogRegisterSuccessAsync(Guid userId, string email);
    Task LogRegisterFailureDuplicateAsync(string email);

    // Login
    Task LogLoginSuccessAsync(Guid userId, string email);
    Task LogLoginFailureUnknownUserAsync(string email);
    Task LogLoginFailureBadPasswordAsync(Guid userId, string email);

    // Refresh
    Task LogRefreshSuccessAsync(Guid userId, Guid oldTokenId, Guid newTokenId);
    Task LogRefreshFailureAsync(Guid? tokenId, string reason);

    // Logout
    Task LogLogoutSuccessAsync(Guid userId, Guid tokenId);
}
