using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.IntegrationTests.Persistence;

/// <summary>
/// Proves that the EF Core global query filter on Transaction (and Category)
/// is the single source of truth for user isolation (R-2).
///
/// Each test creates a <see cref="TransactionRepository"/> backed by a real
/// PostgreSQL DbContext and verifies that only the current user's data is
/// visible — even though the repository itself applies no explicit UserId
/// filter in <c>ListAsync</c>.
///
/// If a future maintainer removes the global query filter, these tests will
/// fail, providing an early warning.
/// </summary>
[Trait("Category", "GlobalQueryFilter")]
public class GlobalQueryFilterTests : IAsyncLifetime
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
    public async Task TransactionRepository_ListAsync_returns_only_current_users_data()
    {
        if (!_factory.IsDockerAvailable) return;

        // Arrange — seed data for two users directly (bypassing the filter)
        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();

        using (var seed = _factory.CreateDbContext())
        {
            var catA = new Category("Cat A", TransactionType.Expense, userAId);
            var catB = new Category("Cat B", TransactionType.Expense, userBId);
            seed.Categories.AddRange(catA, catB);
            await seed.SaveChangesAsync();

            seed.Transactions.AddRange(
                new Transaction(userAId, catA.Id, TransactionType.Expense, 100m, DateOnly.FromDateTime(DateTime.UtcNow)),
                new Transaction(userAId, catA.Id, TransactionType.Expense, 200m, DateOnly.FromDateTime(DateTime.UtcNow)),
                new Transaction(userBId, catB.Id, TransactionType.Expense, 300m, DateOnly.FromDateTime(DateTime.UtcNow))
            );
            await seed.SaveChangesAsync();
        }

        // Act + Assert — User A sees only their 2 transactions
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = userAId;
            var repo = new TransactionRepository(scope.Context);
            var (items, total) = await repo.ListAsync(userAId, new TransactionFilter());

            total.Should().Be(2);
            items.Should().HaveCount(2);
            items.Should().OnlyContain(t => t.UserId == userAId);
        }

        // Act + Assert — User B sees only their 1 transaction
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = userBId;
            var repo = new TransactionRepository(scope.Context);
            var (items, total) = await repo.ListAsync(userBId, new TransactionFilter());

            total.Should().Be(1);
            items.Should().HaveCount(1);
            items[0].UserId.Should().Be(userBId);
        }

        // Act + Assert — Anonymous (no user) sees nothing
        using (var scope = _factory.CreateScope())
        {
            scope.CurrentUserId = null;
            var repo = new TransactionRepository(scope.Context);
            var (items, total) = await repo.ListAsync(Guid.NewGuid(), new TransactionFilter());

            total.Should().Be(0);
            items.Should().BeEmpty();
        }
    }
}
