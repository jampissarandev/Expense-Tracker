using ExpenseTracker.Application.Categories.DTOs;

namespace ExpenseTracker.Application.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> ListAsync(Guid userId);
    Task<CategoryDto> CreateAsync(Guid userId, CreateCategoryRequest request);
    Task<CategoryDto> UpdateAsync(Guid userId, Guid id, UpdateCategoryRequest request);
    Task DeleteAsync(Guid userId, Guid id);
}
