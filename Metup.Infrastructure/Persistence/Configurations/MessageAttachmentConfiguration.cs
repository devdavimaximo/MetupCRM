using Metup.Domain.Conversations;
using Metup.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class MessageAttachmentConfiguration : IEntityTypeConfiguration<MessageAttachment>
{
    public void Configure(EntityTypeBuilder<MessageAttachment> builder)
    {
        builder.ToTable("message_attachments");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");

        builder.Property(a => a.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(a => a.MessageId)
            .HasColumnName("message_id")
            .IsRequired();

        builder.Property(a => a.Kind)
            .HasColumnName("kind")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // O CRM nunca hospeda o arquivo — só a URL que o provedor (via n8n) já entrega.
        builder.Property(a => a.Url)
            .HasColumnName("url")
            .HasMaxLength(2048)
            .IsRequired();

        builder.Property(a => a.FileName)
            .HasColumnName("file_name")
            .HasMaxLength(255);

        builder.Property(a => a.MimeType)
            .HasColumnName("mime_type")
            .HasMaxLength(127);

        builder.Property(a => a.SizeBytes)
            .HasColumnName("size_bytes");

        builder.HasIndex(a => a.MessageId);

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(a => a.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
