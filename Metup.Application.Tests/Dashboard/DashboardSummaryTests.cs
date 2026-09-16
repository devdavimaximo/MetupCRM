using Metup.Application.Dashboard.Common;
using Metup.Application.Dashboard.Queries.GetDashboardSummary;
using Metup.Domain.Activities;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Dashboard;

/// <summary>
/// A fotografia de hoje (<c>/api/dashboard</c>): a fila curta de próximas tarefas e os contadores de
/// prazo. Sempre do usuário logado — esta resposta não tem escopo de organização.
/// </summary>
public class DashboardSummaryTests
{
    /// <summary>15/09/2026, 14h em São Paulo.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 15, 17, 0, 0, DateTimeKind.Utc);

    private static Task<DashboardSummaryDto> RunAsync(DashboardOverviewTestContext context, Guid userId, UserRole role, DateTime? nowUtc = null) =>
        new GetDashboardSummaryQueryHandler(
                context.Db,
                context.As(userId, role),
                new FakeOrganizationClock(DashboardOverviewTestContext.SaoPaulo, nowUtc ?? NowUtc))
            .Handle(new GetDashboardSummaryQuery(), TestContext.Current.CancellationToken);

    private static TaskItem AddTask(
        DashboardOverviewTestContext context,
        Guid dealId,
        Guid ownerUserId,
        DateTime dueDate,
        ActivityType type = ActivityType.Call)
    {
        var task = TaskItem.Create(context.OrganizationId, dealId, type, dueDate, ownerUserId, null);
        context.Db.Tasks.Add(task);
        context.Db.SaveChanges();
        return task;
    }

    [Fact]
    public async Task Fila_traz_no_maximo_cinco_tarefas_em_ordem_de_prazo()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, NowUtc.AddDays(-10));

        // Fora de ordem de propósito: quem ordena é o handler, não a inserção.
        foreach (var hours in new[] { 72, -5, 30, 2, 200, 9, -1 })
        {
            AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(hours));
        }

        var summary = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(5, summary.NextTasks.Count);
        Assert.Equal(summary.NextTasks.OrderBy(t => t.DueDate).Select(t => t.Id), summary.NextTasks.Select(t => t.Id));
        // A mais atrasada encabeça a fila; a de daqui a 200h ficou de fora.
        Assert.Equal(NowUtc.AddHours(-5), summary.NextTasks[0].DueDate);
        Assert.DoesNotContain(summary.NextTasks, t => t.DueDate == NowUtc.AddHours(200));
    }

    [Fact]
    public async Task Fila_e_contadores_ignoram_tarefa_de_outra_pessoa_e_tarefa_ja_concluida()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, NowUtc.AddDays(-10));

        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(1));
        AddTask(context, deal.Id, context.SdrUserId, NowUtc.AddHours(2));

        var done = AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(3));
        done.Complete(NowUtc);
        context.Db.SaveChanges();

        var summary = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        var only = Assert.Single(summary.NextTasks);
        Assert.Equal(NowUtc.AddHours(1), only.DueDate);
        Assert.Equal(new TaskCountsDto(0, 1, 0), summary.TaskCounts);
    }

    [Fact]
    public async Task Contadores_separam_atrasada_de_hoje_e_do_que_vem_depois()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, NowUtc.AddDays(-10));

        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(-2));   // atrasada
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddMinutes(-1)); // atrasada por um minuto
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddHours(3));    // hoje, mais tarde
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddDays(2));     // depois

        var summary = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(new TaskCountsDto(Overdue: 2, Today: 1, Upcoming: 1), summary.TaskCounts);
    }

    [Fact]
    public async Task Tarefa_das_22h_de_Brasilia_ainda_e_de_hoje_mesmo_com_o_UTC_no_dia_seguinte()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.AdminUserId, amount: null, ticket: null, NowUtc.AddDays(-10));

        // 15/09 às 22h em São Paulo = 16/09 às 01h UTC. Pelo relógio UTC seria "amanhã"; não é.
        AddTask(context, deal.Id, context.AdminUserId, new DateTime(2026, 9, 16, 1, 0, 0, DateTimeKind.Utc));
        // 16/09 às 00h30 em São Paulo (= 03h30 UTC) já é o dia seguinte.
        AddTask(context, deal.Id, context.AdminUserId, new DateTime(2026, 9, 16, 3, 30, 0, DateTimeKind.Utc));

        var summary = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Equal(new TaskCountsDto(Overdue: 0, Today: 1, Upcoming: 1), summary.TaskCounts);
    }

    [Fact]
    public async Task Sem_tarefa_pendente_a_resposta_vem_vazia_e_zerada()
    {
        using var context = new DashboardOverviewTestContext();
        context.AddOpenDeal(context.AdminUserId, amount: 5_000m, ticket: null, NowUtc.AddDays(-3));

        var summary = await RunAsync(context, context.AdminUserId, UserRole.Admin);

        Assert.Empty(summary.NextTasks);
        Assert.Equal(new TaskCountsDto(0, 0, 0), summary.TaskCounts);
    }

    [Fact]
    public async Task O_SDR_ve_a_propria_fila_do_mesmo_jeito_que_o_Admin_ve_a_dele()
    {
        using var context = new DashboardOverviewTestContext();
        var deal = context.AddOpenDeal(context.SdrUserId, amount: null, ticket: null, NowUtc.AddDays(-10));

        AddTask(context, deal.Id, context.SdrUserId, NowUtc.AddHours(1), ActivityType.WhatsApp);
        AddTask(context, deal.Id, context.AdminUserId, NowUtc.AddMinutes(10));

        var summary = await RunAsync(context, context.SdrUserId, UserRole.Sdr);

        var only = Assert.Single(summary.NextTasks);
        Assert.Equal(ActivityType.WhatsApp, only.Type);
        Assert.Equal(new TaskCountsDto(0, 1, 0), summary.TaskCounts);
    }
}
