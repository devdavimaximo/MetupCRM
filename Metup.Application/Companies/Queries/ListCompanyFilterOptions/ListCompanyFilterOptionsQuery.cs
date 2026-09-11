using Metup.Application.Companies.Common;
using MediatR;

namespace Metup.Application.Companies.Queries.ListCompanyFilterOptions;

public record ListCompanyFilterOptionsQuery : IRequest<CompanyFilterOptionsDto>;
