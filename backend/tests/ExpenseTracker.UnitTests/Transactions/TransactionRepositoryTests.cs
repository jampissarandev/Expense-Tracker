using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Common;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Infrastructure.Persistence;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.UnitTests.Transactions;

[Trait("Category", "Transactions")]
public class TransactionRepositoryTests : IDisposable
{
    private readonly ExpenseTrackerDbContext _context;
    private readonly TransactionRepository _sut;
    private readonly Guid _userId = Guid.NewGuid();

    // Seed categories (from SystemCategories + test categories)
    private readonly Category _incomeCategory;
    private readonly Category _expenseCategory;

    public TransactionRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ExpenseTrackerDbContext>()
            .UseInMemoryDatabase($"TxRepoTest_{Guid.NewGuid()}")
            .Options;

        _context = new ExpenseTrackerDbContext(options, new FakeCurrentUserService(_userId));

        // Seed system categories (required for FK constraints even though we
        // won't query them — InMemory doesn't auto-apply HasData seed).
        if (!_context.Categories.Any())
        {
            _context.Categories.AddRange(SystemCategories.Categories);
            _context.SaveChanges();
        }

        // Create test-specific categories
        _incomeCategory = new Category("Salary", TransactionType.Income, _userId, "💰", "#00FF00");
        _expenseCategory = new Category("Food", TransactionType.Expense, _userId, "🍽️", "#FF6B6B");
        _context.Categories.AddRange(_incomeCategory, _expenseCategory);
        _context.SaveChanges();

        _sut = new TransactionRepository(_context);
    }

    public void Dispose()
    {
        _context.Dispose();
    }

    /// <summary>
    /// Helper to seed test transactions with known values for sort assertions.
    /// </summary>
    private List<Transaction> SeedTransactions()
    {
        var txns = new List<Transaction>
        {
            new Transaction(_userId, _expenseCategory.Id, TransactionType.Expense, 50.00m,
                new DateOnly(2026, 1, 15), "A: small expense"),
            new Transaction(_userId, _incomeCategory.Id, TransactionType.Income, 5000.00m,
                new DateOnly(2026, 1, 10), "B: salary"),
            new Transaction(_userId, _expenseCategory.Id, TransactionType.Expense, 200.00m,
                new DateOnly(2026, 1, 20), null),  // null note
            new Transaction(_userId, _incomeCategory.Id, TransactionType.Income, 300.00m,
                new DateOnly(2026, 1, 5), "C: freelance"),
        };
        _context.Transactions.AddRange(txns);
        _context.SaveChanges();
        return txns;
    }

    // ==================== SortBy = null (default backward-compat) ====================

    [Fact]
    public async Task ListAsync_with_null_sort_returns_default_order()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter();

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: default is OccurredOn DESC, CreatedAt DESC
        items.Should().HaveCount(4);
        items[0].Id.Should().Be(txns[2].Id); // Jan 20 (most recent)
        items[1].Id.Should().Be(txns[0].Id); // Jan 15
        items[2].Id.Should().Be(txns[1].Id); // Jan 10
        items[3].Id.Should().Be(txns[3].Id); // Jan 5
    }

    // ==================== OccurredOn ====================

    [Fact]
    public async Task ListAsync_SortBy_OccurredOn_Asc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.OccurredOn, SortOrder = SortOrder.Asc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: oldest first
        items.Should().HaveCount(4);
        items[0].Id.Should().Be(txns[3].Id); // Jan 5
        items[1].Id.Should().Be(txns[1].Id); // Jan 10
        items[2].Id.Should().Be(txns[0].Id); // Jan 15
        items[3].Id.Should().Be(txns[2].Id); // Jan 20
    }

    [Fact]
    public async Task ListAsync_SortBy_OccurredOn_Desc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.OccurredOn, SortOrder = SortOrder.Desc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: newest first (same as default)
        items.Should().HaveCount(4);
        items[0].Id.Should().Be(txns[2].Id); // Jan 20
        items[1].Id.Should().Be(txns[0].Id); // Jan 15
        items[2].Id.Should().Be(txns[1].Id); // Jan 10
        items[3].Id.Should().Be(txns[3].Id); // Jan 5
    }

    // ==================== Amount ====================

    [Fact]
    public async Task ListAsync_SortBy_Amount_Desc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.Amount, SortOrder = SortOrder.Desc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: largest amount first
        items.Should().HaveCount(4);
        items[0].Id.Should().Be(txns[1].Id); // 5000
        items[1].Id.Should().Be(txns[3].Id); // 300
        items[2].Id.Should().Be(txns[2].Id); // 200
        items[3].Id.Should().Be(txns[0].Id); // 50
    }

    [Fact]
    public async Task ListAsync_SortBy_Amount_Asc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.Amount, SortOrder = SortOrder.Asc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: smallest amount first
        items.Should().HaveCount(4);
        items[0].Id.Should().Be(txns[0].Id); // 50
        items[1].Id.Should().Be(txns[2].Id); // 200
        items[2].Id.Should().Be(txns[3].Id); // 300
        items[3].Id.Should().Be(txns[1].Id); // 5000
    }

    // ==================== Type ====================

    [Fact]
    public async Task ListAsync_SortBy_Type_Asc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.Type, SortOrder = SortOrder.Asc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: Income (0) before Expense (1)
        items.Should().HaveCount(4);
        items[0].Type.Should().Be(TransactionType.Income);
        items[1].Type.Should().Be(TransactionType.Income);
        items[2].Type.Should().Be(TransactionType.Expense);
        items[3].Type.Should().Be(TransactionType.Expense);
    }

    // ==================== CategoryName ====================

    [Fact]
    public async Task ListAsync_SortBy_CategoryName_Asc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.CategoryName, SortOrder = SortOrder.Asc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: Food before Salary (F < S)
        items.Should().HaveCount(4);
        items[0].CategoryId.Should().Be(_expenseCategory.Id); // Food
        items[1].CategoryId.Should().Be(_expenseCategory.Id); // Food
        items[2].CategoryId.Should().Be(_incomeCategory.Id);  // Salary
        items[3].CategoryId.Should().Be(_incomeCategory.Id);  // Salary
    }

    // ==================== Note (nullable) ====================

    [Fact]
    public async Task ListAsync_SortBy_Note_Asc()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter { SortBy = TransactionSortBy.Note, SortOrder = SortOrder.Asc };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: alphabetical note — nulls are treated as empty string and
        // sort before non-null values in ascending order (accepting natural
        // EF Core / PostgreSQL NULLS FIRST behaviour per plan Q2).
        items.Should().HaveCount(4);
        items[0].Note.Should().BeNull(); // null first (treated as "")
        items[1].Note.Should().Be("A: small expense");
        items[2].Note.Should().Be("B: salary");
        items[3].Note.Should().Be("C: freelance");
    }

    // ==================== Filter + Sort combined ====================

    [Fact]
    public async Task ListAsync_filters_and_sorts_together()
    {
        // Arrange
        var txns = SeedTransactions();
        var filter = new TransactionFilter
        {
            Type = TransactionType.Expense,
            SortBy = TransactionSortBy.Amount,
            SortOrder = SortOrder.Asc
        };

        // Act
        var (items, _) = await _sut.ListAsync(_userId, filter);

        // Assert: only expenses, sorted by amount ascending
        items.Should().HaveCount(2);
        items[0].Amount.Should().Be(50.00m);
        items[1].Amount.Should().Be(200.00m);
    }
}

/// <summary>
/// Minimal <see cref="ICurrentUserService"/> implementation for testing.
/// </summary>
internal class FakeCurrentUserService : ICurrentUserService
{
    public Guid? UserId { get; }

    public FakeCurrentUserService(Guid userId)
    {
        UserId = userId;
    }
}
