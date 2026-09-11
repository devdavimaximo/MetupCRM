using Metup.Application.Activities.Common;
using MediatR;

namespace Metup.Application.Activities.Queries.ListActivitiesByDeal;

/// <summary>Timeline do negócio — todas as atividades, mais recente primeiro.</summary>
public record ListActivitiesByDealQuery(Guid DealId) : IRequest<IReadOnlyList<ActivityDto>>;
