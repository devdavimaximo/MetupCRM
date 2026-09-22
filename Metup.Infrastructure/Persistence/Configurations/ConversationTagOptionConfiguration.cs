using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ConversationTagOptionConfiguration : IEntityTypeConfiguration<ConversationTagOption>
{
    public void Configure(EntityTypeBuilder<ConversationTagOption> builder)
    {
        builder.ToTable("conversation_tag_options");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");

        builder.Property(t => t.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(ConversationTagOption.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.NormalizedName)
            .HasColumnName("normalized_name")
            .HasMaxLength(ConversationTagOption.NameMaxLength)
            .IsRequired();

        // Unicidade case-insensitive por organização ("Alta intenção" e "alta intenção" não coexistem).
        builder.HasIndex(t => new { t.OrganizationId, t.NormalizedName }).IsUnique();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(t => t.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
