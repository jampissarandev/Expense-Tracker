using ExpenseTracker.Application.Transactions.Filters;

namespace ExpenseTracker.Application.Exports;

public interface IExportService
{
    /// <summary>
    /// Builds a transactions CSV with UTF-8 BOM, content-type-safe headers,
    /// and CSV-injection sanitization.
    /// </summary>
    Task<MemoryStream> BuildTransactionsCsvAsync(Guid userId, TransactionFilter filter);

    /// <summary>
    /// Builds a monthly summary CSV with income, expense, and balance columns.
    /// </summary>
    Task<MemoryStream> BuildSummaryCsvAsync(Guid userId, DateOnly? from, DateOnly? to);
}
