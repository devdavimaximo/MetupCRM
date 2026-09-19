/**
 * Clique na caixa de uma linha. Com Shift e uma âncora na página, aplica a todo o intervalo
 * âncora→linha o **novo** estado da linha clicada (marcar ou desmarcar), como em listas de e-mail.
 * Sem âncora válida, alterna só a linha.
 */
export function toggleSelection(
  current: ReadonlySet<string>,
  pageIds: readonly string[],
  id: string,
  anchorId: string | null,
  shift: boolean
): Set<string> {
  const next = new Set(current)
  const select = !current.has(id)
  const from = anchorId === null ? -1 : pageIds.indexOf(anchorId)
  const to = pageIds.indexOf(id)

  const range = shift && from !== -1 && to !== -1 ? pageIds.slice(Math.min(from, to), Math.max(from, to) + 1) : [id]

  for (const rowId of range) {
    if (select) next.add(rowId)
    else next.delete(rowId)
  }
  return next
}
