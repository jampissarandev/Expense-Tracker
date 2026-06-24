using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExpenseTracker.IntegrationTests.Api;

[Trait("Category", "Categories")]
public class CategoriesEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public CategoriesEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Development");

            builder.ConfigureServices(services =>
            {
                // Remove existing DbContext registrations and re-register with InMemory
                // but keep the real CurrentUserService so it reads from HttpContext.User
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
                        .UseInMemoryDatabase($"CategoriesTest_{dbGuid}")
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

    private async Task<string> RegisterAndGetTokenAsync(string email = "catuser@test.com")
    {
        var request = new RegisterRequest(email, "Password123!", "Cat User");
        var response = await _client.PostAsJsonAsync("/api/auth/register", request, JsonOptions);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        body.Should().NotBeNull();

        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body!.AccessToken.Token);

        return body.AccessToken.Token;
    }

    // ==================== List ====================

    [Fact]
    public async Task List_returns_system_and_user_categories()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Act
        var response = await _client.GetAsync("/api/categories");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var categories = await response.Content.ReadFromJsonAsync<List<CategoryDto>>(JsonOptions);
        categories.Should().NotBeNull();
        categories!.Should().NotBeEmpty();
        categories.Should().OnlyContain(c => c.IsSystem);
    }

    // ==================== Create ====================

    [Fact]
    public async Task Create_user_category_returns_created()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var request = new CreateCategoryRequest("Custom Transport", TransactionType.Expense, "🚗", "#123456");

        // Act
        var response = await _client.PostAsJsonAsync("/api/categories", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();

        var category = await response.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        category.Should().NotBeNull();
        category!.Name.Should().Be("Custom Transport");
        category.Type.Should().Be(TransactionType.Expense);
        category.Icon.Should().Be("🚗");
        category.Color.Should().Be("#123456");
        category.IsSystem.Should().BeFalse();
        category.UserId.Should().NotBeNull();
    }

    [Fact]
    public async Task Create_with_invalid_name_returns_400()
    {
        // Arrange
        await RegisterAndGetTokenAsync();
        var request = new CreateCategoryRequest("", TransactionType.Expense, null, null);

        // Act
        var response = await _client.PostAsJsonAsync("/api/categories", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    // ==================== Create + Update + Delete round-trip ====================

    [Fact]
    public async Task Create_update_delete_user_category_round_trip()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Step 1: Create
        var createRequest = new CreateCategoryRequest("Round Trip Cat", TransactionType.Income, "🎉", "#FF0000");
        var createResponse = await _client.PostAsJsonAsync("/api/categories", createRequest, JsonOptions);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        created.Should().NotBeNull();
        var categoryId = created!.Id;

        // Step 2: Update
        var updateRequest = new UpdateCategoryRequest("Updated Cat", "🎊", "#00FF00");
        var updateResponse = await _client.PutAsJsonAsync($"/api/categories/{categoryId}", updateRequest, JsonOptions);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await updateResponse.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);
        updated.Should().NotBeNull();
        updated!.Name.Should().Be("Updated Cat");
        updated.Icon.Should().Be("🎊");
        updated.Color.Should().Be("#00FF00");

        // Step 3: Delete
        var deleteResponse = await _client.DeleteAsync($"/api/categories/{categoryId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Step 4: Verify deleted
        var getResponse = await _client.GetAsync($"/api/categories/{categoryId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ==================== System category protection ====================

    [Fact]
    public async Task Update_system_category_returns_403()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Get system categories to find a system category ID
        var listResponse = await _client.GetAsync("/api/categories");
        var categories = await listResponse.Content.ReadFromJsonAsync<List<CategoryDto>>(JsonOptions);
        var systemCategory = categories!.First(c => c.IsSystem);

        // Act
        var updateRequest = new UpdateCategoryRequest("Hacked Name", null, null);
        var response = await _client.PutAsJsonAsync($"/api/categories/{systemCategory.Id}", updateRequest, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);
        problem.Should().NotBeNull();
        problem!.Status.Should().Be(403);
    }

    [Fact]
    public async Task Delete_system_category_returns_403()
    {
        // Arrange
        await RegisterAndGetTokenAsync();

        // Get system categories
        var listResponse = await _client.GetAsync("/api/categories");
        var categories = await listResponse.Content.ReadFromJsonAsync<List<CategoryDto>>(JsonOptions);
        var systemCategory = categories!.First(c => c.IsSystem);

        // Act
        var response = await _client.DeleteAsync($"/api/categories/{systemCategory.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ==================== Cross-user isolation ====================

    [Fact]
    public async Task Cross_user_category_access_returns_404()
    {
        // Arrange - User A creates a category
        await RegisterAndGetTokenAsync("userA@test.com");
        var createRequest = new CreateCategoryRequest("UserA Category", TransactionType.Expense, null, null);
        var createResponse = await _client.PostAsJsonAsync("/api/categories", createRequest, JsonOptions);
        var created = await createResponse.Content.ReadFromJsonAsync<CategoryDto>(JsonOptions);

        // Arrange - Register as User B
        _client.DefaultRequestHeaders.Remove("Authorization");
        await RegisterAndGetTokenAsync("userB@test.com");

        // Act - User B tries to update User A's category
        var updateRequest = new UpdateCategoryRequest("Stolen", null, null);
        var updateResponse = await _client.PutAsJsonAsync($"/api/categories/{created!.Id}", updateRequest, JsonOptions);

        // Assert — returns 404 (not 403, to avoid leaking existence)
        updateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // Act - User B tries to delete User A's category
        var deleteResponse = await _client.DeleteAsync($"/api/categories/{created.Id}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cross_user_cannot_see_others_categories_in_list()
    {
        // Arrange - User A creates a category
        await RegisterAndGetTokenAsync("userA@test.com");
        var createRequest = new CreateCategoryRequest("UserA Private", TransactionType.Expense, null, null);
        await _client.PostAsJsonAsync("/api/categories", createRequest, JsonOptions);

        // Arrange - User B
        _client.DefaultRequestHeaders.Remove("Authorization");
        await RegisterAndGetTokenAsync("userB@test.com");

        // Act
        var response = await _client.GetAsync("/api/categories");
        var categories = await response.Content.ReadFromJsonAsync<List<CategoryDto>>(JsonOptions);

        // Assert — User B should not see User A's custom categories
        categories!.Should().NotContain(c => c.Name == "UserA Private");
    }

    // ==================== Unauthenticated ====================

    [Fact]
    public async Task List_without_token_returns_401()
    {
        // Act
        var response = await _client.GetAsync("/api/categories");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_without_token_returns_401()
    {
        // Arrange
        var request = new CreateCategoryRequest("Test", TransactionType.Expense, null, null);

        // Act
        var response = await _client.PostAsJsonAsync("/api/categories", request, JsonOptions);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
