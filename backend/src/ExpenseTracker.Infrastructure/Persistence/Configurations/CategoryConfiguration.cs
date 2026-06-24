using ExpenseTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExpenseTracker.Infrastructure.Persistence.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(c => c.Type)
            .IsRequired();

        builder.Property(c => c.Icon)
            .HasMaxLength(50);

        builder.Property(c => c.Color)
            .HasMaxLength(7);

        // Index for querying categories by user
        builder.HasIndex(c => c.UserId);

        // Index for filtering by type
        builder.HasIndex(c => c.Type);

        // Unique index on (UserId, Name, Type) where UserId IS NOT NULL (user categories)
        builder.HasIndex(c => new { c.UserId, c.Name, c.Type })
            .IsUnique()
            .HasFilter("\"UserId\" IS NOT NULL");

        // Unique index for system categories (UserId IS NULL)
        builder.HasIndex(c => new { c.Name, c.Type })
            .IsUnique()
            .HasFilter("\"UserId\" IS NULL");
    }
}
