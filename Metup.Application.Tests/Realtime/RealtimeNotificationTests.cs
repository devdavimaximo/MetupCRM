using Metup.Application.Activities.Commands.LogActivity;
using Metup.Application.Common.Realtime;
using Metup.Application.Deals.Commands.ChangeDealStage;
using Metup.Application.Deals.Commands.CloseDeal;
using Metup.Application.Tasks.Commands.CompleteTask;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Metup.Infrastructure.Persistence;
using Metup.Infrastructure.Realtime;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Metup.Application.Tests.Realtime;

/// <summary>Banco que falha no SaveChanges: o aviso de tempo real não pode sair de um comando que não gravou.</summary>
public sealed class FailingSaveDbContext(DbContextOptions<MetupDbContext> options) : MetupDbContext(options)
{
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        throw new DbUpdateException("falha simulada");
}

public class RealtimeNotificationTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Mudar_etapa_publica_depois_de_gravar_com_o_responsavel_do_negocio()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.SdrUserId, null, null, NowUtc.AddDays(-1));
        var publisher = new RecordingPublisher();

        await new ChangeDealStageCommandHandler(context.Db, context.As(context.AdminUserId, DefaultRole.Admin), new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc), publisher)
            .Handle(new ChangeDealStageCommand(deal.Id, DealStage.Reuniao), TestContext.Current.CancellationToken);

        var notification = Assert.IsType<DealStageChangedNotification>(Assert.Single(publisher.Published));
        Assert.Equal(new DealStageChangedNotification(context.OrganizationId, deal.Id, context.SdrUserId), notification);
        Assert.Equal(DealStage.Reuniao, (await context.Db.Deals.AsNoTracking().SingleAsync(d => d.Id == deal.Id, TestContext.Current.CancellationToken)).Stage);
    }

    [Fact]
    public async Task Fechar_registrar_atividade_e_concluir_tarefa_publicam_o_aviso_certo()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.SdrUserId, null, null, NowUtc.AddDays(-1));
        var task = TaskItem.Create(context.OrganizationId, deal.Id, ActivityType.Call, NowUtc.AddDays(1), context.SdrUserId, null);
        context.Db.Tasks.Add(task);
        context.Db.SaveChanges();
        var publisher = new RecordingPublisher();
        var admin = context.As(context.AdminUserId, DefaultRole.Admin);

        await new LogActivityCommandHandler(context.Db, admin, new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc), publisher).Handle(
            new LogActivityCommand(deal.Id, null, ActivityType.Note, null, "nota", null, null, null, null), TestContext.Current.CancellationToken);
        await new CompleteTaskCommandHandler(context.Db, admin, new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc), publisher).Handle(new CompleteTaskCommand(task.Id), TestContext.Current.CancellationToken);
        await new CloseDealCommandHandler(context.Db, admin, new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc), publisher).Handle(new CloseDealCommand(deal.Id, true, 10_000m), TestContext.Current.CancellationToken);

        Assert.Collection(
            publisher.Published,
            n => Assert.Equal(new ActivityLoggedNotification(context.OrganizationId, deal.Id, context.SdrUserId), n),
            n =>
            {
                Assert.Equal(new TaskCompletedNotification(context.OrganizationId, deal.Id, context.SdrUserId), n);
                Assert.True(((IRealtimeNotification)n).UserScoped);
            },
            n => Assert.Equal(new DealClosedNotification(context.OrganizationId, deal.Id, context.SdrUserId), n));
    }

    [Fact]
    public async Task Nada_e_publicado_quando_o_SaveChanges_falha()
    {
        var databaseName = $"realtime-{Guid.NewGuid()}";
        var options = new DbContextOptionsBuilder<MetupDbContext>().UseInMemoryDatabase(databaseName).Options;

        // Semeia com o contexto normal e roda o comando com um que falha ao gravar, no mesmo banco.
        using var seed = new DashboardOverviewTestContext();
        var deal = seed.AddOpenDeal(seed.AdminUserId, null, null, NowUtc.AddDays(-1));
        await using (var copy = new MetupDbContext(options))
        {
            // Sem responsável: o comando falha ao gravar, e o Admin age sem recorte por dono.
            copy.Deals.Add(new Deal { Id = deal.Id, OrganizationId = seed.OrganizationId, CompanyId = seed.CompanyId, CreatedAt = deal.CreatedAt });
            await copy.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var failing = new FailingSaveDbContext(options);
        var publisher = new RecordingPublisher();

        await Assert.ThrowsAsync<DbUpdateException>(() =>
            new ChangeDealStageCommandHandler(failing, seed.As(seed.AdminUserId, DefaultRole.Admin), new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, NowUtc), publisher)
                .Handle(new ChangeDealStageCommand(deal.Id, DealStage.Reuniao), TestContext.Current.CancellationToken));

        Assert.Empty(publisher.Published);
    }

    [Fact]
    public async Task Notifier_manda_evento_de_negocio_para_a_organizacao_e_tarefa_so_para_o_responsavel()
    {
        var hub = new RecordingHubContext();
        var notifier = new DashboardRealtimeNotifier(hub, NullLogger<DashboardRealtimeNotifier>.Instance);
        var organizationId = Guid.NewGuid();
        var dealId = Guid.NewGuid();
        var ownerUserId = Guid.NewGuid();

        await notifier.Handle(new DealStageChangedNotification(organizationId, dealId, ownerUserId), TestContext.Current.CancellationToken);
        await notifier.Handle(new TaskCompletedNotification(organizationId, dealId, ownerUserId), TestContext.Current.CancellationToken);

        Assert.Collection(
            hub.Sent,
            s =>
            {
                Assert.Equal(DashboardHub.OrganizationGroup(organizationId), s.Group);
                Assert.Equal(DashboardHub.EventMethod, s.Method);
                Assert.Equal(new RealtimeEventMessage("deal.stageChanged", dealId, ownerUserId), s.Payload);
            },
            s => Assert.Equal(DashboardHub.UserGroup(ownerUserId), s.Group));
    }

    [Fact]
    public async Task Falha_do_hub_nao_derruba_o_comando()
    {
        var notifier = new DashboardRealtimeNotifier(new RecordingHubContext { Fail = true }, NullLogger<DashboardRealtimeNotifier>.Instance);

        var exception = await Record.ExceptionAsync(() =>
            notifier.Handle(new DealClosedNotification(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()), TestContext.Current.CancellationToken));

        Assert.Null(exception);
    }

    [Fact]
    public async Task Eventos_de_conversa_levam_o_ConversationId_e_favoritar_e_so_do_usuario()
    {
        var hub = new RecordingHubContext();
        var notifier = new DashboardRealtimeNotifier(hub, NullLogger<DashboardRealtimeNotifier>.Instance);
        var organizationId = Guid.NewGuid();
        var conversationId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        await notifier.Handle(new ConversationMessageReceivedNotification(organizationId, conversationId), TestContext.Current.CancellationToken);
        await notifier.Handle(new ConversationMessageSentNotification(organizationId, conversationId), TestContext.Current.CancellationToken);
        await notifier.Handle(new ConversationStatusChangedNotification(organizationId, conversationId), TestContext.Current.CancellationToken);
        await notifier.Handle(new ConversationFavoritedNotification(organizationId, conversationId, userId), TestContext.Current.CancellationToken);

        Assert.Collection(
            hub.Sent,
            s =>
            {
                Assert.Equal(DashboardHub.OrganizationGroup(organizationId), s.Group);
                Assert.Equal(new RealtimeEventMessage("conversation.messageReceived", null, null, conversationId), s.Payload);
            },
            s => Assert.Equal(DashboardHub.OrganizationGroup(organizationId), s.Group),
            s => Assert.Equal(DashboardHub.OrganizationGroup(organizationId), s.Group),
            s =>
            {
                Assert.Equal(DashboardHub.UserGroup(userId), s.Group);
                Assert.Equal(new RealtimeEventMessage("conversation.favorited", null, userId, conversationId), s.Payload);
            });
    }
}

/// <summary>IHubContext mínimo que só registra grupo, método e payload do que seria enviado.</summary>
public sealed class RecordingHubContext : IHubContext<DashboardHub>
{
    public List<(string Group, string Method, object? Payload)> Sent { get; } = [];

    public bool Fail { get; init; }

    public IHubClients Clients => new RecordingClients(this);

    public IGroupManager Groups => throw new NotSupportedException();

    private sealed class RecordingClients(RecordingHubContext owner) : IHubClients
    {
        public IClientProxy Group(string groupName) => new Proxy(owner, groupName);

        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Client(string connectionId) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }

    private sealed class Proxy(RecordingHubContext owner, string group) : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            if (owner.Fail)
            {
                throw new InvalidOperationException("hub fora do ar");
            }

            owner.Sent.Add((group, method, args.FirstOrDefault()));
            return Task.CompletedTask;
        }
    }
}
