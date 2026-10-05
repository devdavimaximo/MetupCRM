using FluentValidation;
using Metup.Application.LeadFinder.Common;
using MediatR;

namespace Metup.Application.Integrations.Commands.ReceiveLeadSearchResults;

/// <summary>Ingestão (n8n → CRM) de um lote de leads garimpados para uma busca.</summary>
public record ReceiveLeadSearchResultsCommand(Guid LeadSearchId, IReadOnlyList<IncomingLead> Leads) : IRequest<LeadBatchResultDto>;

/// <summary>
/// Um lugar como a automação entrega. Tudo opcional menos o nome: fontes diferentes trazem campos
/// diferentes, e o CRM normaliza (corta excesso, descarta valor inválido) em vez de recusar o lote.
/// </summary>
/// <param name="ExternalId">Id do lugar na fonte (ex.: place_id do Google Maps).</param>
/// <param name="Rating">Nota de 0 a 5.</param>
public record IncomingLead(
    string? ExternalId,
    string? Name,
    string? Category,
    string? Phone,
    string? Website,
    string? Email,
    string? Instagram,
    string? Address,
    string? City,
    string? State,
    decimal? Rating,
    int? ReviewCount,
    string? MapsUrl);

public class ReceiveLeadSearchResultsCommandValidator : AbstractValidator<ReceiveLeadSearchResultsCommand>
{
    public const int MaxBatch = 500;

    public ReceiveLeadSearchResultsCommandValidator()
    {
        RuleFor(x => x.LeadSearchId).NotEmpty();
        RuleFor(x => x.Leads)
            .NotNull()
            .Must(leads => leads.Count <= MaxBatch).WithMessage($"Envie no máximo {MaxBatch} leads por lote.");
    }
}
