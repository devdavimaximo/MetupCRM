using Metup.Application.Activities.Commands.LogActivity;
using Metup.Application.Common.Exceptions;
using Metup.Application.Tasks.Commands.BulkTask;
using Metup.Application.Tasks.Commands.CancelTask;
using Metup.Application.Tasks.Commands.CompleteTask;
using Metup.Application.Tasks.Commands.ReassignTask;
using Metup.Application.Tasks.Commands.RescheduleTask;
using Metup.Application.Tests.Dashboard;
using Metup.Domain.Activities;
using Metup.Domain.Common.Exceptions;
using Metup.Domain.Tasks;
using Metup.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Metup.Application.Tests.Tasks;

/// <summary>
/// Ações da T3 e a decisão de permissão: SDR só age nas próprias tarefas; Admin/Closer em qualquer
/// tarefa da organização. Reatribuir só Admin/Closer.
/// </summary>
public class TaskActionsTests
{
    private static readonly DateTime NowUtc = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static readonly FakeOrganizationClock Clock = new(DashboardOverviewTestContext.SaoPaulo, NowUtc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static BulkTaskCommandHandler Bulk(TasksTestContext context, Guid userId, DefaultRole role) =>
        new(context.Db, context.Base.As(userId, role), Clock, new RecordingPublisher());

    private static LogActivityCommandHandler Log(TasksTestContext context, Guid userId, DefaultRole role) =>
        new(context.Db, context.Base.As(userId, role), Clock, new RecordingPublisher());

    private static ReassignTaskCommandHandler Reassign(TasksTestContext context, Guid userId, DefaultRole role) =>
        new(context.Db, context.Base.As(userId, role));

    [Fact]
    public async Task SDR_recebe_403_ao_agir_em_tarefa_alheia_e_404_em_tarefa_de_outra_organizacao()
    {
        using var context = new TasksTestContext(NowUtc);
        var adminTask = context.AddTask(NowUtc.AddDays(1), ownerUserId: context.AdminUserId);
        var foreign = context.AddTask(NowUtc.AddDays(1), organizationId: Guid.NewGuid());
        var sdr = context.Base.As(context.SdrUserId, DefaultRole.Sdr);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new CompleteTaskCommandHandler(context.Db, sdr, Clock, new RecordingPublisher()).Handle(new CompleteTaskCommand(adminTask.Id), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new CancelTaskCommandHandler(context.Db, sdr, Clock).Handle(new CancelTaskCommand(adminTask.Id), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            new RescheduleTaskCommandHandler(context.Db, sdr, Clock).Handle(new RescheduleTaskCommand(adminTask.Id, NowUtc.AddDays(3)), Ct));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            new CompleteTaskCommandHandler(context.Db, sdr, Clock, new RecordingPublisher()).Handle(new CompleteTaskCommand(foreign.Id), Ct));

        Assert.Equal(TaskItemStatus.Pendente, (await context.Db.Tasks.AsNoTracking().SingleAsync(t => t.Id == adminTask.Id, Ct)).Status);
    }

    [Fact]
    public async Task Closer_conclui_e_cancela_tarefa_do_SDR_com_o_relogio_da_organizacao()
    {
        using var context = new TasksTestContext(NowUtc);
        var toComplete = context.AddTask(NowUtc.AddDays(1));
        var toCancel = context.AddTask(NowUtc.AddDays(2));
        var closer = context.Base.As(context.CloserUserId, DefaultRole.Closer);

        var completed = await new CompleteTaskCommandHandler(context.Db, closer, Clock, new RecordingPublisher())
            .Handle(new CompleteTaskCommand(toComplete.Id), Ct);
        var cancelled = await new CancelTaskCommandHandler(context.Db, closer, Clock).Handle(new CancelTaskCommand(toCancel.Id), Ct);

        Assert.Equal(NowUtc, completed.CompletedAt);
        Assert.Equal(NowUtc, cancelled.CompletedAt);
        Assert.Equal(TaskItemStatus.Cancelada, cancelled.Status);
    }

    [Fact]
    public async Task Reatribuir_recusa_SDR_e_destino_de_outra_organizacao_e_mesmo_dono_e_no_op()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddDays(1));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            Reassign(context, context.SdrUserId, DefaultRole.Sdr).Handle(new ReassignTaskCommand(task.Id, context.AdminUserId), Ct));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            Reassign(context, context.AdminUserId, DefaultRole.Admin).Handle(new ReassignTaskCommand(task.Id, Guid.NewGuid()), Ct));

        var same = await Reassign(context, context.AdminUserId, DefaultRole.Admin).Handle(new ReassignTaskCommand(task.Id, context.SdrUserId), Ct);
        var moved = await Reassign(context, context.CloserUserId, DefaultRole.Closer).Handle(new ReassignTaskCommand(task.Id, context.CloserUserId), Ct);

        Assert.Equal(context.SdrUserId, same.OwnerUserId);
        Assert.Equal(context.CloserUserId, moved.OwnerUserId);
        Assert.Equal("Carla Closer", moved.OwnerUserName);
    }

    [Fact]
    public void Reatribuir_tarefa_fechada_e_recusado_pelo_dominio()
    {
        var task = TaskItem.Create(Guid.NewGuid(), Guid.NewGuid(), ActivityType.Call, NowUtc, Guid.NewGuid(), null);
        task.Complete(NowUtc);

        Assert.Throws<DomainRuleException>(() => task.Reassign(Guid.NewGuid()));
    }

    [Theory]
    [InlineData(0, BulkTaskAction.Complete, false, false, false)]
    [InlineData(101, BulkTaskAction.Complete, false, false, false)]
    [InlineData(100, BulkTaskAction.Complete, false, false, true)]
    [InlineData(1, BulkTaskAction.Reschedule, false, false, false)]
    [InlineData(1, BulkTaskAction.Reschedule, true, false, true)]
    [InlineData(1, BulkTaskAction.Reassign, false, false, false)]
    [InlineData(1, BulkTaskAction.Reassign, false, true, true)]
    public async Task Validador_do_lote_exige_limite_e_o_campo_de_cada_acao(
        int count, BulkTaskAction action, bool withDueDate, bool withOwner, bool valid)
    {
        var command = new BulkTaskCommand(
            Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToList(),
            action,
            withDueDate ? NowUtc.AddDays(1) : null,
            withOwner ? Guid.NewGuid() : null);

        Assert.Equal(valid, (await new BulkTaskCommandValidator(Clock).ValidateAsync(command, Ct)).IsValid);
    }

    [Fact]
    public async Task Lote_falha_por_item_sem_vazar_existencia_e_grava_numa_transacao_so()
    {
        using var context = new TasksTestContext(NowUtc);
        var mine = context.AddTask(NowUtc.AddDays(1));
        var alsoMine = context.AddTask(NowUtc.AddDays(2));
        var done = context.AddTask(NowUtc.AddDays(1), completedAtUtc: NowUtc.AddHours(-1));
        var others = context.AddTask(NowUtc.AddDays(1), ownerUserId: context.AdminUserId);
        var foreign = context.AddTask(NowUtc.AddDays(1), organizationId: Guid.NewGuid());
        var missing = Guid.NewGuid();
        var saves = 0;
        context.Db.SavedChanges += (_, _) => saves++;

        var result = await Bulk(context, context.SdrUserId, DefaultRole.Sdr).Handle(
            new BulkTaskCommand([mine.Id, done.Id, others.Id, foreign.Id, missing, alsoMine.Id], BulkTaskAction.Complete), Ct);

        Assert.Equal([mine.Id, alsoMine.Id], result.Succeeded.Select(t => t.Id));
        Assert.All(result.Succeeded, t => Assert.Equal(NowUtc, t.CompletedAt));
        Assert.Equal(
            [(done.Id, BulkTaskFailureReason.NotPending), (others.Id, BulkTaskFailureReason.NotFound),
             (foreign.Id, BulkTaskFailureReason.NotFound), (missing, BulkTaskFailureReason.NotFound)],
            result.Failed.Select(f => (f.Id, f.Reason)));
        Assert.Equal(1, saves);
        Assert.Equal(TaskItemStatus.Pendente, (await context.Db.Tasks.AsNoTracking().SingleAsync(t => t.Id == others.Id, Ct)).Status);
    }

    [Fact]
    public async Task Repetir_o_mesmo_lote_devolve_not_pending_sem_erro()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddDays(1));
        var command = new BulkTaskCommand([task.Id], BulkTaskAction.Complete);

        await Bulk(context, context.SdrUserId, DefaultRole.Sdr).Handle(command, Ct);
        var again = await Bulk(context, context.SdrUserId, DefaultRole.Sdr).Handle(command, Ct);

        Assert.Empty(again.Succeeded);
        Assert.Equal(BulkTaskFailureReason.NotPending, Assert.Single(again.Failed).Reason);
    }

    [Fact]
    public async Task Reagendar_em_massa_grava_o_historico_de_cada_tarefa()
    {
        using var context = new TasksTestContext(NowUtc);
        var first = context.AddTask(NowUtc.AddDays(1));
        var second = context.AddTask(NowUtc.AddDays(2), ownerUserId: context.AdminUserId);
        var newDue = NowUtc.AddDays(7);

        var result = await Bulk(context, context.AdminUserId, DefaultRole.Admin)
            .Handle(new BulkTaskCommand([first.Id, second.Id], BulkTaskAction.Reschedule, DueDate: newDue), Ct);

        Assert.All(result.Succeeded, t => Assert.Equal(newDue, t.DueDate));
        var history = await context.Db.TaskReschedules.AsNoTracking().OrderBy(r => r.FromDueDate).ToListAsync(Ct);
        Assert.Equal([first.Id, second.Id], history.Select(h => h.TaskId));
        Assert.All(history, h => Assert.Equal((context.AdminUserId, NowUtc, newDue), (h.RescheduledByUserId, h.RescheduledAt, h.ToDueDate)));
    }

    [Fact]
    public async Task Reatribuir_em_massa_e_so_Admin_Closer_e_exige_destino_da_organizacao()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddDays(1));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => Bulk(context, context.SdrUserId, DefaultRole.Sdr)
            .Handle(new BulkTaskCommand([task.Id], BulkTaskAction.Reassign, OwnerUserId: context.AdminUserId), Ct));
        await Assert.ThrowsAsync<NotFoundException>(() => Bulk(context, context.AdminUserId, DefaultRole.Admin)
            .Handle(new BulkTaskCommand([task.Id], BulkTaskAction.Reassign, OwnerUserId: Guid.NewGuid()), Ct));

        var result = await Bulk(context, context.AdminUserId, DefaultRole.Admin)
            .Handle(new BulkTaskCommand([task.Id], BulkTaskAction.Reassign, OwnerUserId: context.CloserUserId), Ct);

        Assert.Equal(context.CloserUserId, Assert.Single(result.Succeeded).OwnerUserId);
    }

    [Fact]
    public async Task Registrar_atividade_com_CompletesTaskId_conclui_a_tarefa_na_mesma_gravacao()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddHours(-2));
        var saves = 0;
        context.Db.SavedChanges += (_, _) => saves++;

        var result = await Log(context, context.SdrUserId, DefaultRole.Sdr).Handle(
            new LogActivityCommand(context.Deal.Id, null, ActivityType.Call, ActivityOutcome.Atendeu, null, null,
                ActivityType.Meeting, NowUtc.AddDays(2), null, CompletesTaskId: task.Id), Ct);

        var stored = await context.Db.Tasks.AsNoTracking().SingleAsync(t => t.Id == task.Id, Ct);
        Assert.Equal((TaskItemStatus.Concluida, (DateTime?)NowUtc), (stored.Status, stored.CompletedAt));
        Assert.NotNull(result.NextAction);
        Assert.Equal(1, saves);
    }

    [Fact]
    public async Task Registrar_atividade_recusa_tarefa_de_outro_negocio_ou_alheia_sem_gravar_nada()
    {
        using var context = new TasksTestContext(NowUtc);
        var otherDeal = context.Base.AddOpenDeal(context.SdrUserId, null, 5_000m, NowUtc.AddDays(-5));
        var otherDealTask = context.AddTask(NowUtc.AddDays(1), dealId: otherDeal.Id);
        var adminTask = context.AddTask(NowUtc.AddDays(1), ownerUserId: context.AdminUserId);
        var sdr = Log(context, context.SdrUserId, DefaultRole.Sdr);

        LogActivityCommand Command(Guid taskId) =>
            new(context.Deal.Id, null, ActivityType.Note, null, "nota", null, null, null, null, CompletesTaskId: taskId);

        await Assert.ThrowsAsync<DomainRuleException>(() => sdr.Handle(Command(otherDealTask.Id), Ct));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => sdr.Handle(Command(adminTask.Id), Ct));

        Assert.Empty(await context.Db.Activities.ToListAsync(Ct));
        Assert.All(await context.Db.Tasks.AsNoTracking().ToListAsync(Ct), t => Assert.Equal(TaskItemStatus.Pendente, t.Status));
    }

    [Fact]
    public async Task Registrar_atividade_sem_o_campo_nao_mexe_em_tarefa_existente()
    {
        using var context = new TasksTestContext(NowUtc);
        var task = context.AddTask(NowUtc.AddHours(-2));

        await Log(context, context.SdrUserId, DefaultRole.Sdr).Handle(
            new LogActivityCommand(context.Deal.Id, null, ActivityType.Note, null, "nota", null, null, null, null), Ct);

        Assert.Equal(TaskItemStatus.Pendente, (await context.Db.Tasks.AsNoTracking().SingleAsync(t => t.Id == task.Id, Ct)).Status);
    }
}
