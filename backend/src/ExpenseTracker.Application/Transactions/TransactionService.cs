using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Transactions.DTOs;
using ExpenseTracker.Application.Transactions.Filters;
using ExpenseTracker.Application.Transactions.Validators;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;
using ExpenseTracker.Domain.Exceptions;
using FluentValidation;

namespace ExpenseTracker.Application.Transactions;

public class TransactionService : ITransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IValidator<CreateTransactionRequest> _createValidator;
    private readonly IValidator<UpdateTransactionRequest> _updateValidator;

    public TransactionService(
        ITransactionRepository transactionRepository,
        ICategoryRepository categoryRepository,
        IValidator<CreateTransactionRequest> createValidator,
        IValidator<UpdateTransactionRequest> updateValidator)
    {
        _transactionRepository = transactionRepository;
        _categoryRepository = categoryRepository;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    public async Task<PagedResult<TransactionDto>> ListAsync(Guid userId, TransactionFilter filter)
    {
        var (items, totalCount) = await _transactionRepository.ListAsync(userId, filter);
        var pageSize = filter.PageSize <= 0 ? TransactionFilter.DefaultPageSize : filter.PageSize;
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var dtos = items.Select(MapToDto).ToList();
        return new PagedResult<TransactionDto>(dtos, filter.Page, pageSize, totalCount, totalPages);
    }

    public async Task<TransactionDto> GetByIdAsync(Guid userId, Guid id)
    {
        var transaction = await _transactionRepository.GetByIdAsync(userId, id)
            ?? throw new NotFoundException("Transaction", id);
        return MapToDto(transaction);
    }

    public async Task<TransactionDto> CreateAsync(Guid userId, CreateTransactionRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            throw new DomainValidationException(FormatErrors(validation));
        }

        var category = await LoadAndValidateCategoryAsync(userId, request.CategoryId, request.Type);

        // Parser enforces 0 < amount <= MaxAmount, <= 2 decimal places.
        var amount = TransactionAmountParser.ParseStrict(request.Amount);

        var entity = new Transaction(
            userId: userId,
            categoryId: category.Id,
            type: request.Type,
            amount: amount,
            occurredOn: request.OccurredOn,
            note: request.Note);

        // Attach the loaded navigation so the DTO mapper can read its Name.
        // Setter is private; use reflection-free approach via the domain's Update path
        // is not possible. Instead, we accept that EF will lazy-load it. To keep the
        // service layer free of EF, the repository hydrates Category in the AddAsync path.
        await _transactionRepository.AddAsync(entity);

        // Re-read to get the category navigation hydrated by the repository.
        var saved = await _transactionRepository.GetByIdAsync(userId, entity.Id)
            ?? throw new InvalidOperationException("Transaction was not persisted.");
        return MapToDto(saved);
    }

    public async Task<TransactionDto> UpdateAsync(Guid userId, Guid id, UpdateTransactionRequest request)
    {
        var transaction = await _transactionRepository.GetByIdAsync(userId, id)
            ?? throw new NotFoundException("Transaction", id);

        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            throw new DomainValidationException(FormatErrors(validation));
        }

        var category = await LoadAndValidateCategoryAsync(userId, request.CategoryId, request.Type);
        var amount = TransactionAmountParser.ParseStrict(request.Amount);

        transaction.Update(
            categoryId: category.Id,
            type: request.Type,
            amount: amount,
            occurredOn: request.OccurredOn,
            note: request.Note);

        await _transactionRepository.UpdateAsync(transaction);

        var refreshed = await _transactionRepository.GetByIdAsync(userId, id)
            ?? throw new InvalidOperationException("Transaction disappeared after update.");
        return MapToDto(refreshed);
    }

    public async Task DeleteAsync(Guid userId, Guid id)
    {
        var transaction = await _transactionRepository.GetByIdAsync(userId, id)
            ?? throw new NotFoundException("Transaction", id);
        await _transactionRepository.DeleteAsync(transaction);
    }

    private async Task<Category> LoadAndValidateCategoryAsync(Guid userId, Guid categoryId, TransactionType type)
    {
        var category = await _categoryRepository.FindByIdAsync(categoryId)
            ?? throw new NotFoundException("Category", categoryId);

        // A category is accessible to the user if it is system-owned (UserId IS NULL)
        // or owned by them. Global query filter does the same in EF; the explicit
        // check here keeps the service unit-testable without a DbContext.
        var accessible = category.IsSystem || category.UserId == userId;
        if (!accessible)
        {
            throw new NotFoundException("Category", categoryId);
        }

        if (category.Type != type)
        {
            throw new DomainValidationException(
                $"Category '{category.Name}' is for {category.Type}, not {type}.");
        }

        return category;
    }

    private static string FormatErrors(FluentValidation.Results.ValidationResult result)
    {
        return string.Join("; ", result.Errors.Select(e => e.ErrorMessage));
    }

    private static TransactionDto MapToDto(Transaction t) =>
        new(
            t.Id,
            t.CategoryId,
            t.Category?.Name ?? string.Empty,
            t.Type,
            t.Amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
            t.OccurredOn,
            t.Note,
            t.CreatedAt,
            t.UpdatedAt);
}
