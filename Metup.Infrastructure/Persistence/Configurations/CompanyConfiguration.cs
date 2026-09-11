using Metup.Domain.Companies;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.ToTable("companies");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");

        builder.Property(c => c.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(c => c.Segment)
            .HasColumnName("segment")
            .HasMaxLength(120);

        builder.Property(c => c.City)
            .HasColumnName("city")
            .HasMaxLength(120);

        builder.Property(c => c.Instagram)
            .HasColumnName("instagram")
            .HasMaxLength(120);

        builder.Property(c => c.Phone)
            .HasColumnName("phone")
            .HasMaxLength(40);

        // Listagem e busca sempre partem do escopo da organização.
        builder.HasIndex(c => c.OrganizationId);
        builder.HasIndex(c => new { c.OrganizationId, c.Name });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(c => c.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
