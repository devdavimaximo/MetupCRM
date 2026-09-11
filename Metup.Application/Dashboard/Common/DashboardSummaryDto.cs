using Metup.Application.Tasks.Common;
using Metup.Domain.Activities;
using Metup.Domain.Deals;

namespace Metup.Application.Dashboard.Common;

/// <summary>Quantas tarefas pendentes do usuário caem em cada recorte de prazo — mesmos buckets da lista de tarefas.</summary>
public record TaskCountsDto(int Overdue, int Today, int Upcoming);

/// <summary>Quantos negócios abertos a organização tem num estágio do funil.</summary>
public record DealsByStageDto(DealStage Stage, int Count);

/// <summary>Quantas atividades de um tipo o usuário já registrou hoje.</summary>
public record ActivitiesByTypeDto(ActivityType Type, int Count);

/// <summary>
/// A fotografia de hoje (seção 3.1 do CLAUDE.md): quanto trabalho comercial tem pela frente e onde
/// estão as oportunidades — sem métricas de conversão nem funil histórico (isso é V3).
/// </summary>
public record DashboardSummaryDto(
    TaskCountsDto TaskCounts,
    IReadOnlyList<TaskDto> TodayTasks,
    IReadOnlyList<DealsByStageDto> OpenDealsByStage,
    int OpenDealsTotal,
    IReadOnlyList<ActivitiesByTypeDto> ActivitiesToday,
    int ActivitiesTodayTotal);
