namespace Metup.Application.Tasks.Common;

/// <summary>
/// Números da tela de Tarefas numa chamada: KPIs, contagem das abas, donut e destaques da semana.
/// </summary>
/// <param name="Previous">A mesma régua 7 dias antes; nulo quando não havia tarefa nenhuma naquele instante ("Sem base anterior").</param>
/// <param name="WeeklyCompleted">Concluídas por dia local, 14 dias terminando na referência, sem buracos.</param>
/// <param name="CompletedThisWeek">Concluídas nos 7 dias que terminam na referência (os 7 últimos pontos da série).</param>
/// <param name="CompletedPreviousWeek">Concluídas nos 7 dias anteriores (os 7 primeiros pontos).</param>
/// <param name="CompletedChangePct">Variação percentual, 1 casa; nulo sem base (semana anterior zerada).</param>
public record TaskSummaryDto(
    DateOnly ReferenceDate,
    TaskScopeCountsDto Counts,
    TaskPreviousCountsDto? Previous,
    IReadOnlyList<DailyCountDto> WeeklyCompleted,
    int CompletedThisWeek,
    int CompletedPreviousWeek,
    decimal? CompletedChangePct);

/// <summary>Cada número é o <c>totalCount</c> da listagem no recorte correspondente.</summary>
public record TaskScopeCountsDto(
    int All,
    int Overdue,
    int Today,
    int ThisWeek,
    int Later,
    int Completed30d,
    int Cancelled30d);

public record TaskPreviousCountsDto(int Overdue, int Today, int ThisWeek);

public record DailyCountDto(DateOnly Date, int Count);

/// <summary>Um dia do calendário lateral: pendentes com prazo nele e, delas, as já atrasadas.</summary>
public record TaskCalendarDayDto(DateOnly Date, int Open, int Overdue);
