using Metup.Application.Common.Exceptions;
using Metup.Application.Tasks.Common;
using Metup.Application.Tasks.Queries.ListTasks;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Deals;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Tasks;

public class ListTasksTests
{
    /// <summary>Quarta-feira, 16/09/2026, 12:00 em Brasília (UTC−3).</summary>
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock SaoPauloClock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateTime Utc(int day, int hour, int minute = 0) => new(2026, 9, day, hour, minute, 0, DateTimeKind.Utc);

    private static async Task<List<Guid>> Ids(TasksTestContext context, ListTasksQuery query, FakeOrganizationClock? clock = null) =>
        (await context.List(context.SdrUserId, UserRole.Sdr, clock ?? SaoPauloClock).Handle(query, Ct))
            .Items.Select(t => t.Id).ToList();

    [Fact]
    public async Task Recortes_sao_disjuntos_e_respeitam_o_dia_e_o_domingo_no_fuso_da_organizacao()
    {
        using var context = new TasksTestContext(NowUtc);
        var overdueThisMorning = context.AddTask(Utc(16, 14));           // 11:00 local, antes do agora
        var overdueLastWeek = context.AddTask(Utc(10, 12));
        var tonight = context.AddTask(Utc(17, 2, 30));                   // 16/09 23:30 local — dia 17 em UTC
        var sundayNight = context.AddTask(Utc(21, 2));                   // domingo 20/09 23:00 local
        var mondayEarly = context.AddTask(Utc(21, 3, 30));               // segunda 21/09 00:30 local
        var completed29 = context.AddTask(Utc(10, 12), completedAtUtc: NowUtc.AddDays(-29));
        context.AddTask(Utc(10, 12), completedAtUtc: NowUtc.AddDays(-31));
        var cancelled = context.AddTask(Utc(10, 12), cancelledAtUtc: NowUtc.AddDays(-2));

        Assert.Equal([overdueLastWeek.Id, overdueThisMorning.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Overdue)));
        Assert.Equal([tonight.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Today)));
        Assert.Equal([sundayNight.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.ThisWeek)));
        Assert.Equal([mondayEarly.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Later)));

        var all = await Ids(context, new ListTasksQuery(Scope: TaskScope.All));
        Assert.Equal(6, all.Count);
        Assert.Contains(completed29.Id, all);
        Assert.DoesNotContain(cancelled.Id, all);

        Assert.Equal([cancelled.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.All, Statuses: [TaskItemStatus.Cancelada])));
    }

    [Fact]
    public async Task Referencia_em_outro_dia_corta_o_atraso_no_inicio_daquele_dia()
    {
        using var context = new TasksTestContext(NowUtc);
        var saturday = context.AddTask(Utc(19, 15));
        var sunday = context.AddTask(Utc(20, 15));
        var monday = context.AddTask(Utc(21, 15));
        var sundayReference = new DateOnly(2026, 9, 20);

        Assert.Equal([saturday.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Overdue, ReferenceDate: sundayReference)));
        Assert.Equal([sunday.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Today, ReferenceDate: sundayReference)));
        Assert.Empty(await Ids(context, new ListTasksQuery(Scope: TaskScope.ThisWeek, ReferenceDate: sundayReference)));
        Assert.Equal([monday.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Later, ReferenceDate: sundayReference)));
    }

    [Fact]
    public async Task Organizacao_a_leste_de_UTC_fecha_a_semana_no_domingo_local()
    {
        // Quarta 16/09 12:00 em Tóquio (UTC+9).
        var tokyo = new FakeOrganizationClock(TasksTestContext.Zone("Asia/Tokyo"), Utc(16, 3));
        using var context = new TasksTestContext(NowUtc);
        var sundayLocal = context.AddTask(Utc(20, 14));   // domingo 23:00 em Tóquio
        var mondayLocal = context.AddTask(Utc(20, 16));   // segunda 01:00 em Tóquio — ainda domingo em UTC

        Assert.Equal([sundayLocal.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.ThisWeek), tokyo));
        Assert.Equal([mondayLocal.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.Later), tokyo));
    }

    [Fact]
    public async Task SDR_nao_ve_todos_nem_tarefa_alheia_Admin_e_Closer_sim_e_outra_organizacao_nunca_aparece()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(20, 15), ownerUserId: context.SdrUserId);
        context.AddTask(Utc(20, 15), ownerUserId: context.AdminUserId);
        context.AddTask(Utc(20, 15), ownerUserId: context.AdminUserId, organizationId: Guid.NewGuid());

        var sdr = context.List(context.SdrUserId, UserRole.Sdr, SaoPauloClock);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => sdr.Handle(new ListTasksQuery(AllOwners: true), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => sdr.Handle(new ListTasksQuery(OwnerUserId: context.AdminUserId), Ct));
        Assert.Equal(1, (await sdr.Handle(new ListTasksQuery(OwnerUserId: context.SdrUserId), Ct)).TotalCount);

        var admin = await context.List(context.AdminUserId, UserRole.Admin, SaoPauloClock).Handle(new ListTasksQuery(AllOwners: true), Ct);
        Assert.Equal(2, admin.TotalCount);

        var closer = await context.List(context.CloserUserId, UserRole.Closer, SaoPauloClock)
            .Handle(new ListTasksQuery(OwnerUserId: context.SdrUserId, Scope: TaskScope.All), Ct);
        Assert.Equal(context.SdrUserId, Assert.Single(closer.Items).OwnerUserId);
    }

    [Theory]
    [InlineData(TaskSort.DueAsc)]
    [InlineData(TaskSort.Recent)]
    [InlineData(TaskSort.Owner)]
    [InlineData(TaskSort.Status)]
    public async Task Ordenacao_desempata_por_Id_e_a_pagina_seguinte_nao_repete_item(TaskSort sort)
    {
        using var context = new TasksTestContext(NowUtc);
        var created = Enumerable.Range(0, 5)
            .Select(_ => context.AddTask(Utc(20, 15), createdAtUtc: Utc(1, 12)))
            .ToList();

        var seen = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            seen.AddRange(await Ids(context, new ListTasksQuery(Scope: TaskScope.All, Sort: sort, Page: page, PageSize: 2)));
        }

        Assert.Equal(created.Select(t => t.Id).Order(), seen);
    }

    [Fact]
    public async Task Filtros_por_tipo_etapa_e_busca_sem_acento_na_empresa_ou_na_nota()
    {
        using var context = new TasksTestContext(NowUtc);
        var byNote = context.AddTask(Utc(20, 15), note: "Revisar orçamento", type: ActivityType.Proposal);
        var otherDeal = context.Base.AddOpenDeal(context.SdrUserId, 1_000m, null, NowUtc.AddDays(-5));
        var call = context.AddTask(Utc(20, 15), dealId: otherDeal.Id);

        Assert.Equal([byNote.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.All, Search: "ORCAMENTO")));
        Assert.Equal(2, (await Ids(context, new ListTasksQuery(Scope: TaskScope.All, Search: "alfa"))).Count);
        Assert.Equal([call.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.All, Types: [ActivityType.Call])));
        Assert.Equal([byNote.Id], await Ids(context, new ListTasksQuery(Scope: TaskScope.All, DealStages: [DealStage.Proposta])));
    }

    [Fact]
    public async Task Modo_legado_sem_recorte_continua_devolvendo_todos_os_status()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(20, 15));
        context.AddTask(Utc(10, 12), completedAtUtc: NowUtc.AddDays(-90));

        Assert.Equal(2, (await Ids(context, new ListTasksQuery())).Count);
        Assert.Single(await Ids(context, new ListTasksQuery(Status: TaskItemStatus.Concluida)));
    }

    [Fact]
    public async Task DTO_traz_etapa_valor_efetivo_estimado_e_contato()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(Utc(20, 15));

        var task = Assert.Single((await context.List(context.SdrUserId, UserRole.Sdr, SaoPauloClock).Handle(new ListTasksQuery(), Ct)).Items);

        Assert.Equal(DealStage.Proposta, task.DealStage);
        Assert.Equal(12_000m, task.DealAmount);
        Assert.True(task.DealAmountIsEstimated);
        Assert.Null(task.ContactName);
    }

    [Theory]
    [InlineData(100, true, true)]
    [InlineData(101, true, false)]
    [InlineData(100, false, true)]
    [InlineData(101, false, false)]
    [InlineData(200, false, false)]
    public async Task Validador_limita_a_pagina_a_100_com_e_sem_recorte(int pageSize, bool scoped, bool valid)
    {
        var query = new ListTasksQuery(PageSize: pageSize, Scope: scoped ? TaskScope.All : null);
        Assert.Equal(valid, (await new ListTasksQueryValidator().ValidateAsync(query, Ct)).IsValid);
    }
}
