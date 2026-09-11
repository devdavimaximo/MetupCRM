using Metup.Application.Deals.Common;
using MediatR;

namespace Metup.Application.Deals.Queries.GetDealById;

public record GetDealByIdQuery(Guid Id) : IRequest<DealDto>;
