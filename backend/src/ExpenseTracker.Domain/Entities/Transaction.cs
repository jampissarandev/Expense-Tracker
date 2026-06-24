using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;

namespace ExpenseTracker.Domain.Entities;

public class Transaction
{
    private const decimal MaxAmount = 999_999_999.99m;

    private Transaction()
    {
    }

    public Transaction(
        Guid userId,
        Guid categoryId,
        TransactionType type,
        decimal amount,
        DateOnly occurredOn,
        string? note = null)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        CategoryId = categoryId;
        Type = type;

        ValidateAmount(amount);
        ValidateOccurredOn(occurredOn);

        Amount = amount;
        OccurredOn = occurredOn;
        Note = note;
        CreatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid CategoryId { get; private set; }
    public TransactionType Type { get; private set; }
    public decimal Amount { get; private set; }
    public DateOnly OccurredOn { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public Category Category { get; private set; } = null!;

    public void Update(
        Guid categoryId,
        TransactionType type,
        decimal amount,
        DateOnly occurredOn,
        string? note)
    {
        ValidateAmount(amount);
        ValidateOccurredOn(occurredOn);

        CategoryId = categoryId;
        Type = type;
        Amount = amount;
        OccurredOn = occurredOn;
        Note = note;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static void ValidateAmount(decimal amount)
    {
        if (amount <= 0)
            throw new DomainValidationException("Amount must be greater than zero.");

        if (amount > MaxAmount)
            throw new DomainValidationException($"Amount must not exceed {MaxAmount}.");
    }

    private static void ValidateOccurredOn(DateOnly occurredOn)
    {
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
        if (occurredOn > today)
            throw new DomainValidationException("Transaction date cannot be in the future.");
    }
}
