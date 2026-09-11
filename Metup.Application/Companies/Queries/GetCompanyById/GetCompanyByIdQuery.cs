using Metup.Application.Companies.Common;
using MediatR;

namespace Metup.Application.Companies.Queries.GetCompanyById;

public record GetCompanyByIdQuery(Guid Id) : IRequest<CompanyDto>;
