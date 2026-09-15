using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Commands.UpdateDeal;

/// <remarks>O negócio não troca de empresa nem de estágio por aqui: edita os dados do negócio.</remarks>
public record UpdateDealCommand(
    Guid Id,
    Guid? ContactId,
    DealSource Source,
    Guid OwnerUserId,
    decimal? Ticket,
    decimal? Amount,
    DateOnly? ExpectedCloseDate = null) : IRequest<DealDto>;
