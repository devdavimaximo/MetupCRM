using System.Reflection;
using Metup.Application.Common.Interfaces;
using Metup.Domain.Activities;
using Metup.Domain.Common;
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

/// <remarks>
/// Toda entidade de negócio (<see cref="BaseEntity"/>) recebe o filtro global
/// <see cref="TenantQueryExtensions.TenantFilterName"/> com a organização de <see cref="ITenantContext"/>:
/// o isolamento entre organizações é do contexto, não da memória de cada handler (regra 4.1). Sem
/// organização resolvida o filtro casa <see cref="Guid.Empty"/> e nada volta — falha fechada. Não há
/// construtor sem tenant: quem abre o contexto escolhe o escopo.
/// </remarks>
public class MetupDbContext(DbContextOptions<MetupDbContext> options, ITenantContext tenantContext)
    : DbContext(options), IApplicationDbContext
{
    private static readonly MethodInfo ApplyTenantFilterMethod =
        typeof(MetupDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.Instance | BindingFlags.NonPublic)!;

    /// <summary>Lida pelo EF a cada consulta (parâmetro do filtro), nunca congelada no modelo.</summary>
    private Guid CurrentOrganizationId => tenantContext.OrganizationId ?? Guid.Empty;

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Role> Roles => Set<Role>();

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

    public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();

    public DbSet<ConversationRead> ConversationReads => Set<ConversationRead>();

    public DbSet<ConversationFavorite> ConversationFavorites => Set<ConversationFavorite>();

    public DbSet<ConversationTagOption> ConversationTagOptions => Set<ConversationTagOption>();

    public DbSet<ConversationTag> ConversationTags => Set<ConversationTag>();

    public DbSet<IntegrationEvent> IntegrationEvents => Set<IntegrationEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Busca sem acento (ITextSearch → unaccent + ILIKE).
        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MetupDbContext).Assembly);

        // Loop sobre o modelo, não lista à mão: entidade nova já nasce isolada. Filtro só pode ficar
        // na raiz de uma hierarquia.
        var tenantScopedTypes = modelBuilder.Model.GetEntityTypes()
            .Where(t => t.BaseType is null && !t.IsOwned() && typeof(BaseEntity).IsAssignableFrom(t.ClrType))
            .Select(t => t.ClrType)
            .ToList();

        foreach (var clrType in tenantScopedTypes)
        {
            ApplyTenantFilterMethod.MakeGenericMethod(clrType).Invoke(this, [modelBuilder]);
        }

        base.OnModelCreating(modelBuilder);
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : BaseEntity =>
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(TenantQueryExtensions.TenantFilterName, e => e.OrganizationId == CurrentOrganizationId);
}
