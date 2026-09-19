using Metup.Application.Common.Interfaces;
using Metup.Application.Common.Models;
using Metup.Domain.Companies;
using Metup.Domain.Deals;
using Metup.Domain.Organizations;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Metup.Application.Tests.Dashboard;

/// <summary>Usuário autenticado de mentira — só as três informações que o escopo consulta.</summary>
public sealed class FakeCurrentUserService(Guid organizationId, Guid userId, UserRole role) : ICurrentUserService
{
    public Guid? UserId => userId;

    public Guid? OrganizationId => organizationId;

    public string? Role => role.ToString();
}

/// <summary>Publisher do MediatR que só guarda o que foi publicado, na ordem.</summary>
public sealed class RecordingPublisher : MediatR.IPublisher
{
    public List<object> Published { get; } = [];

    public Task Publish(object notification, CancellationToken cancellationToken = default)
    {
        Published.Add(notification);
        return Task.CompletedTask;
    }

    public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
        where TNotification : MediatR.INotification
    {
        Published.Add(notification);
        return Task.CompletedTask;
    }
}

/// <summary>Relógio congelado num instante e num fuso conhecidos — o teste escolhe o "agora".</summary>
public sealed class FakeOrganizationClock(TimeZoneInfo timeZone, DateTime utcNow) : IOrganizationClock
{
    public Task<OrganizationClockSnapshot> SnapshotAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new OrganizationClockSnapshot(timeZone, utcNow));
}

/// <summary>
/// Banco em memória com uma organização, uma empresa e os usuários do cenário. Os negócios são
/// montados direto (sem passar por <c>Deal.Create</c>) porque os testes precisam escolher o
/// <c>CreatedAt</c> — é o que define em qual janela o negócio cai.
/// </summary>
public sealed class DashboardOverviewTestContext : IDisposable
{
    public static readonly TimeZoneInfo SaoPaulo = ResolveSaoPaulo();

    public Guid OrganizationId { get; } = Guid.NewGuid();

    public Guid CompanyId { get; } = Guid.NewGuid();

    public Guid AdminUserId { get; } = Guid.NewGuid();

    public Guid SdrUserId { get; } = Guid.NewGuid();

    public MetupDbContext Db { get; }

    public DashboardOverviewTestContext()
    {
        var options = new DbContextOptionsBuilder<MetupDbContext>()
            .UseInMemoryDatabase($"dashboard-{Guid.NewGuid()}")
            .Options;

        Db = new MetupDbContext(options);

        Db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Acme" });
        Db.Companies.Add(new Company { Id = CompanyId, OrganizationId = OrganizationId, Name = "Empresa Alfa" });
        Db.Users.Add(NewUser(AdminUserId, "Ana Admin", "ana@acme.com", UserRole.Admin));
        Db.Users.Add(NewUser(SdrUserId, "Sofia SDR", "sofia@acme.com", UserRole.Sdr));
        Db.SaveChanges();
    }

    public Deal AddOpenDeal(
        Guid ownerUserId,
        decimal? amount,
        decimal? ticket,
        DateTime createdAtUtc,
        DealStage? stage = null,
        DateOnly? expectedCloseDate = null,
        DealSource source = DealSource.Sdr)
    {
        var deal = Build(ownerUserId, amount, ticket, createdAtUtc);
        deal.Source = source;

        if (expectedCloseDate is { } date)
        {
            // A regra "não antes da criação" é coberta nos testes de domínio; aqui o cenário só precisa da data.
            deal.SetExpectedCloseDate(date, DateOnly.MinValue);
        }

        if (stage is { } target && target != DealStage.Prospect)
        {
            deal.ChangeStage(target, ownerUserId, createdAtUtc.AddHours(1));
        }

        return Persist(deal);
    }

    public Deal AddClosedDeal(Guid ownerUserId, bool won, decimal? amount, DateTime createdAtUtc, DateTime closedAtUtc)
    {
        var deal = Build(ownerUserId, amount, null, createdAtUtc);
        // O valor já nasce igual ao fechado: nenhum histórico de valor extra no cenário.
        deal.Close(won, amount, won ? null : LostReason.Outro, null, ownerUserId, closedAtUtc);
        return Persist(deal);
    }

    public Deal AddWonDeal(Guid ownerUserId, decimal amount, DateTime createdAtUtc, DateTime closedAtUtc) =>
        AddClosedDeal(ownerUserId, won: true, amount, createdAtUtc, closedAtUtc);

    /// <summary>
    /// Pelo próprio <c>Deal.Create</c> — inclusive a transição de entrada no funil, sem a qual não
    /// existiria histórico de estágio —, nascido no instante escolhido pelo teste.
    /// </summary>
    private Deal Build(Guid ownerUserId, decimal? amount, decimal? ticket, DateTime createdAtUtc) =>
        Deal.Create(
            OrganizationId,
            CompanyId,
            contactId: null,
            DealStage.Prospect,
            DealSource.Sdr,
            ownerUserId,
            ticket,
            amount,
            ownerUserId,
            createdAtUtc);

    /// <summary>O grafo inteiro é gravado de uma vez: com o negócio novo, o EF insere as transições junto.</summary>
    private Deal Persist(Deal deal)
    {
        Db.Deals.Add(deal);
        Db.SaveChanges();
        return deal;
    }

    public FakeCurrentUserService As(Guid userId, UserRole role) => new(OrganizationId, userId, role);

    public void Dispose() => Db.Dispose();

    private User NewUser(Guid id, string name, string email, UserRole role) => new()
    {
        Id = id,
        OrganizationId = OrganizationId,
        Name = name,
        Email = email,
        PasswordHash = "x",
        Role = role,
    };

    private static TimeZoneInfo ResolveSaoPaulo()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("America/Sao_Paulo", out var timeZone))
        {
            return timeZone;
        }

        return TimeZoneInfo.TryConvertIanaIdToWindowsId("America/Sao_Paulo", out var windowsId)
            ? TimeZoneInfo.FindSystemTimeZoneById(windowsId)
            : throw new InvalidOperationException("Fuso America/Sao_Paulo indisponível nesta máquina.");
    }
}
