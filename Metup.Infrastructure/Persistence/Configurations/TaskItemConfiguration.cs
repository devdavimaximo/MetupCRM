using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("tasks");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");

        builder.Property(t => t.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(t => t.DealId)
            .HasColumnName("deal_id")
            .IsRequired();

        builder.Property(t => t.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.DueDate)
            .HasColumnName("due_date")
            .IsRequired();

        builder.Property(t => t.OwnerUserId)
            .HasColumnName("owner_user_id")
            .IsRequired();

        builder.Property(t => t.Note)
            .HasColumnName("note")
            .HasMaxLength(500);

        builder.Property(t => t.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(t => t.CompletedAt)
            .HasColumnName("completed_at");

        // A lista "hoje você tem follow-up" do SDR — responsável + status + vencimento (seção 3 do CLAUDE.md).
        builder.HasIndex(t => new { t.OrganizationId, t.OwnerUserId, t.Status, t.DueDate });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(t => t.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Deal>()
            .WithMany()
            .HasForeignKey(t => t.DealId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(t => t.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
