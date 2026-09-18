using Metup.Application.Common.Models;
using Metup.Domain.Tasks;

namespace Metup.Application.Tasks.Common;

/// <summary>
/// As fronteiras dos recortes de prazo, em UTC, calculadas a partir de um dia de referência no fuso
/// da organização. Listagem e resumo usam esta mesma classe — é o que garante que a contagem de
/// cada aba bate com o total da lista.
/// <list type="bullet">
/// <item><b>Atrasadas:</b> pendente com prazo antes de <see cref="OverdueBeforeUtc"/> — o agora, se a
/// referência é hoje; senão, 00:00 do dia de referência (um dia inteiro visto "de manhã").</item>
/// <item><b>Hoje:</b> daí até o fim do dia de referência.</item>
/// <item><b>Esta semana:</b> de amanhã até o fim de domingo (vazio quando a referência é domingo).</item>
/// <item><b>Mais tarde:</b> depois de domingo.</item>
/// <item><b>Todas:</b> pendentes + concluídas com <c>CompletedAt</c> nos 30 dias locais que terminam
/// no dia de referência. Canceladas entram só quando pedidas no filtro de status.</item>
/// </list>
/// Os recortes de prazo usam o status <b>atual</b> da tarefa, mesmo com referência no passado.
/// </summary>
public sealed record TaskWindows(
    DateOnly ReferenceDate,
    DateTime OverdueBeforeUtc,
    DateTime ReferenceDayEndUtc,
    DateTime WeekEndUtc,
    DateTime ClosedSinceUtc)
{
    public const int ClosedLookbackDays = 30;

    /// <summary>Status que "Todas" mostra quando o filtro de status não é informado.</summary>
    public static readonly IReadOnlyList<TaskItemStatus> DefaultAllStatuses = [TaskItemStatus.Pendente, TaskItemStatus.Concluida];

    public static TaskWindows For(OrganizationClockSnapshot clock, DateOnly referenceDate) =>
        At(clock, referenceDate, referenceDate == clock.Today ? clock.UtcNow : clock.StartOfDayUtc(referenceDate));

    /// <summary>Mesmas janelas com um corte de atraso explícito (a comparação com 7 dias antes usa o agora − 7 dias).</summary>
    public static TaskWindows At(OrganizationClockSnapshot clock, DateOnly referenceDate, DateTime overdueBeforeUtc)
    {
        var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)referenceDate.DayOfWeek + 7) % 7;

        return new TaskWindows(
            referenceDate,
            overdueBeforeUtc,
            clock.StartOfDayUtc(referenceDate.AddDays(1)),
            clock.StartOfDayUtc(referenceDate.AddDays(daysUntilSunday + 1)),
            clock.StartOfDayUtc(referenceDate.AddDays(1 - ClosedLookbackDays)));
    }

    /// <summary>
    /// Aplica o recorte e o filtro de status. Nos recortes de prazo, <paramref name="statuses"/> só
    /// restringe (sem "Pendente" nada sobra). Em <see cref="TaskScope.All"/>, concluídas e canceladas
    /// ficam limitadas à janela de 30 dias.
    /// </summary>
    public IQueryable<TaskItem> Apply(IQueryable<TaskItem> tasks, TaskScope scope, IReadOnlyCollection<TaskItemStatus>? statuses)
    {
        var pending = tasks.Where(t => t.Status == TaskItemStatus.Pendente);

        var scoped = scope switch
        {
            TaskScope.Overdue => pending.Where(t => t.DueDate < OverdueBeforeUtc),
            TaskScope.Today => pending.Where(t => t.DueDate >= OverdueBeforeUtc && t.DueDate < ReferenceDayEndUtc),
            TaskScope.ThisWeek => pending.Where(t => t.DueDate >= ReferenceDayEndUtc && t.DueDate < WeekEndUtc),
            TaskScope.Later => pending.Where(t => t.DueDate >= WeekEndUtc),
            _ => tasks.Where(t => t.Status == TaskItemStatus.Pendente
                || (t.CompletedAt >= ClosedSinceUtc && t.CompletedAt < ReferenceDayEndUtc)),
        };

        var wanted = statuses is { Count: > 0 } ? statuses : scope == TaskScope.All ? DefaultAllStatuses : null;

        return wanted is null ? scoped : scoped.Where(t => wanted.Contains(t.Status));
    }
}
