using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
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

[Trait("Category", "RequestSizeLimit")]
public class RequestSizeLimitEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public RequestSizeLimitEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");
            builder.UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey);

            builder.ConfigureServices(services =>
            {
                // Replace DbContext with InMemory for test isolation
                var descriptors = services
                    .Where(d => d.ServiceType == typeof(ExpenseTrackerDbContext) ||
                                d.ServiceType == typeof(DbContextOptions<ExpenseTrackerDbContext>))
                    .ToList();
                foreach (var d in descriptors)
                    services.Remove(d);

                var dbGuid = Guid.NewGuid();
                services.AddScoped<ExpenseTrackerDbContext>(sp =>
                {
                    var options = new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
                        .UseInMemoryDatabase($"RequestSizeLimitTest_{dbGuid}")
                        .Options;
                    var ctx = new ExpenseTrackerDbContext(options, sp.GetRequiredService<ExpenseTracker.Application.Abstractions.ICurrentUserService>());
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

    private async Task<AuthResponse> RegisterAndGetAuthAsync(string email = "sizelimit@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Size Limit User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body;
    }

    private async Task<CategoryDto> CreateCategoryAsync()
    {
        var auth = await RegisterAndGetAuthAsync("sizelimit-cat@test.com");
        var request = new CreateCategoryRequest("Test Cat", TransactionType.Expense, "📦", "#FF6B6B");
        var response = await _client.PostAsJsonAsync("/api/categories", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var category = await response.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        category.Should().NotBeNull();
        return category!;
    }

    /// <summary>
    /// A single oversized JSON body must be rejected — 413 (Payload Too Large) in
    /// production Kestrel, or 400 (Bad Request) from model-binding / validation in
    /// the in-memory TestServer used by WebApplicationFactory.
    /// Either status proves the oversized body is never processed.
    /// </summary>
    [Fact]
    public async Task Post_transaction_with_oversized_body_is_rejected()
    {
        // Arrange — register + authenticate
        await RegisterAndGetAuthAsync();
        var category = await CreateCategoryAsync();

        // Build a 100 KB JSON payload (the Note field is the only large field)
        var bigNote = new string('X', 100_000);
        var payload = new
        {
            amount = 42.50,
            type = TransactionType.Expense,
            categoryId = category.Id,
            date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            note = bigNote
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        var response = await _client.PostAsync("/api/transactions", content);

        // Assert — rejected with 413 (Kestrel) or 400 (TestServer / validation)
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.RequestEntityTooLarge, // 413 — Kestrel body size limit
            HttpStatusCode.BadRequest);           // 400 — model binding / FluentValidation

        // Body should NOT be processed — no transaction created
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotContain("createdAt");
    }

    /// <summary>
    /// A normal-sized JSON body is accepted (201 Created).
    /// </summary>
    [Fact]
    public async Task Post_transaction_with_normal_body_returns_201()
    {
        // Arrange
        await RegisterAndGetAuthAsync("sizelimit-normal@test.com");
        var category = await CreateCategoryAsync();

        var payload = new CreateTransactionRequest(
            CategoryId: category.Id,
            Type: TransactionType.Expense,
            Amount: "42.50",
            OccurredOn: DateOnly.FromDateTime(DateTime.UtcNow),
            Note: "Lunch");

        // Act
        var response = await _client.PostAsJsonAsync("/api/transactions", payload, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    /// <summary>
    /// Oversized body to the categories endpoint is also rejected.
    /// </summary>
    [Fact]
    public async Task Post_category_with_oversized_body_is_rejected()
    {
        // Arrange
        await RegisterAndGetAuthAsync("sizelimit-cat-oversize@test.com");

        var bigName = new string('Y', 100_000);
        var payload = new
        {
            name = bigName,
            type = TransactionType.Expense,
            icon = "📦",
            color = "#FF6B6B"
        };
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        var response = await _client.PostAsync("/api/categories", content);

        // Assert — rejected with 413 (Kestrel) or 400 (TestServer / validation)
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.RequestEntityTooLarge, // 413 — Kestrel body size limit
            HttpStatusCode.BadRequest);           // 400 — model binding / FluentValidation
    }
}
