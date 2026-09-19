/** Acima disso a lista de responsáveis ganha busca — até 8 nomes, bater o olho é mais rápido que digitar. */
export const SEARCH_THRESHOLD = 8

/** Foco ao abrir o popover: sem busca, na opção escolhida (ou na primeira), e as setas já funcionam. */
export function focusOwnerListbox(event: Event, userCount: number) {
  if (userCount > SEARCH_THRESHOLD) return
  event.preventDefault()
  const content = event.currentTarget as HTMLElement
  const target = content.querySelector<HTMLElement>("[aria-selected=true]") ?? content.querySelector<HTMLElement>("[role=option]")
  requestAnimationFrame(() => target?.focus())
}
