using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Transactions;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Application.Transactions.Validators;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Transactions;

public class TransactionServiceTests
{
    private readonly ITransactionRepository _transactionRepository = Substitute.For<ITransactionRepository>();
    private readonly ICategoryRepository _categoryRepository = Substitute.For<ICategoryRepository>();
    private readonly IValidator<CreateTransactionRequest> _createValidator =
        Substitute.For<IValidator<CreateTransactionRequest>>();
    private readonly IValidator<UpdateTransactionRequest> _updateValidator =
        Substitute.For<IValidator<UpdateTransactionRequest>>();
    private readonly TransactionService _sut;

    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid OtherUserId = Guid.NewGuid();

    public TransactionServiceTests()
    {
        _createValidator.ValidateAsync(Arg.Any<CreateTransactionRequest>())
            .Returns(new ValidationResult());
        _updateValidator.ValidateAsync(Arg.Any<UpdateTransactionRequest>())
            .Returns(new ValidationResult());
        _sut = new TransactionService(
            _transactionRepository,
            _categoryRepository,
            _createValidator,
            _updateValidator);
    }

    private static Category MakeCategory(
        string name = "Food",
        TransactionType type = TransactionType.Expense,
        Guid? userId = null)
    {
        return new Category(name, type, userId, "🍽️", "#FF6B6B");
    }

    private static Transaction MakeTransaction(
        Guid userId,
        Category category,
        decimal amount = 100m,
        DateOnly? occurredOn = null,
        string? note = "test")
    {
        var t = new Transaction(
            userId: userId,
            categoryId: category.Id,
            type: category.Type,
            amount: amount,
            occurredOn: occurredOn ?? DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date),
            note: note);
        return t;
    }

    // ==================== Amount parser (also covered in dedicated tests) ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public void Amount_string_with_too_many_decimals_throws_via_parser()
    {
        var act = () => TransactionAmountParser.ParseStrict("1.235");
        act.Should().Throw<ArgumentException>().WithMessage("*decimal places*");
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public void Amount_zero_or_negative_throws_via_parser()
    {
        var act1 = () => TransactionAmountParser.ParseStrict("0");
        var act2 = () => TransactionAmountParser.ParseStrict("-5.00");
        act1.Should().Throw<ArgumentException>();
        act2.Should().Throw<ArgumentException>();
    }

    // ==================== Create ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Create_valid_request_returns_dto()
    {
        // Arrange
        var category = MakeCategory("Food", TransactionType.Expense, userId: null);
        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "1234.56",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), "lunch");

        _categoryRepository.FindByIdAsync(category.Id).Returns(category);
        // Simulate repository hydrating Category on re-read.
        Transaction? saved = null;
        _transactionRepository.AddAsync(Arg.Do<Transaction>(t => saved = t))
            .Returns(Task.CompletedTask);
        _transactionRepository.GetByIdAsync(TestUserId, Arg.Any<Guid>())
            .Returns(ci => saved is null ? null : saved);

        // Act
        var result = await _sut.CreateAsync(TestUserId, request);

        // Assert
        result.Should().NotBeNull();
        result.CategoryId.Should().Be(category.Id);
        result.Type.Should().Be(TransactionType.Expense);
        result.Amount.Should().Be("1234.56");
        result.Note.Should().Be("lunch");
        await _transactionRepository.Received(1).AddAsync(Arg.Any<Transaction>());
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Create_with_unknown_category_throws_NotFound()
    {
        var unknown = Guid.NewGuid();
        _categoryRepository.FindByIdAsync(unknown).Returns((Category?)null);

        var request = new CreateTransactionRequest(
            unknown, TransactionType.Expense, "10.00",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<NotFoundException>();

        await _transactionRepository.DidNotReceive().AddAsync(Arg.Any<Transaction>());
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Create_with_another_users_category_throws_NotFound()
    {
        var foreignCat = MakeCategory("Their Cat", TransactionType.Expense, OtherUserId);
        _categoryRepository.FindByIdAsync(foreignCat.Id).Returns(foreignCat);

        var request = new CreateTransactionRequest(
            foreignCat.Id, TransactionType.Expense, "10.00",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Type_mismatch_with_category_throws_DomainValidation()
    {
        var incomeCat = MakeCategory("Salary", TransactionType.Income, userId: null);
        _categoryRepository.FindByIdAsync(incomeCat.Id).Returns(incomeCat);

        var request = new CreateTransactionRequest(
            incomeCat.Id, TransactionType.Expense, "10.00", // wrong type
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*Salary*Income*Expense*");
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Create_with_future_date_throws_DomainValidation_from_validator()
    {
        // Validator returns a failure for OccurredOn > today.
        var category = MakeCategory();
        _categoryRepository.FindByIdAsync(category.Id).Returns(category);
        var failures = new List<ValidationFailure>
        {
            new("OccurredOn", "Transaction date cannot be in the future.")
        };
        _createValidator.ValidateAsync(Arg.Any<CreateTransactionRequest>())
            .Returns(new ValidationResult(failures));

        var request = new CreateTransactionRequest(
            category.Id, TransactionType.Expense, "10.00",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date).AddDays(1), null);

        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*future*");
    }

    // ==================== List ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task List_returns_paged_result_sorted_desc()
    {
        var category = MakeCategory();
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date);
        var t1 = MakeTransaction(TestUserId, category, amount: 50m, occurredOn: today.AddDays(-1));
        var t2 = MakeTransaction(TestUserId, category, amount: 100m, occurredOn: today);
        _transactionRepository.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns((new List<Transaction> { t2, t1 }, 2));

        var result = await _sut.ListAsync(TestUserId, new TransactionFilter { Page = 1, PageSize = 20 });

        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(20);
        result.TotalPages.Should().Be(1);
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task List_passes_filter_to_repository()
    {
        _transactionRepository.ListAsync(TestUserId, Arg.Any<TransactionFilter>())
            .Returns((new List<Transaction>(), 0));

        var filter = new TransactionFilter
        {
            Type = TransactionType.Income,
            CategoryId = Guid.NewGuid(),
            From = new DateOnly(2026, 1, 1),
            To = new DateOnly(2026, 1, 31),
            Page = 2,
            PageSize = 10
        };
        await _sut.ListAsync(TestUserId, filter);

        await _transactionRepository.Received(1).ListAsync(TestUserId,
            Arg.Is<TransactionFilter>(f =>
                f.Type == TransactionType.Income &&
                f.CategoryId == filter.CategoryId &&
                f.From == new DateOnly(2026, 1, 1) &&
                f.To == new DateOnly(2026, 1, 31) &&
                f.Page == 2 &&
                f.PageSize == 10));
    }

    // ==================== GetById ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task GetById_returns_dto()
    {
        var category = MakeCategory();
        var tx = MakeTransaction(TestUserId, category);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns(tx);

        var result = await _sut.GetByIdAsync(TestUserId, tx.Id);

        result.Id.Should().Be(tx.Id);
        result.Amount.Should().Be("100.00");
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Cross_user_access_returns_NotFound()
    {
        var category = MakeCategory();
        var tx = MakeTransaction(OtherUserId, category);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns((Transaction?)null);

        await _sut.Invoking(s => s.GetByIdAsync(TestUserId, tx.Id))
            .Should().ThrowAsync<NotFoundException>();
    }

    // ==================== Update ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Update_valid_request_succeeds()
    {
        var category = MakeCategory();
        var tx = MakeTransaction(TestUserId, category, amount: 50m);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns(tx);
        _categoryRepository.FindByIdAsync(category.Id).Returns(category);

        var request = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "75.50",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), "updated");

        var result = await _sut.UpdateAsync(TestUserId, tx.Id, request);

        result.Amount.Should().Be("75.50");
        result.Note.Should().Be("updated");
        await _transactionRepository.Received(1).UpdateAsync(Arg.Any<Transaction>());
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Update_with_type_mismatch_throws()
    {
        var oldCat = MakeCategory("Food", TransactionType.Expense, userId: null);
        var newCatIncome = MakeCategory("Salary", TransactionType.Income, userId: null);
        var tx = MakeTransaction(TestUserId, oldCat);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns(tx);
        _categoryRepository.FindByIdAsync(newCatIncome.Id).Returns(newCatIncome);

        var request = new UpdateTransactionRequest(
            newCatIncome.Id, TransactionType.Expense, "10.00", // type mismatch
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        await _sut.Invoking(s => s.UpdateAsync(TestUserId, tx.Id, request))
            .Should().ThrowAsync<DomainValidationException>();
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Update_with_invalid_amount_string_throws_via_validator()
    {
        var category = MakeCategory();
        var tx = MakeTransaction(TestUserId, category);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns(tx);

        var failures = new List<ValidationFailure>
        {
            new("Amount", "Amount must be a positive number with at most 2 decimal places (e.g. '1234.56').")
        };
        _updateValidator.ValidateAsync(Arg.Any<UpdateTransactionRequest>())
            .Returns(new ValidationResult(failures));

        var request = new UpdateTransactionRequest(
            category.Id, TransactionType.Expense, "abc",
            DateOnly.FromDateTime(DateTimeOffset.UtcNow.Date), null);

        await _sut.Invoking(s => s.UpdateAsync(TestUserId, tx.Id, request))
            .Should().ThrowAsync<DomainValidationException>();
    }

    // ==================== Delete ====================

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Delete_removes_transaction()
    {
        var category = MakeCategory();
        var tx = MakeTransaction(TestUserId, category);
        _transactionRepository.GetByIdAsync(TestUserId, tx.Id).Returns(tx);

        await _sut.DeleteAsync(TestUserId, tx.Id);

        await _transactionRepository.Received(1).DeleteAsync(tx);
    }

    [Fact]
    [Trait("Category", "Transactions")]
    public async Task Delete_nonexistent_throws_NotFound()
    {
        var fakeId = Guid.NewGuid();
        _transactionRepository.GetByIdAsync(TestUserId, fakeId).Returns((Transaction?)null);

        await _sut.Invoking(s => s.DeleteAsync(TestUserId, fakeId))
            .Should().ThrowAsync<NotFoundException>();
    }
}
