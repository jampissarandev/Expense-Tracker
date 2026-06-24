namespace ExpenseTracker.Infrastructure.Configuration;

public class RefreshTokenSettings
{
    public const string SectionName = "RefreshToken";

    /// <summary>
    /// Refresh token lifetime in days.
    /// </summary>
    public int ExpirationDays { get; set; } = 7;

    /// <summary>
    /// Length of the generated random token in bytes.
    /// </summary>
    public int TokenLengthBytes { get; set; } = 40;
}
