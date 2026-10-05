using Metup.Domain.LeadFinder;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class LeadSearchConfiguration : IEntityTypeConfiguration<LeadSearch>
{
    public void Configure(EntityTypeBuilder<LeadSearch> builder)
    {
        builder.ToTable("lead_searches");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");

        builder.Property(s => s.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(s => s.Query)
            .HasColumnName("query")
            .HasMaxLength(LeadSearch.QueryMaxLength)
            .IsRequired();

        builder.Property(s => s.Location)
            .HasColumnName("location")
            .HasMaxLength(LeadSearch.LocationMaxLength);

        builder.Property(s => s.MaxResults).HasColumnName("max_results");

        builder.Property(s => s.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.Origin)
            .HasColumnName("origin")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.ExternalId)
            .HasColumnName("external_id")
            .HasMaxLength(LeadSearch.ExternalIdMaxLength);

        builder.Property(s => s.RequestedByUserId).HasColumnName("requested_by_user_id");
        builder.Property(s => s.RequestedAt).HasColumnName("requested_at").IsRequired();
        builder.Property(s => s.StartedAt).HasColumnName("started_at");
        builder.Property(s => s.FinishedAt).HasColumnName("finished_at");
        builder.Property(s => s.LastActivityAt).HasColumnName("last_activity_at").IsRequired();
        builder.Property(s => s.ReceivedCount).HasColumnName("received_count").IsRequired();
        builder.Property(s => s.NewCount).HasColumnName("new_count").IsRequired();

        builder.Property(s => s.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(LeadSearch.ErrorMessageMaxLength);

        builder.Ignore(s => s.IsFinished);

        // Histórico da tela: as buscas de uma organização, mais recentes primeiro.
        builder.HasIndex(s => new { s.OrganizationId, s.RequestedAt });

        // Idempotência das buscas que nascem no n8n.
        builder.HasIndex(s => new { s.OrganizationId, s.ExternalId })
            .IsUnique()
            .HasFilter("external_id IS NOT NULL");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(s => s.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(s => s.RequestedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
