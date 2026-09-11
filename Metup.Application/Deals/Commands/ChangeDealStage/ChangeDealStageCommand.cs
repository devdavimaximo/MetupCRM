using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

/// <remarks>
/// Só move estágios ativos do funil (Prospect…Negociação). Fechar como ganho ou perdido é
/// responsabilidade do CloseDealCommand, que também exige o valor fechado.
/// </remarks>
public record ChangeDealStageCommand(Guid Id, DealStage Stage) : IRequest<DealDto>;
