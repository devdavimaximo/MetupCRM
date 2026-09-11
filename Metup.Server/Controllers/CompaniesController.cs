using Metup.Application.Common.Models;
using Metup.Application.Companies.Commands.CreateCompany;
using Metup.Application.Companies.Commands.UpdateCompany;
using Metup.Application.Companies.Common;
using Metup.Application.Companies.Queries.GetCompanyById;
using Metup.Application.Companies.Queries.ListCompanies;
using Metup.Application.Companies.Queries.ListCompanyFilterOptions;
using Metup.Application.Contacts.Commands.CreateContact;
using Metup.Application.Contacts.Common;
using Metup.Application.Contacts.Queries.ListContactsByCompany;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Metup.Server.Controllers;

/// <remarks>
/// Regra de acesso atual: todo usuário autenticado opera as empresas da própria organização.
/// O escopo por organização é resolvido no handler (ICurrentUserService), nunca pelo client.
/// Quando houver regra fina de permissão, ela entra aqui como policy — o ponto já está pronto.
/// </remarks>
[ApiController]
[Authorize]
[Route("api/companies")]
public class CompaniesController(ISender sender) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CompanyDto>> Create(
        CreateCompanyCommand command,
        CancellationToken cancellationToken)
    {
        var company = await sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = company.Id }, company);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CompanyDto>> Update(
        Guid id,
        UpdateCompanyRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateCompanyCommand(
            id,
            request.Name,
            request.Segment,
            request.City,
            request.Instagram,
            request.Phone);

        return Ok(await sender.Send(command, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CompanyDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetCompanyByIdQuery(id), cancellationToken));

    [HttpGet]
    public async Task<ActionResult<PagedResult<CompanyListItemDto>>> List(
        [FromQuery] string? search,
        [FromQuery] string? segment,
        [FromQuery] string? city,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new ListCompaniesQuery(search, segment, city, page, pageSize);
        return Ok(await sender.Send(query, cancellationToken));
    }

    [HttpGet("filter-options")]
    public async Task<ActionResult<CompanyFilterOptionsDto>> ListFilterOptions(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListCompanyFilterOptionsQuery(), cancellationToken));

    [HttpGet("{companyId:guid}/contacts")]
    public async Task<ActionResult<IReadOnlyList<ContactDto>>> ListContacts(
        Guid companyId,
        CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListContactsByCompanyQuery(companyId), cancellationToken));

    [HttpPost("{companyId:guid}/contacts")]
    public async Task<ActionResult<ContactDto>> CreateContact(
        Guid companyId,
        CreateContactRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateContactCommand(
            companyId,
            request.Name,
            request.Role,
            request.Phone,
            request.WhatsApp,
            request.Email);

        var contact = await sender.Send(command, cancellationToken);

        return CreatedAtAction(
            nameof(ContactsController.GetById),
            "Contacts",
            new { id = contact.Id },
            contact);
    }
}

public record UpdateCompanyRequest(
    string Name,
    string? Segment,
    string? City,
    string? Instagram,
    string? Phone);

public record CreateContactRequest(
    string Name,
    string? Role,
    string? Phone,
    string? WhatsApp,
    string? Email);
