using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "Dashboard")]
public class DashboardEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public DashboardEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");

            builder.ConfigureServices(services =>
            {
                // Remove existing DbContext registrations and re-register with InMemory
                var existingDescriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in existingDescriptors)
                    services.Remove(d);

                // Register in-memory DbContext with its ICurrentUserService dependency
                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                {
                    var options = new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                        .UseInMemoryDatabase($"DashboardTest_{dbGuid}")
                        .Options;
                    var ctx = new ExpenseTrackerDbContext(options, sp.GetRequiredService<ICurrentUserService>());
                    // InMemory doesn't auto-apply HasData; seed system categories
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

    private async Task<string> RegisterAndGetTokenAsync(string email = "dashuser@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Dash User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body.AccessToken.Token;
    }

    private async Task<CategoryDto> CreateCategoryAsync(
        string name,
        TransactionType type)
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
        string amount,
        DateOnly occurredOn,
        string? note = null)
    {
        var request = new CreateTransactionRequest(categoryId, type, amount, occurredOn, note);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tx = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        tx.Should().NotBeNull();
        return tx!;
    }

    /// <summary>
    /// Creates a transaction directly in the DB (bypassing API) to seed
    /// data for a specific user. Used for cross-user isolation tests.
    /// </summary>
    private async Task SeedTransactionDirectlyAsync(
        Guid userId, Guid categoryId, TransactionType type, decimal amount, DateOnly occurredOn)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<ExpenseTrackerDbContext>();
        var tx = new Domain.Entities.Transaction(userId, categoryId, type, amount, occurredOn);
        ctx.Transactions.Add(tx);
        await ctx.SaveChangesAsync();
    }

    /// <summary>
    /// Gets the userId for the currently authenticated user via /api/auth/me.
    /// </summary>
    private async Task<Guid> GetCurrentUserIdAsync()
    {
        var response = await _client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        return Guid.Parse(user.GetProperty("id").GetString()!);
    }

    // ==================== Unauthenticated ====================

    [Fact]
    public async Task Dashboard_without_token_returns_401()
    {
        var response = await _client.GetAsync("/api/dashboard/summary");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== Current month totals ====================

    [Fact]
    public async Task Current_month_totals_match_seeded_data()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCategory = await CreateCategoryAsync("Salary", TransactionType.Income);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "500.00", today, "Lunch");
        await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "300.00", today.AddDays(-1), "Dinner");
        await CreateTransactionAsync(incomeCategory.Id, TransactionType.Income, "50000.00", today.AddDays(-2), "Salary");

        // Act
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.CurrentMonth.Income.Should().Be(50000.00m);
        summary.CurrentMonth.Expense.Should().Be(800.00m);
        summary.CurrentMonth.Balance.Should().Be(49200.00m);
    }

    [Fact]
    public async Task Empty_month_returns_zero_totals()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.CurrentMonth.Income.Should().Be(0m);
        summary.CurrentMonth.Expense.Should().Be(0m);
        summary.CurrentMonth.Balance.Should().Be(0m);
    }

    // ==================== Last 6 months ====================

    [Fact]
    public async Task Last6Months_includes_current_month_and_previous_5()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCategory = await CreateCategoryAsync("Salary", TransactionType.Income);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Seed transactions across 6 months
        for (var i = 0; i < 6; i++)
        {
            var date = new DateTime(today.Year, today.Month, 1).AddMonths(-i);
            var dateOnly = new DateOnly(date.Year, date.Month, 15);
            await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "100.00", dateOnly);
            await CreateTransactionAsync(incomeCategory.Id, TransactionType.Income, "500.00", dateOnly);
        }

        // Act
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.Last6Months.Should().HaveCount(6);

        // All 6 months should have data
        foreach (var month in summary.Last6Months)
        {
            month.Income.Should().Be(500.00m);
            month.Expense.Should().Be(100.00m);
        }

        // List is chronological: last entry is the current month
        var last = summary.Last6Months[^1];
        last.Year.Should().Be(today.Year);
        last.Month.Should().Be(today.Month);

        // First entry is 5 months ago
        var first = summary.Last6Months[0];
        var expectedFirstDate = new DateTime(today.Year, today.Month, 1).AddMonths(-5);
        first.Year.Should().Be(expectedFirstDate.Year);
        first.Month.Should().Be(expectedFirstDate.Month);
    }

    [Fact]
    public async Task Last6Months_includes_zero_months_for_missing_data()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Only seed current month
        await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "200.00", today.AddDays(-1));

        // Act
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.Last6Months.Should().HaveCount(6);

        // Only current month should have data; previous 5 should be zeros
        var currentMonthEntry = summary.Last6Months.First(m =>
            m.Year == today.Year && m.Month == today.Month);
        currentMonthEntry.Expense.Should().Be(200.00m);

        // The other 5 months should all be zeros
        var zeroMonths = summary.Last6Months.Where(m =>
            !(m.Year == today.Year && m.Month == today.Month)).ToList();
        zeroMonths.Should().HaveCount(5);
        zeroMonths.Should().AllSatisfy(m =>
        {
            m.Income.Should().Be(0m);
            m.Expense.Should().Be(0m);
        });
    }

    // ==================== By category ====================

    [Fact]
    public async Task ByCategory_returns_top_10_ordered_desc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create 12 categories and transactions for each
        for (var i = 0; i < 12; i++)
        {
            var category = await CreateCategoryAsync($"ExpenseCat{i}", TransactionType.Expense);
            await CreateTransactionAsync(category.Id, TransactionType.Expense, (100 * (12 - i)).ToString("F2"), today.AddDays(-1));
        }

        // Act — defaults to Expense
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.ByCategory.Should().HaveCount(10); // Top 10 only

        // Should be ordered descending by total
        var totals = summary.ByCategory.Select(c => c.Total).ToList();
        totals.Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task ByCategory_with_type_filter_returns_income()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCategory = await CreateCategoryAsync("Salary", TransactionType.Income);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "500.00", today.AddDays(-1));
        await CreateTransactionAsync(incomeCategory.Id, TransactionType.Income, "30000.00", today.AddDays(-1));

        // Act — filter for income
        var response = await _client.GetAsync("/api/dashboard/summary?type=Income");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.ByCategory.Should().HaveCount(1);
        summary.ByCategory[0].Name.Should().Be("Salary");
        summary.ByCategory[0].Total.Should().Be(30000.00m);
    }

    // ==================== Cross-user isolation ====================

    [Fact]
    public async Task Dashboard_only_returns_current_user_data()
    {
        // Arrange — User A
        await RegisterAndGetTokenAsync("userA@test.com");
        var expenseCategoryA = await CreateCategoryAsync("FoodA", TransactionType.Expense);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(expenseCategoryA.Id, TransactionType.Expense, "100.00", today.AddDays(-1));
        var userAId = await GetCurrentUserIdAsync();

        // Register User B in a separate client
        using var client2 = _factory.CreateClient();
        var registerRequest2 = new RegisterRequest("userB@test.com", "Password123!", "User B");
        var registerResponse2 = await client2.PostAsJsonAsync("/api/auth/register", registerRequest2, JsonOptions);
        registerResponse2.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth2 = await registerResponse2.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client2.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth2!.AccessToken.Token);

        // Create category and transactions for User B
        var createCatReq = new CreateCategoryRequest("FoodB", TransactionType.Expense, "📦", "#FF6B6B");
        var createCatRes = await client2.PostAsJsonAsync("/api/categories", createCatReq, JsonOptions);
        var catB = await createCatRes.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        var txReq = new CreateTransactionRequest(catB!.Id, TransactionType.Expense, "200.00", today.AddDays(-1), null);
        var txRes = await client2.PostAsJsonAsync("/api/transactions", txReq, JsonOptions);
        txRes.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act — User A checks dashboard
        var response = await _client.GetAsync("/api/dashboard/summary");

        // Assert — User A should only see their own data
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<DashboardSummaryDto>(JsonOptions);
        summary.Should().NotBeNull();
        summary!.CurrentMonth.Expense.Should().Be(100.00m); // Only User A's 100, not User B's 200
        summary.ByCategory.Should().ContainSingle(c => c.Name == "FoodA");
        summary.ByCategory.Should().NotContain(c => c.Name == "FoodB");
    }
}
