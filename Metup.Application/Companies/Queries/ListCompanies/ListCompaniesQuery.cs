using Metup.Application.Common.Models;
using Metup.Application.Companies.Common;
using MediatR;

namespace Metup.Application.Companies.Queries.ListCompanies;

/// <param name="Search">Busca livre por nome, segmento ou cidade.</param>
public record ListCompaniesQuery(
    string? Search = null,
    string? Segment = null,
    string? City = null,
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<CompanyListItemDto>>;
