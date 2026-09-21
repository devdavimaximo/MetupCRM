import { KPI_IDS, type KpiId } from "./pipeline-metrics"

const STORAGE_KEY = "metup.pipeline.hiddenKpis"

/**
 * Quais KPIs o usuário ocultou pelo `×`. É conveniência local (decisão 1 da PL3): fica no
 * `localStorage` deste navegador, nunca no servidor. Toda leitura e escrita é protegida — em aba
 * anônima, com armazenamento bloqueado ou com o valor corrompido, a página funciona como se nada
 * estivesse oculto.
 */
export function readHiddenKpis(storage: Storage | undefined = safeStorage()): KpiId[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return KPI_IDS.filter((id) => parsed.includes(id))
  } catch {
    return []
  }
}

/** Grava a preferência. Falhar aqui não pode quebrar a tela: o estado em memória já mudou. */
export function writeHiddenKpis(hidden: readonly KpiId[], storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...hidden]))
  } catch {
    // Armazenamento indisponível ou cheio: a escolha vale só nesta sessão.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
