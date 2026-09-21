/** Quantos cartões cabem numa "página" do carrossel de KPIs no celular. */
export const CAROUSEL_PER_PAGE = 2

export const carouselPageCount = (total: number) => Math.max(1, Math.ceil(total / CAROUSEL_PER_PAGE))

/** A página em que a trilha está, pela rolagem (arredonda para a mais próxima, dentro dos limites). */
export function carouselPageAt(scrollLeft: number, width: number, pages: number) {
  if (width <= 0) return 0
  return Math.max(0, Math.min(pages - 1, Math.round(scrollLeft / width)))
}

/** "Indicadores 3 e 4 de 5" — lido pelo leitor de tela e usado no rótulo de cada ponto. */
export function carouselRangeLabel(page: number, total: number) {
  const first = page * CAROUSEL_PER_PAGE + 1
  const last = Math.min(total, first + CAROUSEL_PER_PAGE - 1)
  return first === last ? `Indicador ${first} de ${total}` : `Indicadores ${first} e ${last} de ${total}`
}
