using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Application.Transactions;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Exports;

public class ExportService : IExportService
{
    private readonly ITransactionService _transactionService;
    private readonly IDashboardService _dashboardService;

    public ExportService(ITransactionService transactionService, IDashboardService dashboardService)
    {
        _transactionService = transactionService;
        _dashboardService = dashboardService;
    }

    public async Task<MemoryStream> BuildTransactionsCsvAsync(Guid userId, TransactionFilter filter)
    {
        // Fetch ALL matching transactions (no pagination).
        var allFilter = filter with { Page = 1, PageSize = int.MaxValue };
        var result = await _transactionService.ListAsync(userId, allFilter);

        var rows = result.Items.Select(tx => new TransactionCsvRow(
            Date: tx.OccurredOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Type: tx.Type == TransactionType.Income ? "รายรับ" : "ค่าใช้จ่าย",
            Category: SanitizeForCsvInjection(tx.CategoryName)!,
            Amount: tx.Amount,
            Note: SanitizeForCsvInjection(tx.Note)
        )).ToList();

        return WriteCsv(rows, "วันที่,ประเภท,หมวดหมู่,จำนวนเงิน,หมายเหตุ");
    }

    public async Task<MemoryStream> BuildSummaryCsvAsync(Guid userId, DateOnly? from, DateOnly? to)
    {
        var summary = await _dashboardService.GetSummaryAsync(userId);
        var months = summary.Last6Months;

        if (from.HasValue)
            months = months.Where(m => new DateOnly(m.Year, m.Month, 1) >= from.Value).ToList();
        if (to.HasValue)
            months = months.Where(m => new DateOnly(m.Year, m.Month, DateTime.DaysInMonth(m.Year, m.Month)) <= to.Value).ToList();

        var rows = months.Select(m => new SummaryCsvRow(
            Month: $"{m.Year:D4}-{m.Month:D2}",
            Income: m.Income.ToString("F2", CultureInfo.InvariantCulture),
            Expense: m.Expense.ToString("F2", CultureInfo.InvariantCulture),
            Balance: (m.Income - m.Expense).ToString("F2", CultureInfo.InvariantCulture)
        )).ToList();

        return WriteCsv(rows, "เดือน,รายรับ,รายจ่าย,คงเหลือ");
    }

    private static MemoryStream WriteCsv<T>(IReadOnlyList<T> rows, string headerLine)
    {
        var stream = new MemoryStream();
        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = false, // We write header manually for UTF-8 BOM control
            ShouldQuote = _ => true,
        };

        // Write UTF-8 BOM
        stream.Write([0xEF, 0xBB, 0xBF], 0, 3);

        using (var writer = new StreamWriter(stream, encoding, leaveOpen: true))
        using (var csv = new CsvWriter(writer, config))
        {
            // Write header as raw line
            writer.Write(headerLine);
            writer.Write('\n');
            writer.Flush();

            // Write data rows
            foreach (var row in rows)
            {
                csv.WriteRecord(row);
                csv.NextRecord();
            }
        }

        stream.Position = 0;
        return stream;
    }

    /// <summary>
    /// Prefix with single-quote if the cell content starts with a
    /// CSV-injection-prone character (=, +, -, @, tab, CR).
    /// </summary>
    private static string? SanitizeForCsvInjection(string? cell)
    {
        if (string.IsNullOrEmpty(cell))
            return cell;

        return cell[0] is '=' or '+' or '-' or '@' or '\t' or '\r'
            ? $"'{cell}"
            : cell;
    }

    private sealed record TransactionCsvRow(
        string Date,
        string Type,
        string Category,
        string Amount,
        string? Note);

    private sealed record SummaryCsvRow(
        string Month,
        string Income,
        string Expense,
        string Balance);
}
