using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class DealValueChangeConfiguration : IEntityTypeConfiguration<DealValueChange>
{
    public void Configure(EntityTypeBuilder<DealValueChange> builder)
    {
        builder.ToTable("deal_value_changes");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasColumnName("id");

        builder.Property(v => v.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(v => v.DealId)
            .HasColumnName("deal_id")
            .IsRequired();

        // Dinheiro sempre decimal, nunca float (regra 4.7 do CLAUDE.md) — mesma precisão de deals.
        builder.Property(v => v.FromAmount)
            .HasColumnName("from_amount")
            .HasColumnType("numeric(18,2)");

        builder.Property(v => v.ToAmount)
            .HasColumnName("to_amount")
            .HasColumnType("numeric(18,2)");

        builder.Property(v => v.FromTicket)
            .HasColumnName("from_ticket")
            .HasColumnType("numeric(18,2)");

        builder.Property(v => v.ToTicket)
            .HasColumnName("to_ticket")
            .HasColumnType("numeric(18,2)");

        builder.Property(v => v.ChangedByUserId)
            .HasColumnName("changed_by_user_id")
            .IsRequired();

        builder.Property(v => v.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        // Valor vigente de um negócio num instante passado (resumo e evolução do pipeline).
        builder.HasIndex(v => new { v.OrganizationId, v.DealId, v.ChangedAt });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(v => v.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Deal>()
            .WithMany()
            .HasForeignKey(v => v.DealId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(v => v.ChangedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
