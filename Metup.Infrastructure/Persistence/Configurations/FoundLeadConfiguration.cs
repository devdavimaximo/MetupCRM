using Metup.Domain.Companies;
using Metup.Domain.Deals;
using Metup.Domain.LeadFinder;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class FoundLeadConfiguration : IEntityTypeConfiguration<FoundLead>
{
    public void Configure(EntityTypeBuilder<FoundLead> builder)
    {
        builder.ToTable("found_leads");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasColumnName("id");

        builder.Property(l => l.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(l => l.LeadSearchId)
            .HasColumnName("lead_search_id")
            .IsRequired();

        builder.Property(l => l.DedupeKey)
            .HasColumnName("dedupe_key")
            .HasMaxLength(FoundLead.DedupeKeyMaxLength)
            .IsRequired();

        builder.Property(l => l.ExternalId).HasColumnName("external_id").HasMaxLength(FoundLead.ExternalIdMaxLength);
        builder.Property(l => l.Name).HasColumnName("name").HasMaxLength(FoundLead.NameMaxLength).IsRequired();
        builder.Property(l => l.Category).HasColumnName("category").HasMaxLength(FoundLead.CategoryMaxLength);
        builder.Property(l => l.Phone).HasColumnName("phone").HasMaxLength(FoundLead.PhoneMaxLength);
        builder.Property(l => l.PhoneDigits).HasColumnName("phone_digits").HasMaxLength(FoundLead.PhoneDigitsMaxLength);
        builder.Property(l => l.Website).HasColumnName("website").HasMaxLength(FoundLead.WebsiteMaxLength);
        builder.Property(l => l.Email).HasColumnName("email").HasMaxLength(FoundLead.EmailMaxLength);
        builder.Property(l => l.Instagram).HasColumnName("instagram").HasMaxLength(FoundLead.InstagramMaxLength);
        builder.Property(l => l.Address).HasColumnName("address").HasMaxLength(FoundLead.AddressMaxLength);
        builder.Property(l => l.City).HasColumnName("city").HasMaxLength(FoundLead.CityMaxLength);
        builder.Property(l => l.State).HasColumnName("state").HasMaxLength(FoundLead.StateMaxLength);
        builder.Property(l => l.Rating).HasColumnName("rating").HasPrecision(2, 1);
        builder.Property(l => l.ReviewCount).HasColumnName("review_count");
        builder.Property(l => l.MapsUrl).HasColumnName("maps_url").HasMaxLength(FoundLead.MapsUrlMaxLength);

        builder.Property(l => l.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(l => l.ExistingCompanyId).HasColumnName("existing_company_id");
        builder.Property(l => l.CompanyId).HasColumnName("company_id");
        builder.Property(l => l.DealId).HasColumnName("deal_id");
        builder.Property(l => l.FoundAt).HasColumnName("found_at").IsRequired();
        builder.Property(l => l.StatusChangedAt).HasColumnName("status_changed_at");
        builder.Property(l => l.StatusChangedByUserId).HasColumnName("status_changed_by_user_id");

        // Dedupe: um lugar por organização, não importa quantas buscas o encontrem.
        builder.HasIndex(l => new { l.OrganizationId, l.DedupeKey }).IsUnique();

        // A tabela de triagem: abas por situação dentro de uma busca, ou de todas as buscas.
        builder.HasIndex(l => new { l.OrganizationId, l.LeadSearchId, l.Status });
        builder.HasIndex(l => new { l.OrganizationId, l.Status, l.FoundAt });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(l => l.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        // Histórico comercial não se perde: nenhuma exclusão em cascata.
        builder.HasOne<LeadSearch>()
            .WithMany()
            .HasForeignKey(l => l.LeadSearchId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Company>()
            .WithMany()
            .HasForeignKey(l => l.ExistingCompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Company>()
            .WithMany()
            .HasForeignKey(l => l.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Deal>()
            .WithMany()
            .HasForeignKey(l => l.DealId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
