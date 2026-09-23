using Metup.Application.Common.Exceptions;
using Metup.Application.Tasks.Common;
using Metup.Application.Tasks.Queries.GetTaskSummary;
using Metup.Application.Tasks.Queries.ListTasks;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Tasks;

public class TaskSummaryTests
{
    /// <summary>Quarta-feira, 16/09/2026, 12:00 em Brasília. D−7 = quarta 09/09.</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateTime Utc(int day, int hour) => new(2026, 9, day, hour, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Contagens_batem_com_o_total_da_listagem_em_cada_recorte()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(16, 14));
        context.AddTask(Utc(10, 12));
        context.AddTask(Utc(17, 2));
        context.AddTask(Utc(18, 15));
        context.AddTask(Utc(19, 15));
        context.AddTask(Utc(25, 15));
        context.AddTask(Utc(10, 12), completedAtUtc: NowUtc.AddDays(-3));
        context.AddTask(Utc(10, 12), completedAtUtc: NowUtc.AddDays(-40));
        context.AddTask(Utc(10, 12), cancelledAtUtc: NowUtc.AddDays(-1));

        var summary = await context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(), Ct);
        var list = context.List(context.SdrUserId, DefaultRole.Sdr, Clock);

        async Task<int> Total(TaskScope scope, params TaskItemStatus[] statuses) =>
            (await list.Handle(new ListTasksQuery(Scope: scope, Statuses: statuses), Ct)).TotalCount;

        Assert.Equal(await Total(TaskScope.All), summary.Counts.All);
        Assert.Equal(await Total(TaskScope.Overdue), summary.Counts.Overdue);
        Assert.Equal(await Total(TaskScope.Today), summary.Counts.Today);
        Assert.Equal(await Total(TaskScope.ThisWeek), summary.Counts.ThisWeek);
        Assert.Equal(await Total(TaskScope.Later), summary.Counts.Later);
        Assert.Equal(await Total(TaskScope.All, TaskItemStatus.Concluida), summary.Counts.Completed30d);
        Assert.Equal(await Total(TaskScope.All, TaskItemStatus.Cancelada), summary.Counts.Cancelled30d);

        Assert.Equal(new TaskScopeCountsDto(7, 2, 1, 2, 1, 1, 1), summary.Counts);
    }

    [Fact]
    public async Task Semana_anterior_usa_o_prazo_vigente_em_D_menos_7()
    {
        using var context = new TasksTestContext(NowUtc);
        var asOf = NowUtc.AddDays(-7);
        var created = Utc(1, 12);

        // Nunca reagendada, vencida em D−7.
        context.AddTask(Utc(5, 12), createdAtUtc: created);

        // Prazo original 08/09 (vencido em D−7); só foi empurrada depois, para 20/09.
        var pushedLater = context.AddTask(Utc(20, 15), createdAtUtc: created);
        context.AddReschedule(pushedLater, Utc(8, 12), Utc(20, 15), Utc(12, 12));

        // Vencia 03/09, mas foi reagendada antes de D−7 para 09/09 17:00 local: era "hoje" em D−7.
        var movedToThatDay = context.AddTask(Utc(9, 20), createdAtUtc: created);
        context.AddReschedule(movedToThatDay, Utc(3, 12), Utc(9, 20), Utc(5, 12));

        // Concluída antes de D−7 e criada depois de D−7: fora.
        context.AddTask(Utc(7, 12), createdAtUtc: created, completedAtUtc: Utc(8, 12));
        context.AddTask(Utc(20, 15), createdAtUtc: asOf.AddHours(1));

        var summary = await context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(), Ct);

        Assert.Equal(new TaskPreviousCountsDto(Overdue: 2, Today: 1, ThisWeek: 0), summary.Previous);
    }

    [Fact]
    public async Task Sem_reagendamento_registrado_vale_o_prazo_atual()
    {
        using var context = new TasksTestContext(NowUtc);
        // Mesma tarefa do teste anterior, mas sem histórico: o prazo 20/09 não conta em D−7.
        context.AddTask(Utc(20, 15), createdAtUtc: Utc(1, 12));

        var summary = await context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(), Ct);

        Assert.Equal(new TaskPreviousCountsDto(0, 0, 0), summary.Previous);
    }

    [Fact]
    public async Task Sem_nenhuma_tarefa_em_D_menos_7_nao_ha_base_anterior()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(20, 15), createdAtUtc: NowUtc.AddDays(-2));

        var summary = await context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(), Ct);

        Assert.Null(summary.Previous);
        Assert.Null(summary.CompletedChangePct);
    }

    [Fact]
    public async Task Conclusoes_por_dia_local_14_pontos_sem_buracos_e_variacao_semanal()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(1, 12), completedAtUtc: Utc(16, 12));
        context.AddTask(Utc(1, 12), completedAtUtc: Utc(16, 13));
        context.AddTask(Utc(1, 12), completedAtUtc: Utc(16, 2));    // 15/09 23:00 local
        context.AddTask(Utc(1, 12), completedAtUtc: Utc(8, 12));    // semana anterior
        context.AddTask(Utc(1, 12), completedAtUtc: Utc(2, 12));    // fora da série
        context.AddTask(Utc(1, 12), cancelledAtUtc: Utc(16, 12));   // cancelada não conta

        var summary = await context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(), Ct);

        Assert.Equal(14, summary.WeeklyCompleted.Count);
        Assert.Equal(new DateOnly(2026, 9, 3), summary.WeeklyCompleted[0].Date);
        Assert.Equal(new DateOnly(2026, 9, 16), summary.WeeklyCompleted[^1].Date);
        Assert.Equal(2, summary.WeeklyCompleted[^1].Count);
        Assert.Equal(1, summary.WeeklyCompleted[^2].Count);
        Assert.Equal(0, summary.WeeklyCompleted[^3].Count);
        Assert.Equal(3, summary.CompletedThisWeek);
        Assert.Equal(1, summary.CompletedPreviousWeek);
        Assert.Equal(200m, summary.CompletedChangePct);
    }

    [Fact]
    public async Task Resumo_segue_a_mesma_regra_de_responsavel_da_listagem()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(20, 15), ownerUserId: context.AdminUserId);
        context.AddTask(Utc(20, 15), ownerUserId: context.SdrUserId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            context.Summary(context.SdrUserId, DefaultRole.Sdr, Clock).Handle(new GetTaskSummaryQuery(AllOwners: true), Ct));

        var all = await context.Summary(context.AdminUserId, DefaultRole.Admin, Clock).Handle(new GetTaskSummaryQuery(AllOwners: true), Ct);
        Assert.Equal(2, all.Counts.All);
    }
}
