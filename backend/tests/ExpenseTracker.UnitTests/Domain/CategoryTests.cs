using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using FluentAssertions;

namespace ExpenseTracker.UnitTests.Domain;

public class CategoryTests
{
    [Fact]
    public void Category_Rename_normalizes_whitespace_and_truncates()
    {
        // Arrange
        var category = new Category("Food", TransactionType.Expense);
        var longName = new string('a', 60);

        // Act
        category.Rename("  Coffee   &   Tea  ");

        // Assert
        category.Name.Should().Be("Coffee & Tea");

        // Truncation
        category.Rename(longName);
        category.Name.Should().HaveLength(50);
    }
}
