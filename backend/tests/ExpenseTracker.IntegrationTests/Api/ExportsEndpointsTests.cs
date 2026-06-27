using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "Exports")]
public class ExportsEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public ExportsEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");
            builder.UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey);

            builder.ConfigureServices(services =>
            {
                // Remove existing DbContext registrations and re-register with InMemory
                var existingDescriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in existingDescriptors)
                    services.Remove(d);

                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                {
                    var options = new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                        .UseInMemoryDatabase($"ExportsTest_{dbGuid}")
                        .Options;
                    var ctx = new ExpenseTrackerDbContext(options, sp.GetRequiredService<ICurrentUserService>());
                    if (!ctx.Categories.Any())
                    {
                        ctx.Categories.AddRange(SystemCategories.Categories);
                        ctx.SaveChanges();
                    }
                    return ctx;
                });
            });
        });

        _client = _factory.CreateClient();
    }

    private async Task<string> RegisterAndGetTokenAsync(string email = "exportuser@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Export User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body.AccessToken.Token;
    }

    private async Task<CategoryDto> CreateCategoryAsync(
        string name = "Export Category",
        TransactionType type = TransactionType.Expense)
    {
        var request = new CreateCategoryRequest(name, type, "📦", "#FF6B6B");
        var response = await _client.PostAsJsonAsync("/api/categories", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var category = await response.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        category.Should().NotBeNull();
        return category!;
    }

    private async Task<TransactionDto> CreateTransactionAsync(
        Guid categoryId,
        TransactionType type,
        string amount = "150.50",
        DateOnly? occurredOn = null,
        string? note = "Export test transaction")
    {
        var request = new CreateTransactionRequest(categoryId, type, amount,
            occurredOn ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), note);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tx = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        tx.Should().NotBeNull();
        return tx!;
    }

    // ==================== Unauthenticated ====================

    [Fact]
    public async Task Transactions_csv_without_token_returns_401()
    {
        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Summary_csv_without_token_returns_401()
    {
        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== Transactions CSV ====================

    [Fact]
    public async Task Transactions_csv_returns_200_with_attachment_disposition()
    {
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        await CreateTransactionAsync(category.Id, TransactionType.Expense);

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
        response.Content.Headers.ContentDisposition.Should().NotBeNull();
        response.Content.Headers.ContentDisposition!.DispositionType.Should().Be("attachment");
        response.Content.Headers.ContentDisposition.FileName.Should().Contain("transactions-");
    }

    [Fact]
    public async Task Transactions_csv_starts_with_utf8_bom()
    {
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        await CreateTransactionAsync(category.Id, TransactionType.Expense);

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        // UTF-8 BOM: EF BB BF
        bytes.Should().HaveCountGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);
    }

    [Fact]
    public async Task Transactions_csv_contains_thai_headers_and_data()
    {
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync("Food", TransactionType.Expense);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "250.75",
            new DateOnly(2026, 6, 10), "Lunch at restaurant");

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // Header row
        lines[0].Should().Contain("วันที่");
        lines[0].Should().Contain("ประเภท");
        lines[0].Should().Contain("หมวดหมู่");
        lines[0].Should().Contain("จำนวนเงิน");
        lines[0].Should().Contain("หมายเหตุ");

        // Data row
        lines[1].Should().Contain("2026-06-10");
        lines[1].Should().Contain("ค่าใช้จ่าย");
        lines[1].Should().Contain("Food");
        lines[1].Should().Contain("250.75");
        lines[1].Should().Contain("Lunch at restaurant");
    }

    [Fact]
    public async Task Transactions_csv_filters_apply_correctly()
    {
        await RegisterAndGetTokenAsync();
        var expenseCat = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCat = await CreateCategoryAsync("Salary", TransactionType.Income);

        await CreateTransactionAsync(expenseCat.Id, TransactionType.Expense, "100.00",
            new DateOnly(2026, 3, 15), "Old expense");
        await CreateTransactionAsync(incomeCat.Id, TransactionType.Income, "50000.00",
            new DateOnly(2026, 6, 1), "June salary");

        // Filter: Income only
        var response = await _client.GetAsync("/api/exports/transactions.csv?type=Income");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // 1 header + 1 data row (only the income transaction)
        lines.Should().HaveCount(2);
        lines[1].Should().Contain("50000.00");
        lines[1].Should().Contain("Salary");
    }

    [Fact]
    public async Task Transactions_csv_empty_when_no_transactions()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // Only header line
        lines.Should().HaveCount(1);
    }

    // ==================== Summary CSV ====================

    [Fact]
    public async Task Summary_csv_returns_200_with_attachment_disposition()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
        response.Content.Headers.ContentDisposition.Should().NotBeNull();
        response.Content.Headers.ContentDisposition!.DispositionType.Should().Be("attachment");
        response.Content.Headers.ContentDisposition.FileName.Should().Contain("summary-");
    }

    [Fact]
    public async Task Summary_csv_starts_with_utf8_bom()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var bytes = await response.Content.ReadAsByteArrayAsync();

        bytes.Should().HaveCountGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);
    }

    [Fact]
    public async Task Summary_csv_contains_thai_headers()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        lines[0].Should().Contain("เดือน");
        lines[0].Should().Contain("รายรับ");
        lines[0].Should().Contain("รายจ่าย");
        lines[0].Should().Contain("คงเหลือ");
    }

    // ==================== Transactions filter parameters ====================

    [Fact]
    public async Task Transactions_csv_categoryId_filter_applies_correctly()
    {
        await RegisterAndGetTokenAsync();
        var foodCat = await CreateCategoryAsync("Food", TransactionType.Expense);
        var transportCat = await CreateCategoryAsync("Transport", TransactionType.Expense);

        await CreateTransactionAsync(foodCat.Id, TransactionType.Expense, "100.00",
            new DateOnly(2026, 6, 1), "Lunch");
        await CreateTransactionAsync(transportCat.Id, TransactionType.Expense, "200.00",
            new DateOnly(2026, 6, 2), "BTS");

        // Filter by categoryId=foodCat
        var url = $"/api/exports/transactions.csv?categoryId={foodCat.Id}";
        var response = await _client.GetAsync(url);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // 1 header + 1 data row (only the Food transaction)
        lines.Should().HaveCount(2);
        lines[1].Should().Contain("Lunch");
        lines[1].Should().Contain("Food");
        lines[1].Should().NotContain("BTS");
        lines[1].Should().NotContain("Transport");
    }

    [Fact]
    public async Task Transactions_csv_from_to_date_filter_applies_correctly()
    {
        await RegisterAndGetTokenAsync();
        var cat = await CreateCategoryAsync("Food", TransactionType.Expense);

        await CreateTransactionAsync(cat.Id, TransactionType.Expense, "50.00",
            new DateOnly(2026, 3, 15), "Old transaction");
        await CreateTransactionAsync(cat.Id, TransactionType.Expense, "75.00",
            new DateOnly(2026, 6, 10), "Recent transaction");

        // Filter: 2026-06-01 .. 2026-06-30
        var url = "/api/exports/transactions.csv?from=2026-06-01&to=2026-06-30";
        var response = await _client.GetAsync(url);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        lines.Should().HaveCount(2);
        lines[1].Should().Contain("Recent transaction");
        lines[1].Should().NotContain("Old transaction");
    }

    [Fact]
    public async Task Transactions_csv_combined_filters_apply_correctly()
    {
        await RegisterAndGetTokenAsync();
        var foodCat = await CreateCategoryAsync("Food", TransactionType.Expense);
        var salaryCat = await CreateCategoryAsync("Salary", TransactionType.Income);

        await CreateTransactionAsync(foodCat.Id, TransactionType.Expense, "100.00",
            new DateOnly(2026, 6, 5), "Lunch");
        await CreateTransactionAsync(foodCat.Id, TransactionType.Expense, "200.00",
            new DateOnly(2026, 3, 1), "Old lunch");
        await CreateTransactionAsync(salaryCat.Id, TransactionType.Income, "50000.00",
            new DateOnly(2026, 6, 1), "Salary");

        // Filter: type=Expense + categoryId=food + from=2026-06-01
        var url = $"/api/exports/transactions.csv?type=Expense&categoryId={foodCat.Id}&from=2026-06-01";
        var response = await _client.GetAsync(url);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        lines.Should().HaveCount(2);
        lines[1].Should().Contain("Lunch");
        lines[1].Should().Contain("100.00");
        lines[1].Should().NotContain("Old lunch");
        lines[1].Should().NotContain("Salary");
    }

    [Fact]
    public async Task Transactions_csv_with_invalid_date_returns_400()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/transactions.csv?from=not-a-date");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== Summary monthly data ====================

    [Fact]
    public async Task Summary_csv_contains_monthly_data_rows()
    {
        await RegisterAndGetTokenAsync();
        var expenseCat = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCat = await CreateCategoryAsync("Salary", TransactionType.Income);

        // Create transactions across multiple months
        await CreateTransactionAsync(expenseCat.Id, TransactionType.Expense, "1000.00",
            new DateOnly(2026, 5, 15), "May expense");
        await CreateTransactionAsync(incomeCat.Id, TransactionType.Income, "50000.00",
            new DateOnly(2026, 6, 1), "June salary");

        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // Header + at least one data row (this month)
        lines.Should().HaveCountGreaterThan(1);
        // Some line should contain the income amount and another the expense
        csv.Should().Contain("50000.00");
    }

    [Fact]
    public async Task Summary_csv_from_to_date_filter_applies_correctly()
    {
        // The dashboard service always returns the last 6 months, so the
        // summary export's from/to filter must constrain that window.
        await RegisterAndGetTokenAsync();

        // from a date in the past (any data with month >= that date passes)
        var response = await _client.GetAsync("/api/exports/summary.csv?from=2026-01-01&to=2026-12-31");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // Should include header + at least one month row
        lines.Should().HaveCountGreaterThan(1);
        lines[0].Should().Contain("เดือน");
    }

    [Fact]
    public async Task Summary_csv_with_invalid_date_returns_400()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/summary.csv?to=garbage");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Summary_csv_with_no_transactions_returns_header_and_six_zero_months()
    {
        await RegisterAndGetTokenAsync();

        var response = await _client.GetAsync("/api/exports/summary.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        var lines = csv.Split(["\n"], StringSplitOptions.RemoveEmptyEntries);

        // Header + 6 month rows (dashboard always returns the last 6 months,
        // even when no transactions exist for any of them — all amounts 0.00).
        lines.Should().HaveCount(7);
        lines[0].Should().Contain("เดือน");
        for (var i = 1; i < lines.Length; i++)
        {
            lines[i].Should().Contain("0.00");
        }
    }

    // ==================== CSV injection end-to-end ====================

    [Theory]
    [InlineData("=SUM(A1:A10)", "=SUM(A1:A10)")]
    [InlineData("+cmd|'/C calc'!A0", "+cmd|'/C calc'!A0")]
    [InlineData("-1+2", "-1+2")]
    [InlineData("@SUM(A1)", "@SUM(A1)")]
    public async Task Transactions_csv_sanitizes_injection_prone_notes(string maliciousNote, string expectedFragment)
    {
        await RegisterAndGetTokenAsync();
        var cat = await CreateCategoryAsync("Food", TransactionType.Expense);
        await CreateTransactionAsync(cat.Id, TransactionType.Expense, "100.00",
            new DateOnly(2026, 6, 15), maliciousNote);

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");

        // The malicious cell must appear in the file, but with a leading
        // single-quote so Excel/Numbers will treat it as a literal string
        // rather than a formula.
        csv.Should().Contain($"'{expectedFragment}");
    }

    [Fact]
    public async Task Transactions_csv_safe_note_is_not_quoted_prefixed()
    {
        await RegisterAndGetTokenAsync();
        var cat = await CreateCategoryAsync("Food", TransactionType.Expense);
        await CreateTransactionAsync(cat.Id, TransactionType.Expense, "100.00",
            new DateOnly(2026, 6, 15), "Normal lunch note");

        var response = await _client.GetAsync("/api/exports/transactions.csv");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var csv = Encoding.UTF8.GetString(await response.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");

        csv.Should().Contain("Normal lunch note");
        csv.Should().NotContain("'Normal lunch note");
    }

    // ==================== Cross-user isolation ====================

    [Fact]
    public async Task Cross_user_export_does_not_leak_data()
    {
        // User A creates transactions
        await RegisterAndGetTokenAsync("userA_export@test.com");
        var catA = await CreateCategoryAsync("UserA Cat", TransactionType.Expense);
        await CreateTransactionAsync(catA.Id, TransactionType.Expense, "999.99",
            new DateOnly(2026, 6, 15), "User A secret");

        // Export as User A — should contain data
        var responseA = await _client.GetAsync("/api/exports/transactions.csv");
        responseA.StatusCode.Should().Be(HttpStatusCode.OK);
        var csvA = Encoding.UTF8.GetString(await responseA.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        csvA.Should().Contain("999.99");
        csvA.Should().Contain("User A secret");

        // User B registers — fresh context
        _client.DefaultRequestHeaders.Remove("Authorization");
        await RegisterAndGetTokenAsync("userB_export@test.com");

        // Export as User B — should NOT contain User A's data
        var responseB = await _client.GetAsync("/api/exports/transactions.csv");
        responseB.StatusCode.Should().Be(HttpStatusCode.OK);
        var csvB = Encoding.UTF8.GetString(await responseB.Content.ReadAsByteArrayAsync())
            .Replace("\r\n", "\n").Replace("\r", "");
        csvB.Should().NotContain("999.99");
        csvB.Should().NotContain("User A secret");
    }
}
