using Metup.Application.Companies.Common;
using MediatR;

namespace Metup.Application.Companies.Commands.CreateCompany;

/// <remarks>Sem OrganizationId: o escopo vem do usuário logado, nunca do client.</remarks>
public record CreateCompanyCommand(
    string Name,
    string? Segment,
    string? City,
    string? Instagram,
    string? Phone,
    string? Cnpj = null,
    string? Website = null) : IRequest<CompanyDto>;
