using Metup.Application.LeadFinder.Common;
using MediatR;

namespace Metup.Application.LeadFinder.Commands.ChangeLeadSearch;

public enum LeadSearchAction
{
    /// <summary>Parar de aceitar resultados. O n8n descobre no próximo lote (a resposta diz <c>Cancelled</c>).</summary>
    Cancel,

    /// <summary>Pedir de novo à automação a busca que falhou ou ficou sem resposta.</summary>
    Retry,
}

public record ChangeLeadSearchCommand(Guid LeadSearchId, LeadSearchAction Action) : IRequest<LeadSearchDto>;
