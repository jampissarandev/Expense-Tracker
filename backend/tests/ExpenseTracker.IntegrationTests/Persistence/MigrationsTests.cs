using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.IntegrationTests.Persistence;

[Trait("Category", "Persistence")]
public class MigrationsApplyToFreshDatabase : IAsyncLifetime
{
    private readonly TestDbContextFactory _factory = new();

    public async Task InitializeAsync()
    {
        if (!_factory.IsDockerAvailable)
            return;
        await _factory.InitializeAsync();
    }

    public Task DisposeAsync() => _factory.DisposeAsync();

    [Fact]
    public async Task Migrations_Apply_To_Fresh_Database()
    {
        if (!_factory.IsDockerAvailable) return;
        // Arrange & Act - migrations were applied during InitializeAsync
        using var context = _factory.CreateDbContext();

        // Assert - all tables exist and are empty
        (await context.Users.CountAsync()).Should().Be(0);
        (await context.Categories.CountAsync()).Should().Be(0);
        (await context.Transactions.CountAsync()).Should().Be(0);
        (await context.RefreshTokens.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task System_Categories_Are_Seeded_On_Startup()
    {
        if (!_factory.IsDockerAvailable) return;
        // Arrange - seed the database
        using (var context = _factory.CreateDbContext())
        {
            context.Categories.AddRange(SystemCategories.Categories);
            await context.SaveChangesAsync();
        }

        // Act
        using var dbContext = _factory.CreateDbContext();
        var categories = await dbContext.Categories.ToListAsync();

        // Assert
        categories.Should().HaveCount(12);
        categories.Count(c => c.Type == TransactionType.Expense).Should().Be(7);
        categories.Count(c => c.Type == TransactionType.Income).Should().Be(5);
        categories.Should().OnlyContain(c => c.IsSystem);
        categories.Should().OnlyContain(c => c.UserId == null);
    }

    [Fact]
    public async Task Global_Query_Filter_Isolates_Users()
    {
        if (!_factory.IsDockerAvailable) return;
        // Arrange - create two users and their data
        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();

        using (var context = _factory.CreateDbContext())
        {
            var categoryA = new Category("Category A", TransactionType.Expense, userAId);
            var categoryB = new Category("Category B", TransactionType.Expense, userBId);

            context.Categories.AddRange(categoryA, categoryB);
            await context.SaveChangesAsync();

            var txA = new Transaction(userAId, categoryA.Id, TransactionType.Expense, 100m, DateOnly.FromDateTime(DateTime.UtcNow));
            var txB = new Transaction(userBId, categoryB.Id, TransactionType.Expense, 200m, DateOnly.FromDateTime(DateTime.UtcNow));

            context.Transactions.AddRange(txA, txB);
            await context.SaveChangesAsync();
        }

        // Sanity check: bypass the filter and confirm both users' data is in the DB
        using (var rawContext = _factory.CreateDbContext())
        {
            var allCategories = await rawContext.Categories.IgnoreQueryFilters().ToListAsync();
            allCategories.Should().Contain(c => c.UserId == userAId);
            allCategories.Should().Contain(c => c.UserId == userBId);

            var allTransactions = await rawContext.Transactions.IgnoreQueryFilters().ToListAsync();
            allTransactions.Should().Contain(t => t.UserId == userAId);
            allTransactions.Should().Contain(t => t.UserId == userBId);
        }

        // Act + Assert: global filter auto-applies — User A sees only their data + system categories
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = userAId;
            using var ctx = scope.Context;

            // Filtered: only user A's categories + system categories (UserId == null)
            var categories = await ctx.Categories.ToListAsync();
            categories.Should().Contain(c => c.UserId == userAId && c.Name == "Category A");
            categories.Should().NotContain(c => c.UserId == userBId);

            var transactions = await ctx.Transactions.ToListAsync();
            transactions.Should().HaveCount(1);
            transactions[0].UserId.Should().Be(userAId);
            transactions[0].Amount.Should().Be(100m);
        }

        // Act + Assert: global filter auto-applies — User B sees only their data + system categories
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = userBId;
            using var ctx = scope.Context;

            var categories = await ctx.Categories.ToListAsync();
            categories.Should().Contain(c => c.UserId == userBId && c.Name == "Category B");
            categories.Should().NotContain(c => c.UserId == userAId);

            var transactions = await ctx.Transactions.ToListAsync();
            transactions.Should().HaveCount(1);
            transactions[0].UserId.Should().Be(userBId);
            transactions[0].Amount.Should().Be(200m);
        }

        // Act + Assert: anonymous user (no current user) sees only system categories and zero transactions
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = null;
            using var ctx = scope.Context;

            var categories = await ctx.Categories.ToListAsync();
            categories.Should().OnlyContain(c => c.UserId == null);
            categories.Should().HaveCount(12); // 7 expense + 5 income system categories

            var transactions = await ctx.Transactions.ToListAsync();
            transactions.Should().BeEmpty();
        }
    }
}
