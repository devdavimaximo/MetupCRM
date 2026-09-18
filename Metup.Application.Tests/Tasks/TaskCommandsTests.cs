using Metup.Application.Common.Exceptions;
using Metup.Application.Tasks.Commands.CreateTask;
using Metup.Application.Tasks.Commands.RescheduleTask;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Tasks;

public class TaskCommandsTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static CreateTaskCommandHandler Create(TasksTestContext context, Guid userId, UserRole role) =>
        new(context.Db, context.Base.As(userId, role));

    [Fact]
    public async Task Reagendar_grava_o_historico_com_prazo_anterior_autor_e_instante()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddDays(1));
        var newDue = NowUtc.AddDays(5);

        var handler = new RescheduleTaskCommandHandler(context.Db, context.Base.As(context.SdrUserId, UserRole.Sdr), Clock);
        var dto = await handler.Handle(new RescheduleTaskCommand(task.Id, newDue), Ct);

        Assert.Equal(newDue, dto.DueDate);
        var history = Assert.Single(await context.Db.TaskReschedules.ToListAsync(Ct));
        Assert.Equal(task.Id, history.TaskId);
        Assert.Equal(context.OrganizationId, history.OrganizationId);
        Assert.Equal(NowUtc.AddDays(1), history.FromDueDate);
        Assert.Equal(newDue, history.ToDueDate);
        Assert.Equal(context.SdrUserId, history.RescheduledByUserId);
        Assert.Equal(NowUtc, history.RescheduledAt);
    }

    [Fact]
    public void Tarefa_concluida_nao_reagenda_e_prazo_no_passado_e_recusado_pelo_relogio_informado()
    {
        using var context = new TasksTestContext(NowUtc);
        var done = context.AddTask(NowUtc.AddDays(1), completedAtUtc: NowUtc.AddHours(-1));
        var open = context.AddTask(NowUtc.AddDays(1));

        Assert.Throws<DomainRuleException>(() => done.Reschedule(NowUtc.AddDays(2), context.SdrUserId, NowUtc));
        Assert.Throws<DomainRuleException>(() => open.Reschedule(NowUtc.AddMinutes(-1), context.SdrUserId, NowUtc));
    }

    [Fact]
    public async Task Criar_sem_responsavel_atribui_ao_usuario_logado_e_Admin_pode_atribuir_a_outro()
    {
        using var context = new TasksTestContext(NowUtc);

        var mine = await Create(context, context.SdrUserId, UserRole.Sdr)
            .Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.Meeting, NowUtc.AddDays(1), "Alinhar escopo"), Ct);
        var assigned = await Create(context, context.AdminUserId, UserRole.Admin)
            .Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.Call, NowUtc.AddDays(1), null, context.SdrUserId), Ct);

        Assert.Equal(context.SdrUserId, mine.OwnerUserId);
        Assert.Equal(context.SdrUserId, assigned.OwnerUserId);
    }

    [Fact]
    public async Task Ingestao_por_service_token_continua_atribuindo_ao_responsavel_do_negocio()
    {
        using var context = new TasksTestContext(NowUtc);
        var handler = new CreateTaskCommandHandler(context.Db, new FakeServiceTokenUser(context.OrganizationId));

        var task = await handler.Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.WhatsApp, NowUtc.AddDays(1), null), Ct);

        Assert.Equal(context.Deal.OwnerUserId, task.OwnerUserId);
    }

    [Fact]
    public async Task Criar_recusa_negocio_de_outra_organizacao_negocio_fechado_e_responsavel_alheio_pedido_por_SDR()
    {
        using var context = new TasksTestContext(NowUtc);
        var closed = context.Base.AddClosedDeal(context.SdrUserId, won: false, amount: null, NowUtc.AddDays(-10), NowUtc.AddDays(-1));
        var sdr = Create(context, context.SdrUserId, UserRole.Sdr);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            sdr.Handle(new CreateTaskCommand(Guid.NewGuid(), ActivityType.Call, NowUtc.AddDays(1), null), Ct));
        await Assert.ThrowsAsync<DomainRuleException>(() =>
            sdr.Handle(new CreateTaskCommand(closed.Id, ActivityType.Call, NowUtc.AddDays(1), null), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            sdr.Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.Call, NowUtc.AddDays(1), null, context.AdminUserId), Ct));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            Create(context, context.AdminUserId, UserRole.Admin)
                .Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.Call, NowUtc.AddDays(1), null, Guid.NewGuid()), Ct));
    }

    [Fact]
    public async Task Criar_negocio_de_outra_organizacao_mesmo_existindo_da_404()
    {
        using var context = new TasksTestContext(NowUtc);
        var otherOrganization = new FakeCurrentUserService(Guid.NewGuid(), context.AdminUserId, UserRole.Admin);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new CreateTaskCommandHandler(context.Db, otherOrganization)
                .Handle(new CreateTaskCommand(context.Deal.Id, ActivityType.Call, NowUtc.AddDays(1), null), Ct));
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(1, true)]
    public async Task Validador_recusa_prazo_no_passado_pelo_relogio_da_organizacao(int minutes, bool valid)
    {
        var command = new CreateTaskCommand(Guid.NewGuid(), ActivityType.Call, NowUtc.AddMinutes(minutes), null);

        Assert.Equal(valid, (await new CreateTaskCommandValidator(Clock).ValidateAsync(command, Ct)).IsValid);
        Assert.Equal(valid, (await new RescheduleTaskCommandValidator(Clock).ValidateAsync(new RescheduleTaskCommand(Guid.NewGuid(), NowUtc.AddMinutes(minutes)), Ct)).IsValid);
    }
}
