using Metup.Application.Common.Interfaces;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Deals;
using Metup.Domain.Integrations;
using Metup.Domain.Organizations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Metup.Infrastructure.Persistence;

public class MetupDbContext(DbContextOptions<MetupDbContext> options) : DbContext(options), IApplicationDbContext
{
    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Company> Companies => Set<Company>();

    public DbSet<Contact> Contacts => Set<Contact>();

    public DbSet<Deal> Deals => Set<Deal>();

    public DbSet<StageChange> StageChanges => Set<StageChange>();

    public DbSet<DealValueChange> DealValueChanges => Set<DealValueChange>();

    public DbSet<Activity> Activities => Set<Activity>();

    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    public DbSet<TaskReschedule> TaskReschedules => Set<TaskReschedule>();

    public DbSet<Conversation> Conversations => Set<Conversation>();

    public DbSet<Message> Messages => Set<Message>();

    public DbSet<IntegrationEvent> IntegrationEvents => Set<IntegrationEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Busca sem acento (ITextSearch → unaccent + ILIKE).
        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MetupDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
