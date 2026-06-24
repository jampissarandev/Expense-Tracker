using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Infrastructure.Persistence.Configurations;
using ExpenseTracker.Infrastructure.Persistence.SeedData;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTracker.Infrastructure.Persistence;

public class ExpenseTrackerDbContext : DbContext
{
    private readonly ICurrentUserService _currentUserService;

    public ExpenseTrackerDbContext(
        DbContextOptions<ExpenseTrackerDbContext> options,
        ICurrentUserService currentUserService)
        : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations from this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ExpenseTrackerDbContext).Assembly);

        // Seed system categories
        modelBuilder.Entity<Category>().HasData(SystemCategories.Categories);

        // Global query filters: per-user data isolation.
        // Categories: system categories (UserId IS NULL) are visible to everyone;
        // user categories are visible only to their owner.
        // Transactions: visible only to the owner.
        // These filters use IgnoreQueryFilters() to be bypassed in admin/seed code.
        modelBuilder.Entity<Category>().HasQueryFilter(c =>
            c.UserId == null || c.UserId == _currentUserService.UserId);

        modelBuilder.Entity<Transaction>().HasQueryFilter(t =>
            _currentUserService.UserId != null && t.UserId == _currentUserService.UserId);
    }
}
