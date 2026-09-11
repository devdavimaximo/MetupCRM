using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Commands.CreateDeal;

/// <remarks>Sem OrganizationId: o escopo vem do usuário logado, nunca do client.</remarks>
public record CreateDealCommand(
    Guid CompanyId,
    Guid? ContactId,
    DealSource Source,
    Guid OwnerUserId,
    decimal? Ticket,
    decimal? Amount,
    DealStage InitialStage = DealStage.Prospect) : IRequest<DealDto>;
