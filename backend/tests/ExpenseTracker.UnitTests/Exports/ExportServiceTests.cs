using System.Text;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Application.Exports;
using ExpenseTracker.Application.Transactions;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Enums;
using FluentAssertions;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Exports;

[Trait("Category", "Exports")]
public class ExportServiceTests
{
    private static readonly Guid TestUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static readonly string[] LineSeparators = { "\r\n", "\n" };

    private readonly ITransactionService _transactionService = Substitute.For<ITransactionService>();
    private readonly IDashboardService _dashboardService = Substitute.For<IDashboardService>();
    private readonly IExportService _sut;

    public ExportServiceTests()
    {
        _sut = new ExportService(_transactionService, _dashboardService);
    }

    private static TransactionDto MakeTx(
        string categoryName = "Food",
        TransactionType type = TransactionType.Expense,
        string amount = "150.50",
        DateOnly? occurredOn = null,
        string? note = "Lunch")
    {
        return new TransactionDto(
            Id: Guid.NewGuid(),
            CategoryId: Guid.NewGuid(),
            CategoryName: categoryName,
            Type: type,
            Amount: amount,
            OccurredOn: occurredOn ?? new DateOnly(2026, 6, 15),
            Note: note,
            CreatedAt: new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero),
            UpdatedAt: new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.Zero));
    }

    private static MonthlyTotalDto MakeMonthlyTotal(int year, int month, decimal income, decimal expense)
    {
        return new MonthlyTotalDto(year, month, income, expense);
    }

    private static DashboardSummaryDto MakeSummary(
        decimal income = 50_000m,
        decimal expense = 30_000m,
        List<MonthlyTotalDto>? months = null)
    {
        var currentMonth = new CurrentMonthDto(income, expense, income - expense, 2026, 6);
        var last6 = months ?? new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 1, 50_000m, 30_000m),
            MakeMonthlyTotal(2026, 2, 50_000m, 28_000m),
            MakeMonthlyTotal(2026, 3, 52_000m, 35_000m),
            MakeMonthlyTotal(2026, 4, 0m, 0m),
            MakeMonthlyTotal(2026, 5, 0m, 0m),
            MakeMonthlyTotal(2026, 6, 0m, 0m),
        };
        var byCategory = new List<CategoryTotalDto>
        {
            new(Guid.NewGuid(), "Food", 15_000m, 20),
        };
        return new DashboardSummaryDto(currentMonth, last6, byCategory);
    }

    private static string Csv(MemoryStream stream)
    {
        return Encoding.UTF8.GetString(stream.ToArray())
            .Replace("\r\n", "\n")
            .Replace("\r", "");
    }

    private static string[] Lines(MemoryStream stream)
    {
        return Csv(stream).Split(LineSeparators, StringSplitOptions.RemoveEmptyEntries);
    }

    // ==================== Transactions CSV ====================

    [Fact]
    public async Task Transactions_csv_starts_with_utf8_bom()
    {
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { MakeTx() },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var bytes = stream.ToArray();

        bytes.Should().HaveCountGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);
    }

    [Fact]
    public async Task Transactions_csv_contains_expected_headers()
    {
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { MakeTx() },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var header = Lines(stream)[0];

        header.Should().Contain("วันที่");
        header.Should().Contain("ประเภท");
        header.Should().Contain("หมวดหมู่");
        header.Should().Contain("จำนวนเงิน");
        header.Should().Contain("หมายเหตุ");
    }

    [Fact]
    public async Task Transactions_csv_contains_expected_rows()
    {
        var tx1 = MakeTx(categoryName: "Food", type: TransactionType.Expense, amount: "150.50",
            occurredOn: new DateOnly(2026, 6, 15), note: "Lunch");
        var tx2 = MakeTx(categoryName: "Salary", type: TransactionType.Income, amount: "50000.00",
            occurredOn: new DateOnly(2026, 6, 1), note: "Monthly salary");

        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx1, tx2 },
                1, 20, 2, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var lines = Lines(stream);

        lines.Should().HaveCount(3);
        lines[1].Should().Contain("2026-06-15");
        lines[1].Should().Contain("ค่าใช้จ่าย");
        lines[1].Should().Contain("Food");
        lines[1].Should().Contain("150.50");
        lines[1].Should().Contain("Lunch");

        lines[2].Should().Contain("2026-06-01");
        lines[2].Should().Contain("รายรับ");
        lines[2].Should().Contain("Salary");
        lines[2].Should().Contain("50000.00");
    }

    [Fact]
    public async Task Transactions_csv_passes_filter_to_service()
    {
        var filter = new TransactionFilter
        {
            Type = TransactionType.Income,
            CategoryId = Guid.NewGuid(),
            From = new DateOnly(2026, 1, 1),
            To = new DateOnly(2026, 6, 30)
        };

        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto>(),
                1, 20, 0, 0));

        await _sut.BuildTransactionsCsvAsync(TestUserId, filter);

        await _transactionService.Received(1).ListAsync(TestUserId, Arg.Is<TransactionFilter>(f =>
            f.Type == TransactionType.Income &&
            f.CategoryId == filter.CategoryId &&
            f.From == filter.From &&
            f.To == filter.To));
    }

    [Fact]
    public async Task Transactions_csv_empty_result_returns_only_headers()
    {
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto>(),
                1, 20, 0, 0));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        Lines(stream).Should().HaveCount(1);
    }

    // ==================== Summary CSV ====================

    [Fact]
    public async Task Summary_csv_starts_with_utf8_bom()
    {
        _dashboardService.GetSummaryAsync(TestUserId, Arg.Any<TransactionType?>())
            .Returns(MakeSummary());

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, null);
        var bytes = stream.ToArray();

        bytes.Should().HaveCountGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);
    }

    [Fact]
    public async Task Summary_csv_contains_expected_headers()
    {
        _dashboardService.GetSummaryAsync(TestUserId, Arg.Any<TransactionType?>())
            .Returns(MakeSummary());

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, null);
        var header = Lines(stream)[0];

        header.Should().Contain("เดือน");
        header.Should().Contain("รายรับ");
        header.Should().Contain("รายจ่าย");
        header.Should().Contain("คงเหลือ");
    }

    [Fact]
    public async Task Summary_csv_contains_monthly_totals_with_balance()
    {
        var months = new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 1, 50_000m, 30_000m),
            MakeMonthlyTotal(2026, 2, 50_000m, 28_000m),
        };
        _dashboardService.GetSummaryAsync(TestUserId, Arg.Any<TransactionType?>())
            .Returns(MakeSummary(income: 50_000m, expense: 30_000m, months: months));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, null);
        var lines = Lines(stream);

        lines.Should().HaveCount(3);
        lines[1].Should().Contain("2026-01");
        lines[1].Should().Contain("50000.00");
        lines[1].Should().Contain("30000.00");
        lines[1].Should().Contain("20000.00");

        lines[2].Should().Contain("2026-02");
        lines[2].Should().Contain("22000.00");
    }

    // ==================== CSV injection sanitization ====================

    [Theory]
    [InlineData("=SUM(A1:A10)")]
    [InlineData("+cmd|'/C calc'!A0")]
    [InlineData("-1+2")]
    [InlineData("@SUM(A1)")]
    public async Task Transactions_csv_sanitizes_injection_prone_cells(string maliciousNote)
    {
        var tx = MakeTx(note: maliciousNote);
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var lines = Lines(stream);
        var dataLine = lines[1];
        var lastField = dataLine.Split(',').Last().Trim('"');

        lastField.Should().StartWith("'");
        lastField.Should().Be($"'{maliciousNote}");
    }

    [Fact]
    public async Task Transactions_csv_does_not_prefix_safe_cells()
    {
        var tx = MakeTx(note: "Normal lunch note");
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var csv = Csv(stream);

        csv.Should().Contain("Normal lunch note");
        csv.Should().NotContain("'Normal lunch note");
    }

    [Fact]
    public async Task Transactions_csv_amount_not_prefixed_even_if_starts_with_minus()
    {
        var tx = MakeTx(amount: "1234.56");
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var csv = Csv(stream);

        csv.Should().Contain("1234.56");
    }

    [Theory]
    [InlineData("\tinjected")]
    [InlineData("\rinjected")]
    [InlineData("=1+1")]
    [InlineData("+evil")]
    [InlineData("-evil")]
    [InlineData("@evil")]
    public async Task Transactions_csv_sanitizes_all_injection_prone_prefixes(string maliciousNote)
    {
        var tx = MakeTx(note: maliciousNote);
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var bytes = stream.ToArray();
        // Inspect the raw byte stream (the helper `Csv()` strips CR).
        // After sanitization, the byte sequence for `'<original>` MUST
        // appear in the stream. Tab is encoded as 0x09, CR as 0x0D.
        var raw = System.Text.Encoding.UTF8.GetString(bytes);
        var expected = "'" + maliciousNote;
        raw.Should().Contain(expected);
        // And the malicious note must NOT appear unprefixed at the start of
        // a CSV cell (after a comma, the boundary between fields).
        var unprefixed = "," + maliciousNote + ",";
        // Only check printable prefixes; for control chars (tab/CR) we skip
        // because the Csv helper's String.Replace changes the boundary.
        if (!maliciousNote.StartsWith("\t") && !maliciousNote.StartsWith("\r"))
        {
            raw.Should().NotContain(unprefixed);
        }
    }

    [Fact]
    public async Task Transactions_csv_with_null_note_does_not_throw()
    {
        var tx = MakeTx(note: null);
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var lines = Lines(stream);

        lines.Should().HaveCount(2);
        // The last (Note) field should be the empty string between two quotes.
        var fields = lines[1].Split(',');
        fields[^1].Should().Be("\"\"");
    }

    [Fact]
    public async Task Transactions_csv_with_empty_note_does_not_throw()
    {
        var tx = MakeTx(note: string.Empty);
        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto> { tx },
                1, 20, 1, 1));

        using var stream = await _sut.BuildTransactionsCsvAsync(TestUserId, new TransactionFilter());
        var lines = Lines(stream);

        lines.Should().HaveCount(2);
    }

    [Fact]
    public async Task Transactions_csv_passes_date_range_filter_to_service()
    {
        var filter = new TransactionFilter
        {
            From = new DateOnly(2026, 1, 1),
            To = new DateOnly(2026, 6, 30)
        };

        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto>(),
                1, 20, 0, 0));

        await _sut.BuildTransactionsCsvAsync(TestUserId, filter);

        await _transactionService.Received(1).ListAsync(TestUserId, Arg.Is<TransactionFilter>(f =>
            f.From == filter.From &&
            f.To == filter.To &&
            f.Page == 1 &&
            f.PageSize == int.MaxValue));
    }

    [Fact]
    public async Task Transactions_csv_overrides_paging_to_fetch_all_rows()
    {
        var filter = new TransactionFilter
        {
            Page = 5,
            PageSize = 10
        };

        _transactionService.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns(new PagedResult<TransactionDto>(
                new List<TransactionDto>(),
                1, 20, 0, 0));

        await _sut.BuildTransactionsCsvAsync(TestUserId, filter);

        // The export must request page 1 with the maximum page size so the
        // full result set is returned, regardless of the caller's paging.
        await _transactionService.Received(1).ListAsync(TestUserId, Arg.Is<TransactionFilter>(f =>
            f.Page == 1 && f.PageSize == int.MaxValue));
    }

    // ==================== Summary date range ====================

    [Fact]
    public async Task Summary_csv_filters_by_from_date()
    {
        var months = new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 1, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 3, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 5, 10_000m, 5_000m),
        };
        _dashboardService.GetSummaryAsync(TestUserId)
            .Returns(MakeSummary(months: months));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, new DateOnly(2026, 3, 1), null);
        var lines = Lines(stream);

        // 1 header + 2 data rows (March + May, January is filtered out)
        lines.Should().HaveCount(3);
        lines[1].Should().Contain("2026-03");
        lines[2].Should().Contain("2026-05");
        lines.Should().NotContain(l => l.Contains("2026-01"));
    }

    [Fact]
    public async Task Summary_csv_filters_by_to_date()
    {
        var months = new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 1, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 3, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 5, 10_000m, 5_000m),
        };
        _dashboardService.GetSummaryAsync(TestUserId)
            .Returns(MakeSummary(months: months));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, new DateOnly(2026, 3, 31));
        var lines = Lines(stream);

        // 1 header + 2 data rows (January + March, May is filtered out)
        lines.Should().HaveCount(3);
        lines[1].Should().Contain("2026-01");
        lines[2].Should().Contain("2026-03");
        lines.Should().NotContain(l => l.Contains("2026-05"));
    }

    [Fact]
    public async Task Summary_csv_filters_by_both_from_and_to()
    {
        var months = new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 1, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 2, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 3, 10_000m, 5_000m),
            MakeMonthlyTotal(2026, 4, 10_000m, 5_000m),
        };
        _dashboardService.GetSummaryAsync(TestUserId)
            .Returns(MakeSummary(months: months));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, new DateOnly(2026, 2, 1), new DateOnly(2026, 3, 31));
        var lines = Lines(stream);

        lines.Should().HaveCount(3);
        lines[1].Should().Contain("2026-02");
        lines[2].Should().Contain("2026-03");
    }

    [Fact]
    public async Task Summary_csv_with_no_months_returns_only_headers()
    {
        _dashboardService.GetSummaryAsync(TestUserId)
            .Returns(MakeSummary(months: new List<MonthlyTotalDto>()));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, null);
        var lines = Lines(stream);

        lines.Should().HaveCount(1);
        lines[0].Should().Contain("เดือน");
    }

    [Fact]
    public async Task Summary_csv_balance_is_income_minus_expense()
    {
        var months = new List<MonthlyTotalDto>
        {
            MakeMonthlyTotal(2026, 6, 75_500m, 23_250m),
        };
        _dashboardService.GetSummaryAsync(TestUserId)
            .Returns(MakeSummary(months: months));

        using var stream = await _sut.BuildSummaryCsvAsync(TestUserId, null, null);
        var lines = Lines(stream);
        var fields = lines[1].Split(',');

        fields[1].Should().Contain("75500.00");
        fields[2].Should().Contain("23250.00");
        fields[3].Should().Contain("52250.00"); // 75500 - 23250
    }
}
