import { toMessage } from "@/features/companies/form-errors"
import { useAsyncResource } from "@/lib/hooks"
import type { PeriodRequest } from "@/lib/period"

/**
 * Carrega um relatório do período pedido. Trocar de período mantém os números antigos na tela
 * (esmaecidos) até os novos chegarem — piscar um skeleton a cada ajuste de filtro faria a tela
 * parecer mais lenta do que é. A busca anterior é cancelada, então cliques em sequência não se
 * atropelam.
 */
export function useReport<T>(
  fetcher: (request: PeriodRequest, signal: AbortSignal) => Promise<T>,
  request: PeriodRequest,
  errorMessage: string,
  /** O que mais muda a busca além do período — o eixo da aba de desempenho, por exemplo. */
  variant = ""
) {
  const periodKey = "days" in request ? `d:${request.days}` : `r:${request.from}:${request.to}`
  const requestKey = `${variant}|${periodKey}`

  // `request` é um objeto novo a cada render; quem decide refazer a busca é a chave do período.
  const resource = useAsyncResource((signal) => fetcher(request, signal), [requestKey], { keepPreviousData: true })

  return {
    report: resource.data,
    isLoading: resource.isLoading,
    error: resource.error ? toMessage(resource.error, errorMessage) : null,
    retry: resource.reload,
  }
}
