using ExpenseTracker.Application.Categories.DTOs;
using FluentValidation;

namespace ExpenseTracker.Application.Categories;

public class CreateCategoryRequestValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(50)
            .WithMessage("Category name is required and must be 50 characters or fewer.");

        RuleFor(x => x.Type)
            .IsInEnum()
            .WithMessage("Type must be a valid TransactionType (Income or Expense).");

        RuleFor(x => x.Icon)
            .MaximumLength(50)
            .When(x => x.Icon is not null)
            .WithMessage("Icon must be 50 characters or fewer.");

        RuleFor(x => x.Color)
            .Matches("^#[0-9A-Fa-f]{6}$")
            .When(x => x.Color is not null)
            .WithMessage("Color must be a valid hex color (e.g., #FF6B6B).");
    }
}

public class UpdateCategoryRequestValidator : AbstractValidator<UpdateCategoryRequest>
{
    public UpdateCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(50)
            .WithMessage("Category name is required and must be 50 characters or fewer.");

        RuleFor(x => x.Icon)
            .MaximumLength(50)
            .When(x => x.Icon is not null)
            .WithMessage("Icon must be 50 characters or fewer.");

        RuleFor(x => x.Color)
            .Matches("^#[0-9A-Fa-f]{6}$")
            .When(x => x.Color is not null)
            .WithMessage("Color must be a valid hex color (e.g., #FF6B6B).");
    }
}
