using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Categories.DTOs;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Exceptions;
using FluentValidation;

namespace ExpenseTracker.Application.Categories;

public class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly IValidator<CreateCategoryRequest> _createValidator;
    private readonly IValidator<UpdateCategoryRequest> _updateValidator;

    public CategoryService(
        ICategoryRepository categoryRepository,
        IValidator<CreateCategoryRequest> createValidator,
        IValidator<UpdateCategoryRequest> updateValidator)
    {
        _categoryRepository = categoryRepository;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    public async Task<IReadOnlyList<CategoryDto>> ListAsync(Guid userId)
    {
        var categories = await _categoryRepository.ListByUserAsync(userId);
        return categories.Select(MapToDto).ToList();
    }

    public async Task<CategoryDto> CreateAsync(Guid userId, CreateCategoryRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            var errors = string.Join("; ", validation.Errors.Select(e => e.ErrorMessage));
            throw new DomainValidationException(errors);
        }

        var category = new Category(request.Name, request.Type, userId, request.Icon, request.Color);
        await _categoryRepository.AddAsync(category);

        return MapToDto(category);
    }

    public async Task<CategoryDto> UpdateAsync(Guid userId, Guid id, UpdateCategoryRequest request)
    {
        var category = await _categoryRepository.FindByIdAsync(id)
            ?? throw new NotFoundException("Category", id);

        if (category.IsSystem)
            throw new ForbiddenException("System categories cannot be modified.");

        if (category.UserId != userId)
            throw new NotFoundException("Category", id);

        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            var errors = string.Join("; ", validation.Errors.Select(e => e.ErrorMessage));
            throw new DomainValidationException(errors);
        }

        category.Rename(request.Name);
        category.UpdateAppearance(request.Icon, request.Color);

        await _categoryRepository.UpdateAsync(category);
        return MapToDto(category);
    }

    public async Task DeleteAsync(Guid userId, Guid id)
    {
        var category = await _categoryRepository.FindByIdAsync(id)
            ?? throw new NotFoundException("Category", id);

        if (category.IsSystem)
            throw new ForbiddenException("System categories cannot be deleted.");

        if (category.UserId != userId)
            throw new NotFoundException("Category", id);

        var hasTransactions = await _categoryRepository.HasTransactionsForUserAsync(id, userId);
        if (hasTransactions)
            throw new DomainValidationException("Cannot delete a category that has transactions. Remove or reassign them first.");

        await _categoryRepository.DeleteAsync(category);
    }

    private static CategoryDto MapToDto(Category category) =>
        new(
            category.Id,
            category.UserId,
            category.Name,
            category.Type,
            category.Icon,
            category.Color,
            category.IsSystem,
            category.CreatedAt);
}
