using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Application.Transactions.DTOs;

public record TransactionDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    TransactionType Type,
    string Amount,
    DateOnly OccurredOn,
    string? Note,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Request body for POST /api/transactions. Amount is a string to preserve
/// decimal precision when crossing the JSON boundary (JS clients cannot
/// reliably represent decimal(18,2)).
/// </summary>
public record CreateTransactionRequest(
    Guid CategoryId,
    TransactionType Type,
    string Amount,
    DateOnly OccurredOn,
    string? Note);

public record UpdateTransactionRequest(
    Guid CategoryId,
    TransactionType Type,
    string Amount,
    DateOnly OccurredOn,
    string? Note);
