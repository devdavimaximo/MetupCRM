using Metup.Application.Deals.Common;
using Metup.Domain.Deals;
using MediatR;

namespace Metup.Application.Deals.Commands.ChangeDealStage;

/// <remarks>
/// Só move estágios ativos do funil (Prospect…Negociação). Fechar como ganho ou perdido é
/// responsabilidade do CloseDealCommand, que também exige o valor fechado.
/// </remarks>
/// <param name="ExpectedFromStage">
/// Etapa em que o client viu o negócio. Se o negócio já saiu dela (outro usuário moveu ou fechou),
/// nada muda e o caso de uso responde conflito com o estado atual. Omitido = sem checagem.
/// </param>
public record ChangeDealStageCommand(Guid Id, DealStage Stage, DealStage? ExpectedFromStage = null) : IRequest<DealDto>;
