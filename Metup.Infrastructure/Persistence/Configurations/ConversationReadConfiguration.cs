using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ConversationReadConfiguration : IEntityTypeConfiguration<ConversationRead>
{
    public void Configure(EntityTypeBuilder<ConversationRead> builder)
    {
        builder.ToTable("conversation_reads");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(r => r.ConversationId)
            .HasColumnName("conversation_id")
            .IsRequired();

        builder.Property(r => r.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(r => r.LastReadAt)
            .HasColumnName("last_read_at")
            .IsRequired();

        // Um cursor de leitura por par conversa×usuário — upsert ao marcar como lida.
        builder.HasIndex(r => new { r.ConversationId, r.UserId }).IsUnique();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(r => r.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Conversation>()
            .WithMany()
            .HasForeignKey(r => r.ConversationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
