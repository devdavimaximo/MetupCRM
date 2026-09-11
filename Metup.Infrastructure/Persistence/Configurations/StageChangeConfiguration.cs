using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class StageChangeConfiguration : IEntityTypeConfiguration<StageChange>
{
    public void Configure(EntityTypeBuilder<StageChange> builder)
    {
        builder.ToTable("stage_changes");

        builder.HasKey(sc => sc.Id);
        builder.Property(sc => sc.Id).HasColumnName("id");

        builder.Property(sc => sc.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(sc => sc.DealId)
            .HasColumnName("deal_id")
            .IsRequired();

        builder.Property(sc => sc.FromStage)
            .HasColumnName("from_stage")
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(sc => sc.ToStage)
            .HasColumnName("to_stage")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(sc => sc.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        builder.Property(sc => sc.ChangedByUserId)
            .HasColumnName("changed_by_user_id")
            .IsRequired();

        // Histórico de um negócio, na ordem em que aconteceu — a consulta que alimenta a ficha.
        builder.HasIndex(sc => new { sc.DealId, sc.ChangedAt });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(sc => sc.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
