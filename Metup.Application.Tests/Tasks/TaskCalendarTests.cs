using Metup.Application.Common.Exceptions;
using Metup.Application.Tasks.Common;
using Metup.Application.Tasks.Queries.GetTaskCalendar;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Users;
using Xunit;

namespace Metup.Application.Tests.Tasks;

public class TaskCalendarTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static GetTaskCalendarQueryHandler Handler(TasksTestContext context, Guid userId, UserRole role, FakeOrganizationClock? clock = null) =>
        new(context.Db, context.Base.As(userId, role), clock ?? Clock);

    [Fact]
    public async Task Agrupa_pendentes_pelo_dia_local_e_conta_atrasadas_pelo_agora()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(NowUtc.AddHours(-3));                                        // 16/09, já atrasada
        context.AddTask(NowUtc.AddHours(2));                                         // 16/09, aberta
        context.AddTask(new DateTime(2026, 9, 18, 2, 30, 0, DateTimeKind.Utc));      // 17/09 23:30 em Brasília
        context.AddTask(NowUtc.AddDays(1), completedAtUtc: NowUtc);                  // concluída: fora
        context.AddTask(NowUtc.AddDays(1), cancelledAtUtc: NowUtc);                  // cancelada: fora
        context.AddTask(new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc));      // outro mês: fora

        var days = await Handler(context, context.SdrUserId, UserRole.Sdr).Handle(new GetTaskCalendarQuery("2026-09", null, false), Ct);

        Assert.Equal(
            [new TaskCalendarDayDto(new DateOnly(2026, 9, 16), 2, 1), new TaskCalendarDayDto(new DateOnly(2026, 9, 17), 1, 0)],
            days);
    }

    [Fact]
    public async Task Dia_com_troca_de_horario_de_verao_fica_no_dia_local_certo()
    {
        var newYork = TasksTestContext.Zone("America/New_York");
        var clock = new FakeOrganizationClock(newYork, new DateTime(2026, 3, 20, 12, 0, 0, DateTimeKind.Utc));
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(new DateTime(2026, 3, 9, 3, 30, 0, DateTimeKind.Utc));  // 08/03 23:30 EDT (dia do salto)
        context.AddTask(new DateTime(2026, 3, 9, 4, 30, 0, DateTimeKind.Utc));  // 09/03 00:30 EDT
        context.AddTask(new DateTime(2026, 3, 8, 4, 30, 0, DateTimeKind.Utc));  // 07/03 23:30 EST

        var days = await Handler(context, context.SdrUserId, UserRole.Sdr, clock).Handle(new GetTaskCalendarQuery("2026-03", null, false), Ct);

        Assert.Equal([7, 8, 9], days.Select(d => d.Date.Day));
        Assert.All(days, d => Assert.Equal(1, d.Open));
    }

    [Fact]
    public async Task Respeita_o_escopo_de_responsavel()
    {
        using var context = new TasksTestContext(NowUtc);
        context.AddTask(NowUtc.AddDays(1));
        context.AddTask(NowUtc.AddDays(1), ownerUserId: context.AdminUserId);
        var query = new GetTaskCalendarQuery("2026-09", null, true);

        var all = await Handler(context, context.AdminUserId, UserRole.Admin).Handle(query, Ct);
        var mine = await Handler(context, context.SdrUserId, UserRole.Sdr).Handle(query with { AllOwners = false }, Ct);

        Assert.Equal(2, Assert.Single(all).Open);
        Assert.Equal(1, Assert.Single(mine).Open);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => Handler(context, context.SdrUserId, UserRole.Sdr).Handle(query, Ct));
    }

    [Theory]
    [InlineData("2026-09", true)]
    [InlineData("2028-09", true)]
    [InlineData("2028-10", false)]
    [InlineData("2024-08", false)]
    [InlineData("2026-13", false)]
    [InlineData("setembro", false)]
    public async Task Validador_aceita_mes_valido_ate_24_meses_de_distancia(string month, bool valid)
    {
        var result = await new GetTaskCalendarQueryValidator(Clock).ValidateAsync(new GetTaskCalendarQuery(month, null, false), Ct);

        Assert.Equal(valid, result.IsValid);
    }
}
