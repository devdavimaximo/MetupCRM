using System.Diagnostics;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Metup.Application.Common.Behaviors;

/// <summary>
/// Duração de cada caso de uso. Existe para responder "isto está lento?" com número em vez de
/// impressão — é o que sustenta a decisão de otimizar (item 22 do plano do dashboard), e o que
/// avisa quando uma organização cresce o bastante para a agregação atual deixar de servir.
///
/// O log traz o nome da requisição e, quando ela os expõe, o período e o escopo pedidos — nunca o
/// conteúdo do pedido, que pode carregar dado pessoal (seção 10 do CLAUDE.md).
/// </summary>
public class PerformanceBehavior<TRequest, TResponse>(ILogger<PerformanceBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    /// <summary>Acima disto o caso de uso vira aviso: é o limiar do que um humano percebe como espera.</summary>
    public const int SlowRequestMilliseconds = 500;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var response = await next(cancellationToken);
        stopwatch.Stop();

        var elapsed = stopwatch.ElapsedMilliseconds;
        var name = typeof(TRequest).Name;

        if (elapsed >= SlowRequestMilliseconds)
        {
            logger.LogWarning("{Request} levou {Elapsed}ms ({Dimensions})", name, elapsed, Dimensions(request));
        }
        else
        {
            logger.LogDebug("{Request} levou {Elapsed}ms ({Dimensions})", name, elapsed, Dimensions(request));
        }

        return response;
    }

    /// <summary>
    /// As duas dimensões que explicam a duração de uma consulta do dashboard. Lidas por reflexão
    /// para o comportamento continuar genérico — nenhuma requisição precisa saber que ele existe.
    /// </summary>
    private static string Dimensions(TRequest request)
    {
        var type = typeof(TRequest);
        var days = type.GetProperty("Days")?.GetValue(request);
        var scope = type.GetProperty("Scope")?.GetValue(request);

        return (days, scope) switch
        {
            (null, null) => "sem dimensões",
            (not null, null) => $"days={days}",
            (null, not null) => $"scope={scope}",
            _ => $"days={days}, scope={scope}",
        };
    }
}
