using MediatR;

namespace Metup.Application.LeadFinder.Commands.ImportFoundLeads;

/// <param name="OwnerUserId">Responsável pelos negócios. Nulo = quem importa; outra pessoa exige alcance da equipe.</param>
/// <param name="ScheduleCall">Cria uma ligação para hoje em cada negócio — o lead já cai na fila do "hoje".</param>
public record ImportFoundLeadsCommand(IReadOnlyList<Guid> Ids, Guid? OwnerUserId, bool ScheduleCall) : IRequest<ImportFoundLeadsResult>;

/// <param name="Imported">Leads que viraram negócio (novo ou já aberto na empresa existente).</param>
/// <param name="Skipped">Já importados, inexistentes ou de outra organização.</param>
public record ImportFoundLeadsResult(int Imported, int Skipped, IReadOnlyList<Guid> DealIds);
