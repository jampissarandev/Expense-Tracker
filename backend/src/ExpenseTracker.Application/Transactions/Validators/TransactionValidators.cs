using ExpenseTracker.Application.Transactions.DTOs;
using FluentValidation;

namespace ExpenseTracker.Application.Transactions.Validators;

/// <summary>
/// Parses a user-supplied amount string into a validated decimal.
/// Rules:
///   * must be parseable as decimal
///   * must use invariant culture (no "1,23" / "1 234,56")
///   * must have at most 2 decimal places
///   * must be > 0 and <= 999_999_999.99
/// </summary>
public static class TransactionAmountParser
{
    public const decimal MaxAmount = 999_999_999.99m;

    public static decimal ParseStrict(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            throw new ArgumentException("Amount is required.", nameof(raw));

        // Use invariant culture with NumberStyles.Float: rejects thousands
        // separators and currency symbols, accepts a single optional decimal
        // point. Stricter than NumberStyles.Number which would parse
        // "1,234.56" as 1234.56 and treat the comma as a group separator.
        if (!decimal.TryParse(
                raw,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var value))
        {
            throw new ArgumentException(
                $"Amount '{raw}' is not a valid decimal number.",
                nameof(raw));
        }

        if (value <= 0)
            throw new ArgumentException("Amount must be greater than zero.", nameof(raw));

        if (value > MaxAmount)
            throw new ArgumentException($"Amount must not exceed {MaxAmount}.", nameof(raw));

        // Cap at 2 decimal places by inspecting the decimal's scale
        // (bits[3] >> 16 & 0xFF). decimal.Round is unreliable here because
        // 1.234m may compare equal to 1.23m depending on binary repr.
        var scale = (decimal.GetBits(value)[3] >> 16) & 0xFF;
        if (scale > 2)
        {
            throw new ArgumentException(
                $"Amount '{raw}' has more than 2 decimal places.",
                nameof(raw));
        }

        return value;
    }

    public static bool TryParse(string raw)
    {
        try
        {
            _ = ParseStrict(raw);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}

public class CreateTransactionRequestValidator : AbstractValidator<CreateTransactionRequest>
{
    public CreateTransactionRequestValidator()
    {
        RuleFor(x => x.CategoryId)
            .NotEqual(Guid.Empty)
            .WithMessage("CategoryId is required.");

        RuleFor(x => x.Type)
            .IsInEnum()
            .WithMessage("Type must be a valid TransactionType (Income or Expense).");

        RuleFor(x => x.Amount)
            .NotEmpty()
            .WithMessage("Amount is required.")
            .Must(TransactionAmountParser.TryParse)
            .WithMessage("Amount must be a positive number with at most 2 decimal places (e.g. '1234.56').");

        RuleFor(x => x.OccurredOn)
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date))
            .WithMessage("Transaction date cannot be in the future.");

        RuleFor(x => x.Note)
            .MaximumLength(500)
            .When(x => x.Note is not null)
            .WithMessage("Note must be 500 characters or fewer.");
    }
}

public class UpdateTransactionRequestValidator : AbstractValidator<UpdateTransactionRequest>
{
    public UpdateTransactionRequestValidator()
    {
        RuleFor(x => x.CategoryId)
            .NotEqual(Guid.Empty)
            .WithMessage("CategoryId is required.");

        RuleFor(x => x.Type)
            .IsInEnum()
            .WithMessage("Type must be a valid TransactionType (Income or Expense).");

        RuleFor(x => x.Amount)
            .NotEmpty()
            .WithMessage("Amount is required.")
            .Must(TransactionAmountParser.TryParse)
            .WithMessage("Amount must be a positive number with at most 2 decimal places (e.g. '1234.56').");

        RuleFor(x => x.OccurredOn)
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date))
            .WithMessage("Transaction date cannot be in the future.");

        RuleFor(x => x.Note)
            .MaximumLength(500)
            .When(x => x.Note is not null)
            .WithMessage("Note must be 500 characters or fewer.");
    }
}
