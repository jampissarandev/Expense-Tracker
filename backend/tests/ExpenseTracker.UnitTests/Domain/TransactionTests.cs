using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;

namespace ExpenseTracker.UnitTests.Domain;

public class TransactionTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _categoryId = Guid.NewGuid();

    [Fact]
    public void Transaction_Update_validates_amount_positive()
    {
        // Arrange
        var transaction = new Transaction(
            _userId,
            _categoryId,
            TransactionType.Expense,
            100m,
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date));

        // Act
        var act = () => transaction.Update(_categoryId, TransactionType.Expense, 0m, DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        // Assert
        act.Should().Throw<DomainValidationException>()
            .WithMessage("Amount must be greater than zero.");
    }

    [Fact]
    public void Transaction_Update_rejects_future_date()
    {
        // Arrange
        var transaction = new Transaction(
            _userId,
            _categoryId,
            TransactionType.Expense,
            100m,
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date));
        var futureDate = DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date.AddDays(1));

        // Act
        var act = () => transaction.Update(_categoryId, TransactionType.Expense, 100m, futureDate, null);

        // Assert
        act.Should().Throw<DomainValidationException>()
            .WithMessage("Transaction date cannot be in the future.");
    }
}
