namespace ExpenseTracker.Infrastructure.Configuration;

/// <summary>
/// Toggles and policy for <c>ISecurityEventLogger</c>.
/// </summary>
public class SecurityEventSettings
{
    public const string SectionName = "SecurityEvents";

    /// <summary>
    /// When false, every <c>Log*</c> call is a no-op.
    /// Default: true. In high-volume environments, set to false and rely on
    /// the standard request log instead.
    /// </summary>
    public bool Enabled { get; set; } = true;
}
