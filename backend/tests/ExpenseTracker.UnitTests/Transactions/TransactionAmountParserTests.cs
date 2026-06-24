using ExpenseTracker.Application.Transactions.Validators;
using FluentAssertions;

namespace ExpenseTracker.UnitTests.Transactions;

public class TransactionAmountParserTests
{
    [Theory]
    [Trait("Category", "Transactions")]
    [InlineData("0.01")]
    [InlineData("1")]
    [InlineData("1234.56")]
    [InlineData("999999999.99")]
    [InlineData("100.00")]
    public void ParseStrict_accepts_valid_amounts(string raw)
    {
        var result = TransactionAmountParser.ParseStrict(raw);
        result.Should().BeGreaterThan(0);
    }

    [Theory]
    [Trait("Category", "Transactions")]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void ParseStrict_rejects_blank(string? raw)
    {
        var act = () => TransactionAmountParser.ParseStrict(raw!);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [Trait("Category", "Transactions")]
    [InlineData("abc")]
    [InlineData("1,234.56")] // invariant culture rejects thousands separator
    [InlineData("1.234")]     // 3 decimal places
    [InlineData("1.2345")]    // 4 decimal places
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("-0.01")]
    [InlineData("1000000000.00")] // > MaxAmount
    [InlineData("999999999.999")] // 3 decimals AND > MaxAmount
    public void ParseStrict_rejects_invalid(string raw)
    {
        var act = () => TransactionAmountParser.ParseStrict(raw);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [Trait("Category", "Transactions")]
    [InlineData("1234.56", true)]
    [InlineData("0.01", true)]
    [InlineData("1", true)]
    [InlineData("", false)]
    [InlineData("abc", false)]
    [InlineData("-1", false)]
    [InlineData("1.234", false)]
    public void TryParse_matches_expectations(string raw, bool expected)
    {
        TransactionAmountParser.TryParse(raw).Should().Be(expected);
    }
}
