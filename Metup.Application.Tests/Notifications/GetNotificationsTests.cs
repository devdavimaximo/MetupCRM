using Metup.Application.Notifications.Common;
using Metup.Application.Notifications.Queries.GetNotifications;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Contacts;
using Metup.Domain.Conversations;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Notifications;

public class GetNotificationsTests
{
    /// <summary>15/09/2026, 14h em São Paulo.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static Task<IReadOnlyList<NotificationDto>> RunAsync(DashboardOverviewTestContext context, Guid userId, DefaultRole role, DateTime? nowUtc = null) =>
        new GetNotificationsQueryHandler(context.Db, context.As(userId, role), new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, nowUtc ?? NowUtc))
            .Handle(new GetNotificationsQuery(), TestContext.Current.CancellationToken);

    private static void AddTask(DashboardOverviewTestContext context, Guid dealId, Guid ownerUserId, DateTime dueDate)
    {
        context.Db.Tasks.Add(TaskItem.Create(context.OrganizationId, dealId, ActivityType.Call, dueDate, ownerUserId, null));
        context.Db.SaveChanges();
    }

    [Fact]
    public async Task Tarefas_vencendo_em_60_min_e_atrasadas_so_do_proprio_usuario()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, NowUtc.AddDays(-2));
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddMinutes(45));  // vence em 45 min
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddMinutes(90));  // fora da janela
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(-3));    // atrasada
        AddTask(context, deal.Id, context.SdrUserId, NowUtc.AddMinutes(10));    // de outra pessoa
        var done = TaskItem.Create(context.OrganizationId, deal.Id, ActivityType.Call, NowUtc.AddHours(-1), context.AdminUserId, null);
        done.Complete(NowUtc);
        context.Db.Tasks.Add(done);
        context.Db.SaveChanges();

        var notifications = await RunAsync(context, context.AdminUserId, DefaultRole.Admin);

        var dueSoon = Assert.Single(notifications, n => n.Kind == NotificationKind.TaskDueSoon);
        Assert.Equal(NowUtc.AddMinutes(45), dueSoon.DueAt);
        Assert.Equal(NowUtc.AddMinutes(-15), dueSoon.OccurredAt); // entrou na janela de 60 min
        Assert.Equal("Empresa Alfa", dueSoon.Title);

        var overdue = Assert.Single(notifications, n => n.Kind == NotificationKind.TaskOverdue);
        Assert.Equal(NotificationSeverity.Critical, overdue.Severity);
        Assert.Equal(deal.Id, overdue.DealId);
    }

    [Fact]
    public async Task Negocio_que_ficou_parado_hoje_no_fuso_da_organizacao()
    {
        using var context = new DashboardOverviewTestContext();
        // Limite 14: vira parado 15 dias depois da última mudança de etapa.
        // Hoje em SP começa 15/09 03:00 UTC; agora é 15/09 17:00 UTC.
        var crossedThisMorning = context.AddOpenDeal(context.AdminUserId, null, null, new DateTime(2026, 8, 31, 10, 0, 0, DateTimeKind.Utc)); // cruza 15/09 10:00 UTC
        context.AddOpenDeal(context.AdminUserId, null, null, new DateTime(2026, 8, 31, 2, 0, 0, DateTimeKind.Utc));  // cruza 15/09 02:00 UTC = 14/09 23h em SP (ontem)
        context.AddOpenDeal(context.AdminUserId, null, null, new DateTime(2026, 8, 31, 20, 0, 0, DateTimeKind.Utc)); // cruza 15/09 20:00 UTC (ainda não)
        context.AddClosedDeal(context.AdminUserId, won: false, amount: null, new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc), new DateTime(2026, 8, 31, 10, 0, 0, DateTimeKind.Utc)); // fechado

        var notifications = await RunAsync(context, context.AdminUserId, DefaultRole.Admin);

        var stalled = Assert.Single(notifications, n => n.Kind == NotificationKind.DealStalledToday);
        Assert.Equal(crossedThisMorning.Id, stalled.DealId);
        Assert.Equal(new DateTime(2026, 9, 15, 10, 0, 0, DateTimeKind.Utc), stalled.OccurredAt);
        Assert.Equal(14, stalled.StalledDealDays);
    }

    [Fact]
    public async Task Negocio_parado_hoje_respeita_o_escopo_do_SDR()
    {
        using var context = new DashboardOverviewTestContext();
        var lastChange = new DateTime(2026, 8, 31, 10, 0, 0, DateTimeKind.Utc);
        var mine = context.AddOpenDeal(context.SdrUserId, null, null, lastChange);
        context.AddOpenDeal(context.AdminUserId, null, null, lastChange);

        var notifications = await RunAsync(context, context.SdrUserId, DefaultRole.Sdr);

        Assert.Equal(mine.Id, Assert.Single(notifications, n => n.Kind == NotificationKind.DealStalledToday).DealId);
    }

    [Fact]
    public async Task Conversa_com_ultima_mensagem_do_cliente_ha_mais_de_30_minutos()
    {
        using var context = new DashboardOverviewTestContext();
        var contact = new Contact { OrganizationId = context.OrganizationId, CompanyId = context.CompanyId, Name = "Bia" };
        context.Db.Contacts.Add(contact);

        Conversation AddConversation(params (MessageDirection Direction, DateTime At)[] messages)
        {
            var conversation = Conversation.Create(context.OrganizationId, contact.Id, ConversationChannel.WhatsApp);
            context.Db.Conversations.Add(conversation);
            foreach (var (direction, at) in messages)
            {
                context.Db.Messages.Add(direction == MessageDirection.Inbound
                    ? Message.ReceiveInbound(context.OrganizationId, conversation.Id, "oi", null, null, null, at)
                    : Message.SendOutbound(context.OrganizationId, conversation.Id, "olá", context.AdminUserId, null, null, at));
            }

            return conversation;
        }

        var waiting = AddConversation((MessageDirection.Outbound, NowUtc.AddHours(-2)), (MessageDirection.Inbound, NowUtc.AddMinutes(-40)));
        AddConversation((MessageDirection.Inbound, NowUtc.AddMinutes(-10)));                                              // ainda dentro dos 30 min
        AddConversation((MessageDirection.Inbound, NowUtc.AddHours(-2)), (MessageDirection.Outbound, NowUtc.AddHours(-1))); // já respondida
        context.Db.SaveChanges();

        var notifications = await RunAsync(context, context.SdrUserId, DefaultRole.Sdr);

        var awaiting = Assert.Single(notifications, n => n.Kind == NotificationKind.ConversationAwaitingReply);
        Assert.Equal(waiting.Id, awaiting.ConversationId);
        Assert.Equal("Bia", awaiting.Title);
        Assert.Equal(NowUtc.AddMinutes(-10), awaiting.OccurredAt); // completou 30 min sem resposta
    }

    [Fact]
    public async Task Lista_vem_da_mais_recente_para_a_mais_antiga()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, null, null, NowUtc.AddDays(-1));
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddDays(-2));
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(-1));
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddMinutes(30));

        var notifications = await RunAsync(context, context.AdminUserId, DefaultRole.Admin);

        Assert.Equal(notifications.OrderByDescending(n => n.OccurredAt).Select(n => n.Id), notifications.Select(n => n.Id));
    }
}
