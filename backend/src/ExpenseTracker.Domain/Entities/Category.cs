using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Domain.Entities;

public class Category
{
    private const int MaxNameLength = 50;
    private const int MaxIconLength = 50;

    private Category()
    {
    }

    public Category(string name, TransactionType type, Guid? userId = null, string? icon = null, string? color = null)
    {
        Id = Guid.NewGuid();
        Name = name ?? throw new ArgumentNullException(nameof(name));
        Type = type;
        UserId = userId;
        Icon = icon;
        Color = color;
        IsSystem = userId is null;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid? UserId { get; private set; }
    public string Name { get; private set; } = null!;
    public TransactionType Type { get; private set; }
    public string? Icon { get; private set; }
    public string? Color { get; private set; }
    public bool IsSystem { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Category name cannot be empty.", nameof(name));

        // Normalize whitespace: trim and collapse multiple spaces
        var normalized = string.Join(" ", name.Split(' ', StringSplitOptions.RemoveEmptyEntries));

        // Truncate to max length
        if (normalized.Length > MaxNameLength)
            normalized = normalized[..MaxNameLength];

        Name = normalized.Trim();
    }

    public void UpdateAppearance(string? icon, string? color)
    {
        if (icon is not null && icon.Length > MaxIconLength)
            throw new ArgumentException($"Icon must be {MaxIconLength} characters or fewer.", nameof(icon));

        if (color is not null && !IsValidHexColor(color))
            throw new ArgumentException("Color must be a valid hex color (e.g., #FF6B6B).", nameof(color));

        Icon = icon;
        Color = color;
    }

    private static bool IsValidHexColor(string color) =>
        color.StartsWith('#') && color.Length == 7 &&
        color[1..].All(c => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
}
