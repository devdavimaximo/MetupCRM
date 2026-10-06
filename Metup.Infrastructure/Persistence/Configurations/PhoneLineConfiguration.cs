using Metup.Domain.Organizations;
using Metup.Domain.Telephony;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class PhoneLineConfiguration : IEntityTypeConfiguration<PhoneLine>
{
    public void Configure(EntityTypeBuilder<PhoneLine> builder)
    {
        builder.ToTable("phone_lines");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).HasColumnName("id");

        builder.Property(l => l.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(l => l.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(l => l.Kind)
            .HasColumnName("kind")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(l => l.Label).HasColumnName("label").HasMaxLength(PhoneLine.LabelMaxLength).IsRequired();
        builder.Property(l => l.Number).HasColumnName("number").HasMaxLength(PhoneLine.NumberMaxLength).IsRequired();
        builder.Property(l => l.NumberE164).HasColumnName("number_e164").HasMaxLength(PhoneLine.NumberE164MaxLength).IsRequired();
        builder.Property(l => l.IsDefault).HasColumnName("is_default").IsRequired();
        builder.Property(l => l.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(l => l.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        builder.Property(l => l.CreatedAt).HasColumnName("created_at").IsRequired();

        // Um número ativo é de uma pessoa só na organização — a garantia sob concorrência do que o
        // caso de uso já checa (PhoneLineRules).
        builder.HasIndex(l => new { l.OrganizationId, l.NumberE164 })
            .IsUnique()
            .HasFilter("is_active");

        // As linhas do usuário no discador. "Uma principal por usuário" fica só no caso de uso: trocar a
        // principal mexe em duas linhas no mesmo SaveChanges, e um índice único parcial poderia
        // recusar a ordem em que o EF grava as duas.
        builder.HasIndex(l => new { l.OrganizationId, l.UserId, l.IsActive });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(l => l.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(l => l.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
