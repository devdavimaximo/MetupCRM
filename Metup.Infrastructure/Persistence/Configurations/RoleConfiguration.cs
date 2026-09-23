using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(r => r.Name)
            .HasColumnName("name")
            .HasMaxLength(Role.NameMaxLength)
            .IsRequired();

        builder.Property(r => r.Description)
            .HasColumnName("description")
            .HasMaxLength(Role.DescriptionMaxLength);

        builder.Property(r => r.IsAdministrator)
            .HasColumnName("is_administrator")
            .IsRequired();

        // text[] com o nome do enum: legível no banco e estável se a ordem do enum mudar.
        builder.PrimitiveCollection(r => r.Permissions)
            .HasColumnName("permissions")
            .IsRequired()
            .ElementType(element => element.HasConversion<string>());

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Ignore(r => r.EffectivePermissions);

        builder.HasIndex(r => new { r.OrganizationId, r.Name }).IsUnique();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(r => r.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
