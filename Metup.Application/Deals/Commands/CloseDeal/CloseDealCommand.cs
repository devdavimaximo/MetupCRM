using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Commands.CloseDeal;

/// <param name="Won">true = ganho, false = perdido.</param>
/// <param name="ClosedAmount">Valor fechado; se omitido, mantém o valor em negociação do negócio.</param>
public record CloseDealCommand(Guid Id, bool Won, decimal? ClosedAmount) : IRequest<DealDto>;
