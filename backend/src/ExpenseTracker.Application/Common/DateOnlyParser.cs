using System.Globalization;
using ExpenseTracker.Domain.Exceptions;

namespace ExpenseTracker.Application.Common;

/// <summary>
/// Parses user-supplied date strings into <see cref="DateOnly"/>.
/// Single source of truth for both <c>TransactionsController</c> and
/// <c>ExportsController</c> (R-1). Always throws
/// <see cref="DomainValidationException"/> on invalid input so the global
/// exception middleware maps the error to HTTP 400 (Bad Request) instead
/// of HTTP 500.
/// </summary>
public static class DateOnlyParser
{
    /// <summary>
    /// Parse <paramref name="raw"/> as a <see cref="DateOnly"/>.
    /// Returns <c>null</c> for null, empty, or whitespace input.
    /// Throws <see cref="DomainValidationException"/> for unrecognised formats
    /// (mapped to HTTP 400 by the global exception middleware).
    /// </summary>
    /// <remarks>
    /// Accepts:
    ///   - ISO date: <c>yyyy-MM-dd</c>
    ///   - Full ISO 8601 datetime: <c>yyyy-MM-ddTHH:mm:ss[Z|+HH:MM]</c>
    /// Uses <see cref="CultureInfo.InvariantCulture"/> so behaviour does not
    /// depend on the server locale.
    /// </remarks>
    public static DateOnly? Parse(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        // Strict ISO date first (most common case, fastest path).
        if (DateOnly.TryParseExact(
                raw,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var dateOnly))
        {
            return dateOnly;
        }

        // Fall back to TryParse which accepts ISO 8601 datetimes and the
        // yyyy-MM-dd form already handled above (cheap duplicate).
        if (DateOnly.TryParse(
                raw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out dateOnly))
        {
            return dateOnly;
        }

        throw new DomainValidationException(
            $"Date '{raw}' is not in a recognized format. Use yyyy-MM-dd.");
    }
}
