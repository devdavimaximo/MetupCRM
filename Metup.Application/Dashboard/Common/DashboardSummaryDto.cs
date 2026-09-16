using Metup.Application.Tasks.Common;

namespace Metup.Application.Dashboard.Common;

/// <summary>Quantas tarefas pendentes do usuário caem em cada recorte de prazo — mesmos buckets da lista de tarefas.</summary>
public record TaskCountsDto(int Overdue, int Today, int Upcoming);

/// <summary>
/// A fotografia de hoje (seção 3.1 do CLAUDE.md): o trabalho comercial que o usuário tem pela
/// frente. Só o que a tela usa — funil, origens e números do período vêm do overview.
/// </summary>
public record DashboardSummaryDto(
    TaskCountsDto TaskCounts,
    IReadOnlyList<TaskDto> NextTasks);
