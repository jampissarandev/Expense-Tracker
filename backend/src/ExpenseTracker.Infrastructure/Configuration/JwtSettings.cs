namespace ExpenseTracker.Infrastructure.Configuration;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// The secret key used to sign JWT tokens. Must be at least 32 characters.
    /// </summary>
    public string SecretKey { get; set; } = null!;

    /// <summary>
    /// The issuer of the JWT token.
    /// </summary>
    public string Issuer { get; set; } = "ExpenseTracker";

    /// <summary>
    /// The audience of the JWT token.
    /// </summary>
    public string Audience { get; set; } = "ExpenseTracker";

    /// <summary>
    /// Access token lifetime in minutes.
    /// </summary>
    public int AccessTokenExpirationMinutes { get; set; } = 15;
}
