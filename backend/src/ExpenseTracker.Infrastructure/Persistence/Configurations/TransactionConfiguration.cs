using ExpenseTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExpenseTracker.Infrastructure.Persistence.Configurations;

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Type)
            .IsRequired();

        builder.Property(t => t.Amount)
            .HasColumnType("numeric(18,2)")
            .IsRequired();

        builder.Property(t => t.OccurredOn)
            .IsRequired();

        builder.Property(t => t.Note)
            .HasMaxLength(500);

        // Index for list page and dashboard (user, date DESC)
        builder.HasIndex(t => new { t.UserId, t.OccurredOn })
            .IsDescending(false, true);

        // Index for chart aggregations (user, type, date)
        builder.HasIndex(t => new { t.UserId, t.Type, t.OccurredOn });

        // Relationship to Category
        builder.HasOne(t => t.Category)
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
