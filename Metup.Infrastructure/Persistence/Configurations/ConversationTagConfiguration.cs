using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ConversationTagConfiguration : IEntityTypeConfiguration<ConversationTag>
{
    public void Configure(EntityTypeBuilder<ConversationTag> builder)
    {
        builder.ToTable("conversation_tags");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id");

        builder.Property(t => t.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(t => t.ConversationId)
            .HasColumnName("conversation_id")
            .IsRequired();

        builder.Property(t => t.TagOptionId)
            .HasColumnName("tag_option_id")
            .IsRequired();

        // Aplicar a mesma tag duas vezes na mesma conversa não duplica.
        builder.HasIndex(t => new { t.ConversationId, t.TagOptionId }).IsUnique();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(t => t.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Conversation>()
            .WithMany()
            .HasForeignKey(t => t.ConversationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<ConversationTagOption>()
            .WithMany()
            .HasForeignKey(t => t.TagOptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
