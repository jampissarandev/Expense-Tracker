using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Enums;

namespace ExpenseTracker.Infrastructure.Persistence.SeedData;

public static class SystemCategories
{
    // Deterministic IDs for seed data (EF HasData requires stable keys)
    public static readonly Guid FoodId = new("a1b2c3d4-0001-0000-0000-000000000001");
    public static readonly Guid TransportId = new("a1b2c3d4-0001-0000-0000-000000000002");
    public static readonly Guid ShoppingId = new("a1b2c3d4-0001-0000-0000-000000000003");
    public static readonly Guid BillsId = new("a1b2c3d4-0001-0000-0000-000000000004");
    public static readonly Guid HealthId = new("a1b2c3d4-0001-0000-0000-000000000005");
    public static readonly Guid EntertainmentId = new("a1b2c3d4-0001-0000-0000-000000000006");
    public static readonly Guid ExpenseOtherId = new("a1b2c3d4-0001-0000-0000-000000000007");
    public static readonly Guid SalaryId = new("a1b2c3d4-0002-0000-0000-000000000001");
    public static readonly Guid BonusId = new("a1b2c3d4-0002-0000-0000-000000000002");
    public static readonly Guid GiftId = new("a1b2c3d4-0002-0000-0000-000000000003");
    public static readonly Guid InvestmentId = new("a1b2c3d4-0002-0000-0000-000000000004");
    public static readonly Guid IncomeOtherId = new("a1b2c3d4-0002-0000-0000-000000000005");

    public static readonly DateTimeOffset CreatedAt = new(2024, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static Category[] Categories => new[]
    {
        Create(FoodId, "Food", TransactionType.Expense, "🍽️", "#FF6B6B"),
        Create(TransportId, "Transport", TransactionType.Expense, "🚗", "#4ECDC4"),
        Create(ShoppingId, "Shopping", TransactionType.Expense, "🛍️", "#45B7D1"),
        Create(BillsId, "Bills", TransactionType.Expense, "📄", "#96CEB4"),
        Create(HealthId, "Health", TransactionType.Expense, "🏥", "#FFEAA7"),
        Create(EntertainmentId, "Entertainment", TransactionType.Expense, "🎬", "#DDA0DD"),
        Create(ExpenseOtherId, "Other", TransactionType.Expense, "📦", "#A0A0A0"),
        Create(SalaryId, "Salary", TransactionType.Income, "💰", "#2ECC71"),
        Create(BonusId, "Bonus", TransactionType.Income, "🎁", "#3498DB"),
        Create(GiftId, "Gift", TransactionType.Income, "🎉", "#E74C3C"),
        Create(InvestmentId, "Investment", TransactionType.Income, "📈", "#9B59B6"),
        Create(IncomeOtherId, "Other", TransactionType.Income, "💵", "#A0A0A0"),
    };

    private static Category Create(Guid id, string name, TransactionType type, string icon, string color)
    {
        // Create via constructor then override Id for deterministic seed data
        var category = new Category(name, type, userId: null, icon, color);
        typeof(Category).GetProperty(nameof(Category.Id))!.SetValue(category, id);
        typeof(Category).GetProperty(nameof(Category.CreatedAt))!.SetValue(category, CreatedAt);
        return category;
    }
}
