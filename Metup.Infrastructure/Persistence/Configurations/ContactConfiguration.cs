using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("contacts");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");

        builder.Property(c => c.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(c => c.CompanyId)
            .HasColumnName("company_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(c => c.Role)
            .HasColumnName("role")
            .HasMaxLength(120);

        builder.Property(c => c.Phone)
            .HasColumnName("phone")
            .HasMaxLength(40);

        builder.Property(c => c.WhatsApp)
            .HasColumnName("whatsapp")
            .HasMaxLength(40);

        builder.Property(c => c.Email)
            .HasColumnName("email")
            .HasMaxLength(320);

        builder.HasIndex(c => c.OrganizationId);
        builder.HasIndex(c => c.CompanyId);

        builder.HasOne<Company>()
            .WithMany(company => company.Contacts)
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(c => c.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
