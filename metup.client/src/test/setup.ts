import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/**
 * O jsdom não implementa o que os componentes do Radix e os gráficos pedem ao navegador.
 * Sem estes remendos, abrir um popover ou montar um gráfico quebra antes da asserção.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

globalThis.IntersectionObserver ??= class {
  readonly root = null
  readonly rootMargin = ""
  readonly thresholds: readonly number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
} as unknown as typeof IntersectionObserver

Element.prototype.scrollTo ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
// O Radix usa os ponteiros para decidir foco e fechamento; o jsdom não tem captura de ponteiro.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}

/** Teste unitário não fala com a rede: a chamada esquecida falha na hora, com o motivo claro. */
globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
  throw new Error(`O teste tentou acessar a rede (${String(input)}). Use um dublê para esta chamada.`)
}) as unknown as typeof fetch
