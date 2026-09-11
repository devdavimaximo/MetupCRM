using Metup.Domain.Activities;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.ToTable("activities");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");

        builder.Property(a => a.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(a => a.DealId)
            .HasColumnName("deal_id")
            .IsRequired();

        builder.Property(a => a.ContactId)
            .HasColumnName("contact_id");

        builder.Property(a => a.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(a => a.Outcome)
            .HasColumnName("outcome")
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(a => a.Note)
            .HasColumnName("note")
            .HasMaxLength(500);

        builder.Property(a => a.AuthorUserId)
            .HasColumnName("author_user_id")
            .IsRequired();

        builder.Property(a => a.OccurredAt)
            .HasColumnName("occurred_at")
            .IsRequired();

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Timeline do negócio, na ordem em que aconteceu — a consulta que alimenta a ficha.
        builder.HasIndex(a => new { a.DealId, a.OccurredAt });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(a => a.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Deal>()
            .WithMany()
            .HasForeignKey(a => a.DealId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Contact>()
            .WithMany()
            .HasForeignKey(a => a.ContactId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.AuthorUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
