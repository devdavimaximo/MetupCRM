using Metup.Application.Common.Models;
using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Queries.ListDeals;

/// <param name="Stage">Sem filtro = todos os estágios (o pipeline pede a lista inteira para montar as colunas).</param>
public record ListDealsQuery(
    DealStage? Stage = null,
    Guid? OwnerUserId = null,
    DealSource? Source = null,
    Guid? CompanyId = null,
    int Page = 1,
    int PageSize = 50) : IRequest<PagedResult<DealListItemDto>>;
