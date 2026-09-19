using Metup.Application.Activities.Common;
using Metup.Application.Common.Interfaces;
using Metup.Application.Dashboard.Queries.GetDashboardOverview;
using Metup.Application.Deals.Analytics;
using Metup.Application.Deals.Common;
using Metup.Application.Deals.Queries.GetDealBoard;
using Metup.Application.Deals.Queries.GetDealBoardColumn;
using Metup.Application.Deals.Queries.GetPipelineEvolution;
using Metup.Application.Deals.Queries.GetPipelineSummary;
using Metup.Application.Deals.Queries.ListDeals;
using Metup.Application.Tests.Dashboard;
using Metup.Application.Tests.Search;
using Metup.Domain.Activities;
using Metup.Domain.Companies;
using Metup.Domain.Contacts;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using Metup.Domain.Users;

namespace Metup.Application.Tests.Deals;

/// <summary>
/// Cenário do pipeline sobre o contexto do dashboard (organização, "Empresa Alfa", Admin e SDR), mais
/// um Closer, uma segunda empresa com segmento e um contato. Os negócios passam pelo próprio domínio
/// (<c>Deal.Create</c>, <c>ChangeStage</c>, <c>Close</c>, <c>ChangeValue</c>) com os instantes que o teste escolhe.
/// </summary>
public sealed class PipelineTestContext : IDisposable
{
    public static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    public DashboardOverviewTestContext Base { get; } = new();

    public Guid CloserUserId { get; } = Guid.NewGuid();

    /// <summary>"Padaria São João", segmento Varejo, com o contato "João Ávila".</summary>
    public Guid RetailCompanyId { get; } = Guid.NewGuid();

    public Guid RetailContactId { get; } = Guid.NewGuid();

    public FakeOrganizationClock Clock { get; } = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    public PipelineTestContext()
    {
        Db.Users.Add(new User
        {
            Id = CloserUserId,
            OrganizationId = OrganizationId,
            Name = "Carla Closer",
            Email = "carla@acme.com",
            PasswordHash = "x",
            Role = UserRole.Closer,
        });
        Db.Companies.Add(new Company { Id = RetailCompanyId, OrganizationId = OrganizationId, Name = "Padaria São João", Segment = "Varejo" });
        Db.Contacts.Add(new Contact { Id = RetailContactId, OrganizationId = OrganizationId, CompanyId = RetailCompanyId, Name = "João Ávila" });
        Db.SaveChanges();
    }

    public Infrastructure.Persistence.MetupDbContext Db => Base.Db;

    public Guid OrganizationId => Base.OrganizationId;

    public Guid AdminUserId => Base.AdminUserId;

    public Guid SdrUserId => Base.SdrUserId;

    /// <summary>
    /// Negócio aberto, criado em <paramref name="createdAtUtc"/>. As etapas de <paramref name="path"/>
    /// são percorridas em ordem, um dia depois da criação e um dia entre cada.
    /// </summary>
    public Deal AddDeal(
        Guid ownerUserId,
        DateTime createdAtUtc,
        decimal? amount = null,
        decimal? ticket = null,
        DealSource source = DealSource.Sdr,
        bool retail = false,
        DateOnly? expectedCloseDate = null,
        params DealStage[] path)
    {
        var deal = Deal.Create(
            OrganizationId,
            retail ? RetailCompanyId : Base.CompanyId,
            retail ? RetailContactId : null,
            DealStage.Prospect,
            source,
            ownerUserId,
            ticket,
            amount,
            ownerUserId,
            createdAtUtc);

        if (expectedCloseDate is { } date)
        {
            deal.SetExpectedCloseDate(date, DateOnly.MinValue);
        }

        Db.Deals.Add(deal);
        Db.SaveChanges();

        var at = createdAtUtc;
        foreach (var stage in path)
        {
            at = at.AddDays(1);
            Db.StageChanges.Add(deal.ChangeStage(stage, ownerUserId, at));
        }

        Db.SaveChanges();
        return deal;
    }

    public void Close(Deal deal, bool won, DateTime closedAtUtc, decimal? closedAmount = null, LostReason? reason = null)
    {
        var closure = deal.Close(won, closedAmount, won ? null : reason ?? LostReason.Outro, null, deal.OwnerUserId, closedAtUtc);
        Db.StageChanges.Add(closure.StageChange);
        if (closure.ValueChange is { } valueChange)
        {
            Db.DealValueChanges.Add(valueChange);
        }

        Db.SaveChanges();
    }

    public void ChangeValue(Deal deal, decimal? amount, decimal? ticket, DateTime atUtc)
    {
        if (deal.ChangeValue(amount, ticket, deal.OwnerUserId, atUtc) is { } change)
        {
            Db.DealValueChanges.Add(change);
        }

        Db.SaveChanges();
    }

    public void AddActivity(Deal deal, DateTime atUtc) =>
        Save(Activity.Log(OrganizationId, deal.Id, null, ActivityType.Call, ActivityOutcome.Atendeu, "ok", deal.OwnerUserId, atUtc));

    public TaskItem AddTask(Deal deal, DateTime dueUtc, bool completed = false)
    {
        var task = TaskItem.Create(OrganizationId, deal.Id, ActivityType.Call, dueUtc, deal.OwnerUserId, null);
        if (completed)
        {
            task.Complete(dueUtc);
        }

        Save(task);
        return task;
    }

    public ICurrentUserService As(Guid userId, UserRole role) => Base.As(userId, role);

    public DealBoardReader Reader() => new(Db, new InMemoryTextSearch());

    public GetDealBoardQueryHandler Board(Guid userId, UserRole role) => new(As(userId, role), Clock, Reader());

    public GetDealBoardColumnQueryHandler Column(Guid userId, UserRole role) => new(As(userId, role), Clock, Reader());

    public GetPipelineSummaryQueryHandler Summary(Guid userId, UserRole role) =>
        new(Db, As(userId, role), Clock, Reader(), new StageAnalyticsProvider(Db));

    public GetPipelineEvolutionQueryHandler Evolution(Guid userId, UserRole role) =>
        new(Db, As(userId, role), Clock, Reader(), new StageAnalyticsProvider(Db));

    public GetDashboardOverviewQueryHandler Dashboard(Guid userId, UserRole role) =>
        new(Db, As(userId, role), Clock, new ActivityFeedReader(Db, Clock), new StageAnalyticsProvider(Db));

    public ListDealsQueryHandler List(Guid userId, UserRole role) => new(Db, As(userId, role));

    public void Dispose() => Base.Dispose();

    private void Save(object entity)
    {
        Db.Add(entity);
        Db.SaveChanges();
    }
}
