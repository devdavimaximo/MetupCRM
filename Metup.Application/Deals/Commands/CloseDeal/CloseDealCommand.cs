using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Commands.CloseDeal;

/// <param name="Won">true = ganho, false = perdido.</param>
/// <param name="ClosedAmount">Valor fechado; se omitido, mantém o valor em negociação do negócio.</param>
/// <param name="LostReason">Obrigatório no perdido; proibido no ganho.</param>
/// <param name="LostNote">Complemento opcional do motivo (até 280 caracteres); só no perdido.</param>
public record CloseDealCommand(
    Guid Id,
    bool Won,
    decimal? ClosedAmount,
    LostReason? LostReason = null,
    string? LostNote = null) : IRequest<DealDto>;
