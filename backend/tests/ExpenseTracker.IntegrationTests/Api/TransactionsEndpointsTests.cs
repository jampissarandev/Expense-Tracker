using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "Transactions")]
public class TransactionsEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public TransactionsEndpointsTests(WebApplicationFactory<Program> factory)
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

                // Register in-memory DbContext with its ICurrentUserService dependency
                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                {
                    var options = new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                        .UseInMemoryDatabase($"TransactionsTest_{dbGuid}")
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

    private async Task<string> RegisterAndGetTokenAsync(string email = "txuser@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Tx User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body.AccessToken.Token;
    }

    private async Task<CategoryDto> CreateCategoryAsync(
        string name = "Test Category",
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
        string? note = "Test transaction")
    {
        var request = new CreateTransactionRequest(categoryId, type, amount, occurredOn ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), note);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tx = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        tx.Should().NotBeNull();
        return tx!;
    }

    // ==================== Unauthenticated ====================

    [Fact]
    public async Task List_without_token_returns_401()
    {
        var response = await _client.GetAsync("/api/transactions");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_without_token_returns_401()
    {
        var request = new CreateTransactionRequest(Guid.NewGuid(), TransactionType.Expense, "100", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetById_without_token_returns_401()
    {
        var response = await _client.GetAsync($"/api/transactions/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Update_without_token_returns_401()
    {
        var request = new UpdateTransactionRequest(Guid.NewGuid(), TransactionType.Expense, "100", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PutAsJsonAsync($"/api/transactions/{Guid.NewGuid()}", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Delete_without_token_returns_401()
    {
        var response = await _client.DeleteAsync($"/api/transactions/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ==================== Create ====================

    [Fact]
    public async Task Create_expense_returns_created()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync("Food", TransactionType.Expense);

        // Act
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "250.75",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), "Lunch");
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();

        var tx = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        tx.Should().NotBeNull();
        tx!.CategoryId.Should().Be(category.Id);
        tx.Type.Should().Be(TransactionType.Expense);
        tx.Amount.Should().Be("250.75");
        tx.OccurredOn.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)));
        tx.Note.Should().Be("Lunch");
    }

    [Fact]
    public async Task Create_income_returns_created()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync("Salary", TransactionType.Income);

        // Act
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Income, "50000",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), "Monthly salary");
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var tx = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        tx.Should().NotBeNull();
        tx!.Type.Should().Be(TransactionType.Income);
        tx.Amount.Should().Be("50000.00");
    }

    [Fact]
    public async Task Create_with_invalid_amount_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();

        // Act — negative amount
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "-100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task Create_with_zero_amount_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();

        // Act
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "0",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_with_too_many_decimals_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();

        // Act — 3 decimal places
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "100.999",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_with_future_date_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();

        // Act
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_with_unknown_category_returns_404()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var request = new CreateTransactionRequest(
            Guid.NewGuid(), TransactionType.Expense, "100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Create_with_type_mismatch_category_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);

        // Act — try to create an income transaction with an expense category
        var request = new CreateTransactionRequest(
            expenseCategory.Id, TransactionType.Income, "100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PostAsJsonAsync("/api/transactions", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== List ====================

    [Fact]
    public async Task List_returns_paged_result()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        for (var i = 0; i < 5; i++)
        {
            await CreateTransactionAsync(category.Id, TransactionType.Expense, (10 + i).ToString("F2"), yesterday.AddDays(-i));
        }

        // Act
        var response = await _client.GetAsync("/api/transactions");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(5);
        result.Page.Should().Be(1);
        result.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task List_filters_by_type()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCategory = await CreateCategoryAsync("Salary", TransactionType.Income);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense, "100.00", yesterday);
        await CreateTransactionAsync(incomeCategory.Id, TransactionType.Income, "500.00", yesterday);

        // Act — filter for income only
        var response = await _client.GetAsync("/api/transactions?type=Income");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);
        result.Items[0].Type.Should().Be(TransactionType.Income);
    }

    [Fact]
    public async Task List_filters_by_category()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var foodCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var transportCategory = await CreateCategoryAsync("Transport", TransactionType.Expense);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await CreateTransactionAsync(foodCategory.Id, TransactionType.Expense, "100.00", yesterday);
        await CreateTransactionAsync(transportCategory.Id, TransactionType.Expense, "200.00", yesterday);

        // Act — filter by food category
        var response = await _client.GetAsync($"/api/transactions?categoryId={foodCategory.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);
        result.Items[0].CategoryId.Should().Be(foodCategory.Id);
    }

    [Fact]
    public async Task List_filters_by_date_range()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", today.AddDays(-1), "Yesterday");
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", today.AddDays(-5), "5 days ago");
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "300.00", today.AddDays(-10), "10 days ago");

        // Act — filter last 3 days
        var from = today.AddDays(-3).ToString("yyyy-MM-dd");
        var to = today.ToString("yyyy-MM-dd");
        var response = await _client.GetAsync($"/api/transactions?from={from}&to={to}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);
        result.Items[0].Note.Should().Be("Yesterday");
    }

    [Fact]
    public async Task List_paginates_correctly()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        for (var i = 0; i < 25; i++)
        {
            await CreateTransactionAsync(category.Id, TransactionType.Expense, (10 + i).ToString("F2"), yesterday);
        }

        // Act — page 1, size 10
        var response = await _client.GetAsync("/api/transactions?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(10);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.TotalCount.Should().Be(25);
        result.TotalPages.Should().Be(3);

        // Act — page 3, size 10
        var response2 = await _client.GetAsync("/api/transactions?page=3&pageSize=10");
        var result2 = await response2.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result2!.Items.Should().HaveCount(5); // 25 - 20 = 5 remaining
    }

    // ==================== List — sort scenarios ====================

    [Fact]
    public async Task List_sorts_by_amount_desc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "50.00", yesterday);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", yesterday);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", yesterday);

        // Act
        var response = await _client.GetAsync("/api/transactions?sortBy=amount&sortOrder=desc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(3);
        result.Items[0].Amount.Should().Be("200.00");
        result.Items[1].Amount.Should().Be("100.00");
        result.Items[2].Amount.Should().Be("50.00");
    }

    [Fact]
    public async Task List_sorts_by_amount_asc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "50.00", yesterday);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", yesterday);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", yesterday);

        // Act
        var response = await _client.GetAsync("/api/transactions?sortBy=amount&sortOrder=asc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(3);
        result.Items[0].Amount.Should().Be("50.00");
        result.Items[1].Amount.Should().Be("100.00");
        result.Items[2].Amount.Should().Be("200.00");
    }

    [Fact]
    public async Task List_sorts_by_occurred_on_asc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", today.AddDays(-1));
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", today.AddDays(-5));

        // Act
        var response = await _client.GetAsync("/api/transactions?sortBy=occurredOn&sortOrder=asc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items[0].Amount.Should().Be("200.00"); // older (5 days ago)
        result.Items[1].Amount.Should().Be("100.00"); // newer (1 day ago)
    }

    [Fact]
    public async Task List_sorts_by_occurred_on_desc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", today.AddDays(-1));
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", today.AddDays(-5));

        // Act — explicit desc (same as default)
        var response = await _client.GetAsync("/api/transactions?sortBy=occurredOn&sortOrder=desc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items[0].Amount.Should().Be("100.00"); // newer (1 day ago)
        result.Items[1].Amount.Should().Be("200.00"); // older (5 days ago)
    }

    [Fact]
    public async Task List_sorts_by_category_name_asc()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var foodCategory = await CreateCategoryAsync("BBQ", TransactionType.Expense);
        var transportCategory = await CreateCategoryAsync("Airlines", TransactionType.Expense);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        await CreateTransactionAsync(foodCategory.Id, TransactionType.Expense, "100.00", yesterday);
        await CreateTransactionAsync(transportCategory.Id, TransactionType.Expense, "200.00", yesterday);

        // Act
        var response = await _client.GetAsync("/api/transactions?sortBy=categoryName&sortOrder=asc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items[0].CategoryName.Should().Be("Airlines");
        result.Items[1].CategoryName.Should().Be("BBQ");
    }

    [Fact]
    public async Task List_with_invalid_sortBy_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var response = await _client.GetAsync("/api/transactions?sortBy=garbage");

        // Assert — default model binding returns 400 for unknown enum value
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task List_without_sort_params_returns_default_order()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", today.AddDays(-1));
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", today.AddDays(-5));

        // Act — no sort params
        var response = await _client.GetAsync("/api/transactions");

        // Assert — default order: newest first
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items[0].Amount.Should().Be("100.00"); // 1 day ago
        result.Items[1].Amount.Should().Be("200.00"); // 5 days ago
    }

    // ==================== GetById ====================

    [Fact]
    public async Task GetById_returns_transaction()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var tx = await CreateTransactionAsync(category.Id, TransactionType.Expense, "500.00");

        // Act
        var response = await _client.GetAsync($"/api/transactions/{tx.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        fetched.Should().NotBeNull();
        fetched!.Id.Should().Be(tx.Id);
        fetched.Amount.Should().Be("500.00");
    }

    [Fact]
    public async Task GetById_nonexistent_returns_404()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var response = await _client.GetAsync($"/api/transactions/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==================== Update ====================

    [Fact]
    public async Task Update_returns_ok()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var tx = await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00");

        // Act
        var updateRequest = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "999.99",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)), "Updated note");
        var response = await _client.PutAsJsonAsync($"/api/transactions/{tx.Id}", updateRequest, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        updated.Should().NotBeNull();
        updated!.Amount.Should().Be("999.99");
        updated.Note.Should().Be("Updated note");
    }

    [Fact]
    public async Task Update_nonexistent_returns_404()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();

        // Act
        var request = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PutAsJsonAsync($"/api/transactions/{Guid.NewGuid()}", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Update_with_invalid_amount_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var tx = await CreateTransactionAsync(category.Id, TransactionType.Expense);

        // Act
        var request = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "0",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PutAsJsonAsync($"/api/transactions/{tx.Id}", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_with_type_mismatch_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var expenseCategory = await CreateCategoryAsync("Food", TransactionType.Expense);
        var incomeCategory = await CreateCategoryAsync("Salary", TransactionType.Income);
        var tx = await CreateTransactionAsync(expenseCategory.Id, TransactionType.Expense);

        // Act — try to update to income type with expense category
        var request = new UpdateTransactionRequest(
            expenseCategory.Id, TransactionType.Income, "100",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), null);
        var response = await _client.PutAsJsonAsync($"/api/transactions/{tx.Id}", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ==================== Delete ====================

    [Fact]
    public async Task Delete_returns_no_content()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var tx = await CreateTransactionAsync(category.Id, TransactionType.Expense);

        // Act
        var response = await _client.DeleteAsync($"/api/transactions/{tx.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify it's gone
        var getResponse = await _client.GetAsync($"/api/transactions/{tx.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_nonexistent_returns_404()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var response = await _client.DeleteAsync($"/api/transactions/{Guid.NewGuid()}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==================== Full Round-trip ====================

    [Fact]
    public async Task Create_get_update_delete_round_trip()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync("Round Trip Cat", TransactionType.Expense);
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));

        // Step 1: Create
        var createRequest = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "150.50", yesterday, "Initial");
        var createResponse = await _client.PostAsJsonAsync("/api/transactions", createRequest, JsonOptions);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        created.Should().NotBeNull();

        // Step 2: Get by id
        var getResponse = await _client.GetAsync($"/api/transactions/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var fetched = await getResponse.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        fetched!.Amount.Should().Be("150.50");

        // Step 3: Update
        var updateRequest = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "999.99", yesterday.AddDays(-1), "Updated");
        var updateResponse = await _client.PutAsJsonAsync($"/api/transactions/{created.Id}", updateRequest, JsonOptions);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TransactionDto>(JsonOptions);
        updated!.Amount.Should().Be("999.99");
        updated.Note.Should().Be("Updated");

        // Step 4: List and verify
        var listResponse = await _client.GetAsync("/api/transactions");
        var list = await listResponse.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);
        list!.Items.Should().Contain(t => t.Id == created.Id);

        // Step 5: Delete
        var deleteResponse = await _client.DeleteAsync($"/api/transactions/{created.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 6: Verify deleted
        var verifyResponse = await _client.GetAsync($"/api/transactions/{created.Id}");
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==================== Cross-user isolation ====================

    [Fact]
    public async Task Cross_user_access_returns_not_found()
    {
        // Arrange — User A creates a transaction
        await RegisterAndGetTokenAsync("txUserA@test.com");
        var categoryA = await CreateCategoryAsync("UserA Cat", TransactionType.Expense);
        var tx = await CreateTransactionAsync(categoryA.Id, TransactionType.Expense, "100.00");

        // Arrange — Register as User B
        _client.DefaultRequestHeaders.Remove("Authorization");
        await RegisterAndGetTokenAsync("txUserB@test.com");

        // Act — User B tries to get User A's transaction
        var getResponse = await _client.GetAsync($"/api/transactions/{tx.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Act — User B tries to update User A's transaction
        var categoryB = await CreateCategoryAsync("UserB Cat", TransactionType.Expense);
        var updateRequest = new UpdateTransactionRequest(
            categoryB.Id, TransactionType.Expense, "200",
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), "Stolen");
        var updateResponse = await _client.PutAsJsonAsync($"/api/transactions/{tx.Id}", updateRequest, JsonOptions);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Act — User B tries to delete User A's transaction
        var deleteResponse = await _client.DeleteAsync($"/api/transactions/{tx.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cross_user_cannot_see_others_transactions_in_list()
    {
        // Arrange — User A creates transactions
        await RegisterAndGetTokenAsync("txListUserA@test.com");
        var categoryA = await CreateCategoryAsync("Private Cat", TransactionType.Expense);
        await CreateTransactionAsync(categoryA.Id, TransactionType.Expense, "100.00");
        await CreateTransactionAsync(categoryA.Id, TransactionType.Expense, "200.00");

        // Arrange — Register as User B
        _client.DefaultRequestHeaders.Remove("Authorization");
        await RegisterAndGetTokenAsync("txListUserB@test.com");

        // Act
        var response = await _client.GetAsync("/api/transactions");
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);

        // Assert — User B should not see User A's transactions
        result!.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    // ==================== Date ordering ====================

    [Fact]
    public async Task List_is_ordered_by_occurred_on_descending()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var category = await CreateCategoryAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "100.00", today.AddDays(-3), "3 days ago");
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "200.00", today.AddDays(-1), "1 day ago");
        await CreateTransactionAsync(category.Id, TransactionType.Expense, "300.00", today.AddDays(-2), "2 days ago");

        // Act
        var response = await _client.GetAsync("/api/transactions");
        var result = await response.Content.ReadFromJsonAsync<PagedResult<TransactionDto>>(JsonOptions);

        // Assert
        result!.Items.Should().HaveCount(3);
        result.Items[0].Note.Should().Be("1 day ago");
        result.Items[1].Note.Should().Be("2 days ago");
        result.Items[2].Note.Should().Be("3 days ago");
    }
}
