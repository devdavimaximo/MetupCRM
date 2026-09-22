using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> builder)
    {
        builder.ToTable("conversations");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id");

        builder.Property(c => c.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(c => c.ContactId)
            .HasColumnName("contact_id")
            .IsRequired();

        // Todo o histórico de hoje é WhatsApp — o default preenche as linhas existentes na
        // migration que introduziu esta coluna (item 1 do plano C1 de Conversas).
        builder.Property(c => c.Channel)
            .HasColumnName("channel")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ConversationChannel.WhatsApp)
            .IsRequired();

        builder.Property(c => c.ExternalId)
            .HasColumnName("external_id")
            .HasMaxLength(200);

        builder.Property(c => c.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ConversationStatus.Aberta)
            .IsRequired();

        builder.Property(c => c.AutomationEnabled)
            .HasColumnName("automation_enabled")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(c => c.LastMessageAt)
            .HasColumnName("last_message_at");

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Uma conversa ativa por contato+canal — reflete a granularidade do Chatwoot: cada canal
        // (WhatsApp, e-mail...) vira sua própria thread (decisão alinhada com o Davi).
        builder.HasIndex(c => new { c.OrganizationId, c.ContactId, c.Channel }).IsUnique();

        // Idempotência da ingestão pelo id do Chatwoot — a conversa é resolvida por ele antes do
        // telefone quando o payload trouxer (item 2 do plano C1).
        builder.HasIndex(c => new { c.OrganizationId, c.ExternalId })
            .IsUnique()
            .HasFilter("external_id IS NOT NULL");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(c => c.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Contact>()
            .WithMany()
            .HasForeignKey(c => c.ContactId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
