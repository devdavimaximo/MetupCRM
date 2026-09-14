using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class DealConfiguration : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> builder)
    {
        builder.ToTable("deals");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).HasColumnName("id");

        builder.Property(d => d.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(d => d.CompanyId)
            .HasColumnName("company_id")
            .IsRequired();

        builder.Property(d => d.ContactId)
            .HasColumnName("contact_id");

        builder.Property(d => d.Stage)
            .HasColumnName("stage")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(d => d.Source)
            .HasColumnName("source")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(d => d.OwnerUserId)
            .HasColumnName("owner_user_id")
            .IsRequired();

        builder.Property(d => d.ExternalLeadId)
            .HasColumnName("external_lead_id")
            .HasMaxLength(200);

        // Dinheiro sempre decimal, nunca float (regra 4.7 do CLAUDE.md).
        builder.Property(d => d.Ticket)
            .HasColumnName("ticket")
            .HasColumnType("numeric(18,2)");

        builder.Property(d => d.Amount)
            .HasColumnName("amount")
            .HasColumnType("numeric(18,2)");

        builder.Property(d => d.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(d => d.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(d => d.ClosedAt)
            .HasColumnName("closed_at");

        // Pipeline por estágio e carteira por responsável são as duas consultas mais frequentes.
        builder.HasIndex(d => new { d.OrganizationId, d.Stage });
        builder.HasIndex(d => new { d.OrganizationId, d.OwnerUserId });

        // Idempotência da ingestão de leads externos (ex.: Meta Ads) a nível de banco — mesmo
        // padrão de MessageConfiguration.ExternalMessageId (regra "ingestão idempotente", seção 5).
        builder.HasIndex(d => new { d.OrganizationId, d.ExternalLeadId })
            .IsUnique()
            .HasFilter("external_lead_id IS NOT NULL");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(d => d.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Company>()
            .WithMany()
            .HasForeignKey(d => d.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Contact>()
            .WithMany()
            .HasForeignKey(d => d.ContactId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(d => d.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.StageChanges)
            .WithOne()
            .HasForeignKey(sc => sc.DealId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
