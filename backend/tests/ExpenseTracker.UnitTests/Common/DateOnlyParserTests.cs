using ExpenseTracker.Application.Common;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;

namespace ExpenseTracker.UnitTests.Common;

[Trait("Category", "Common")]
public class DateOnlyParserTests
{
    // ── Valid inputs ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("2026-06-27", 2026, 6, 27)]
    [InlineData("1970-01-01", 1970, 1, 1)]
    [InlineData("2099-12-31", 2099, 12, 31)]
    public void Parse_accepts_iso_yyyy_mm_dd(string raw, int year, int month, int day)
    {
        var result = DateOnlyParser.Parse(raw);

        result.Should().Be(new DateOnly(year, month, day));
    }

    // ── Null / empty / whitespace (optional, returns null) ──────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public void Parse_returns_null_for_blank_input(string? raw)
    {
        var result = DateOnlyParser.Parse(raw);

        result.Should().BeNull();
    }

    // ── Invalid inputs (throws DomainValidationException → HTTP 400) ────────
    //
    // The parser is intentionally strict: it only accepts the canonical
    // `yyyy-MM-dd` form. Strings that clearly do not represent a date, or
    // that look date-ish but use the wrong format/order, must be rejected
    // so the global exception middleware can return HTTP 400.
    //
    // Note: locale-dependent formats (e.g. `06/27/2026`, `2026-6-1`) are
    // intentionally NOT covered here because `DateOnly.TryParse` may accept
    // them under the InvariantCulture; the API contract only requires
    // strict ISO and a clean 400 on anything that is not a recognizable
    // date.

    [Theory]
    [InlineData("not-a-date")]
    [InlineData("27-06-2026")]    // wrong order (DD-MM-YYYY)
    [InlineData("26-06-27")]      // 2-digit year
    [InlineData("hello world")]
    [InlineData("12345")]
    public void Parse_throws_DomainValidationException_for_invalid_input(string raw)
    {
        var act = () => DateOnlyParser.Parse(raw);

        act.Should().Throw<DomainValidationException>()
           .WithMessage($"*'{raw}'*");
    }

    [Fact]
    [Trait("Category", "Common")]
    public void Parse_throws_with_actionable_error_message()
    {
        var act = () => DateOnlyParser.Parse("garbage");

        act.Should().Throw<DomainValidationException>()
           .WithMessage("*yyyy-MM-dd*");
    }
}

