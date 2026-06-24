using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Categories.DTOs;

public record CategoryDto(
    Guid Id,
    Guid? UserId,
    string Name,
    TransactionType Type,
    string? Icon,
    string? Color,
    bool IsSystem,
    DateTimeOffset CreatedAt);

public record CreateCategoryRequest(
    string Name,
    TransactionType Type,
    string? Icon,
    string? Color);

public record UpdateCategoryRequest(
    string Name,
    string? Icon,
    string? Color);
