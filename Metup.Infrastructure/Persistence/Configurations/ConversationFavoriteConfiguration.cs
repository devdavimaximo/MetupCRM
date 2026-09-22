using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class ConversationFavoriteConfiguration : IEntityTypeConfiguration<ConversationFavorite>
{
    public void Configure(EntityTypeBuilder<ConversationFavorite> builder)
    {
        builder.ToTable("conversation_favorites");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id");

        builder.Property(f => f.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(f => f.ConversationId)
            .HasColumnName("conversation_id")
            .IsRequired();

        builder.Property(f => f.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.HasIndex(f => new { f.ConversationId, f.UserId }).IsUnique();

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(f => f.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Conversation>()
            .WithMany()
            .HasForeignKey(f => f.ConversationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(f => f.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
