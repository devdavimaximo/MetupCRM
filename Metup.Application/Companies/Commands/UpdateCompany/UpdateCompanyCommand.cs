using Metup.Application.Companies.Common;
using MediatR;

namespace Metup.Application.Companies.Commands.UpdateCompany;

public record UpdateCompanyCommand(
    Guid Id,
    string Name,
    string? Segment,
    string? City,
    string? Instagram,
    string? Phone,
    string? Cnpj = null,
    string? Website = null) : IRequest<CompanyDto>;
