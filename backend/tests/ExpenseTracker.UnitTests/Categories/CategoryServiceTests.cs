using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Categories;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Categories;

public class CategoryServiceTests
{
    private readonly ICategoryRepository _categoryRepository = Substitute.For<ICategoryRepository>();
    private readonly IValidator<CreateCategoryRequest> _createValidator = Substitute.For<IValidator<CreateCategoryRequest>>();
    private readonly IValidator<UpdateCategoryRequest> _updateValidator = Substitute.For<IValidator<UpdateCategoryRequest>>();
    private readonly CategoryService _sut;

    private static readonly Guid TestUserId = Guid.NewGuid();

    public CategoryServiceTests()
    {
        _sut = new CategoryService(_categoryRepository, _createValidator, _updateValidator);
    }

    private static void SetupValidCreateValidation(CreateCategoryRequest request)
    {
        var result = new ValidationResult();
        // NSubstitute returns default validation result; we need a valid one
    }

    // ==================== List ====================

    [Fact]
    [Trait("Category", "Categories")]
    public async Task List_returns_system_and_user_categories()
    {
        // Arrange
        var systemCategory = new Category("Food", TransactionType.Expense, userId: null, "🍽️", "#FF6B6B");
        var userCategory = new Category("Custom Food", TransactionType.Expense, TestUserId, "🍕", "#00FF00");

        _categoryRepository.ListByUserAsync(TestUserId)
            .Returns(new List<Category> { systemCategory, userCategory });

        // Act
        var result = await _sut.ListAsync(TestUserId);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(c => c.IsSystem && c.Name == "Food");
        result.Should().Contain(c => !c.IsSystem && c.Name == "Custom Food" && c.UserId == TestUserId);
    }

    // ==================== Create ====================

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Create_valid_category_returns_dto()
    {
        // Arrange
        var request = new CreateCategoryRequest("My Budget", TransactionType.Expense, "💡", "#ABCDEF");
        _createValidator.ValidateAsync(request)
            .Returns(new ValidationResult());

        _categoryRepository.AddAsync(Arg.Any<Category>())
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateAsync(TestUserId, request);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("My Budget");
        result.Type.Should().Be(TransactionType.Expense);
        result.Icon.Should().Be("💡");
        result.Color.Should().Be("#ABCDEF");
        result.UserId.Should().Be(TestUserId);
        result.IsSystem.Should().BeFalse();

        await _categoryRepository.Received(1).AddAsync(Arg.Any<Category>());
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Create_validates_name_length()
    {
        // Arrange — validator returns failure
        var request = new CreateCategoryRequest("", TransactionType.Expense, null, null);
        var failures = new List<ValidationFailure>
        {
            new("Name", "Category name is required and must be 50 characters or fewer.")
        };
        _createValidator.ValidateAsync(request)
            .Returns(new ValidationResult(failures));

        // Act & Assert
        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*required*");

        await _categoryRepository.DidNotReceive().AddAsync(Arg.Any<Category>());
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Create_validates_color_format()
    {
        // Arrange — validator returns failure for invalid color
        var request = new CreateCategoryRequest("Bad Color", TransactionType.Expense, null, "not-a-color");
        var failures = new List<ValidationFailure>
        {
            new("Color", "Color must be a valid hex color (e.g., #FF6B6B).")
        };
        _createValidator.ValidateAsync(request)
            .Returns(new ValidationResult(failures));

        // Act & Assert
        await _sut.Invoking(s => s.CreateAsync(TestUserId, request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*hex color*");
    }

    // ==================== Update ====================

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Update_on_system_category_throws_Forbidden()
    {
        // Arrange
        var systemCategory = new Category("Food", TransactionType.Expense, userId: null);
        var id = systemCategory.Id;
        _categoryRepository.FindByIdAsync(id).Returns(systemCategory);

        var request = new UpdateCategoryRequest("Renamed", null, null);

        // Act & Assert
        await _sut.Invoking(s => s.UpdateAsync(TestUserId, id, request))
            .Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*System categories*");
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Update_on_other_users_category_throws_NotFound()
    {
        // Arrange
        var otherUserId = Guid.NewGuid();
        var otherCategory = new Category("Their Category", TransactionType.Expense, otherUserId);
        _categoryRepository.FindByIdAsync(otherCategory.Id).Returns(otherCategory);

        var request = new UpdateCategoryRequest("Renamed", null, null);

        // Act & Assert
        await _sut.Invoking(s => s.UpdateAsync(TestUserId, otherCategory.Id, request))
            .Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Update_valid_category_succeeds()
    {
        // Arrange
        var userCategory = new Category("Old Name", TransactionType.Expense, TestUserId, "📦", "#000000");
        _categoryRepository.FindByIdAsync(userCategory.Id).Returns(userCategory);
        _updateValidator.ValidateAsync(Arg.Any<UpdateCategoryRequest>())
            .Returns(new ValidationResult());

        var request = new UpdateCategoryRequest("New Name", "🎯", "#FFFFFF");

        // Act
        var result = await _sut.UpdateAsync(TestUserId, userCategory.Id, request);

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("New Name");
        result.Icon.Should().Be("🎯");
        result.Color.Should().Be("#FFFFFF");

        await _categoryRepository.Received(1).UpdateAsync(Arg.Any<Category>());
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Update_validation_failure_throws_DomainValidation()
    {
        // Arrange
        var userCategory = new Category("My Cat", TransactionType.Expense, TestUserId);
        _categoryRepository.FindByIdAsync(userCategory.Id).Returns(userCategory);

        var request = new UpdateCategoryRequest("", null, null);
        var failures = new List<ValidationFailure>
        {
            new("Name", "Category name is required and must be 50 characters or fewer.")
        };
        _updateValidator.ValidateAsync(request)
            .Returns(new ValidationResult(failures));

        // Act & Assert
        await _sut.Invoking(s => s.UpdateAsync(TestUserId, userCategory.Id, request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*required*");
    }

    // ==================== Delete ====================

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Delete_system_category_throws_Forbidden()
    {
        // Arrange
        var systemCategory = new Category("Food", TransactionType.Expense, userId: null);
        _categoryRepository.FindByIdAsync(systemCategory.Id).Returns(systemCategory);

        // Act & Assert
        await _sut.Invoking(s => s.DeleteAsync(TestUserId, systemCategory.Id))
            .Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*System categories*");
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Delete_with_referencing_transactions_throws_Validation()
    {
        // Arrange
        var userCategory = new Category("My Cat", TransactionType.Expense, TestUserId);
        _categoryRepository.FindByIdAsync(userCategory.Id).Returns(userCategory);
        _categoryRepository.HasTransactionsAsync(userCategory.Id).Returns(true);

        // Act & Assert
        await _sut.Invoking(s => s.DeleteAsync(TestUserId, userCategory.Id))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*transactions*");

        await _categoryRepository.DidNotReceive().DeleteAsync(Arg.Any<Category>());
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Delete_valid_category_succeeds()
    {
        // Arrange
        var userCategory = new Category("My Cat", TransactionType.Expense, TestUserId);
        _categoryRepository.FindByIdAsync(userCategory.Id).Returns(userCategory);
        _categoryRepository.HasTransactionsAsync(userCategory.Id).Returns(false);

        // Act
        await _sut.DeleteAsync(TestUserId, userCategory.Id);

        // Assert
        await _categoryRepository.Received(1).DeleteAsync(userCategory);
    }

    [Fact]
    [Trait("Category", "Categories")]
    public async Task Delete_nonexistent_category_throws_NotFound()
    {
        // Arrange
        var fakeId = Guid.NewGuid();
        _categoryRepository.FindByIdAsync(fakeId).Returns((Category?)null);

        // Act & Assert
        await _sut.Invoking(s => s.DeleteAsync(TestUserId, fakeId))
            .Should().ThrowAsync<NotFoundException>();
    }

    // ==================== Domain: Category.UpdateAppearance ====================

    [Fact]
    [Trait("Category", "Domain")]
    public void Category_UpdateAppearance_updates_icon_and_color()
    {
        // Arrange
        var category = new Category("Test", TransactionType.Expense, TestUserId, "old", "#000000");

        // Act
        category.UpdateAppearance("new", "#FFFFFF");

        // Assert
        category.Icon.Should().Be("new");
        category.Color.Should().Be("#FFFFFF");
    }

    [Fact]
    [Trait("Category", "Domain")]
    public void Category_UpdateAppearance_rejects_invalid_color()
    {
        var category = new Category("Test", TransactionType.Expense, TestUserId);

        category.Invoking(c => c.UpdateAppearance(null, "bad"))
            .Should().Throw<ArgumentException>()
            .WithMessage("*hex color*");
    }

    [Fact]
    [Trait("Category", "Domain")]
    public void Category_UpdateAppearance_rejects_long_icon()
    {
        var category = new Category("Test", TransactionType.Expense, TestUserId);
        var longIcon = new string('a', 51);

        category.Invoking(c => c.UpdateAppearance(longIcon, null))
            .Should().Throw<ArgumentException>()
            .WithMessage("*50 characters*");
    }

    // ==================== Domain: Category.Rename ====================

    [Fact]
    [Trait("Category", "Domain")]
    public void Category_Rename_normalizes_whitespace_and_truncates()
    {
        // Arrange
        var category = new Category("Test", TransactionType.Expense, TestUserId);

        // Act
        category.Rename("   lots   of   spaces   ");

        // Assert
        category.Name.Should().Be("lots of spaces");
    }

    [Fact]
    [Trait("Category", "Domain")]
    public void Category_Rename_truncates_to_50_chars()
    {
        // Arrange
        var category = new Category("Test", TransactionType.Expense, TestUserId);
        var longName = new string('X', 60);

        // Act
        category.Rename(longName);

        // Assert
        category.Name.Should().HaveLength(50);
    }
}
