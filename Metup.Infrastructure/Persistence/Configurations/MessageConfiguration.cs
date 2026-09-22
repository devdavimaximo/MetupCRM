using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("messages");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");

        builder.Property(m => m.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(m => m.ConversationId)
            .HasColumnName("conversation_id")
            .IsRequired();

        builder.Property(m => m.Direction)
            .HasColumnName("direction")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Body)
            .HasColumnName("body")
            .HasMaxLength(4096)
            .IsRequired();

        builder.Property(m => m.ExternalMessageId)
            .HasColumnName("external_message_id")
            .HasMaxLength(200);

        builder.Property(m => m.AuthorUserId)
            .HasColumnName("author_user_id");

        // Só existe para outbound — distingue o SDR humano da automação (Bot); null em inbound.
        builder.Property(m => m.AuthorKind)
            .HasColumnName("author_kind")
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(m => m.DealId)
            .HasColumnName("deal_id");

        builder.Property(m => m.DealStageAtMessage)
            .HasColumnName("deal_stage_at_message")
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(m => m.OccurredAt)
            .HasColumnName("occurred_at")
            .IsRequired();

        builder.Property(m => m.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // A thread, na ordem em que aconteceu.
        builder.HasIndex(m => new { m.ConversationId, m.OccurredAt });

        // Idempotência do inbound a nível de banco: o n8n pode reenviar a mesma mensagem sem
        // duplicar (regra "endpoints de ingestão são idempotentes", seção 5/11 do CLAUDE.md).
        builder.HasIndex(m => new { m.OrganizationId, m.ExternalMessageId })
            .IsUnique()
            .HasFilter("external_message_id IS NOT NULL");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(m => m.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Conversation>()
            .WithMany()
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Deal>()
            .WithMany()
            .HasForeignKey(m => m.DealId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(m => m.AuthorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(m => m.Attachments)
            .WithOne()
            .HasForeignKey(a => a.MessageId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
