using Metup.Application.Tasks.Common;
using MediatR;

namespace Metup.Application.Tasks.Queries.GetTaskSummary;

/// <summary>Mesmos filtros de responsável e de data de referência da listagem (<c>ListTasksQuery</c>).</summary>
public record GetTaskSummaryQuery(
    Guid? OwnerUserId = null,
    bool AllOwners = false,
    DateOnly? ReferenceDate = null) : IRequest<TaskSummaryDto>;
