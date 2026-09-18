using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Metup.Infrastructure.Persistence.Configurations;

public class TaskRescheduleConfiguration : IEntityTypeConfiguration<TaskReschedule>
{
    public void Configure(EntityTypeBuilder<TaskReschedule> builder)
    {
        builder.ToTable("task_reschedules");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");

        builder.Property(r => r.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(r => r.TaskId)
            .HasColumnName("task_id")
            .IsRequired();

        builder.Property(r => r.FromDueDate)
            .HasColumnName("from_due_date")
            .IsRequired();

        builder.Property(r => r.ToDueDate)
            .HasColumnName("to_due_date")
            .IsRequired();

        builder.Property(r => r.RescheduledByUserId)
            .HasColumnName("rescheduled_by_user_id")
            .IsRequired();

        builder.Property(r => r.RescheduledAt)
            .HasColumnName("rescheduled_at")
            .IsRequired();

        // Prazo vigente de uma tarefa num instante passado (comparação "vs. semana anterior" do resumo).
        builder.HasIndex(r => new { r.OrganizationId, r.TaskId, r.RescheduledAt });

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(r => r.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(r => r.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.RescheduledByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
