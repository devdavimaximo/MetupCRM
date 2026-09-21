/**
 * Navegação do quadro por setas (item 22), fora do arrasto: ↑/↓ andam na coluna, ←/→ vão para a
 * coluna vizinha **que tem cartão**, na mesma altura (ou na última linha, se a vizinha for mais
 * curta). O que conta é o que está na tela: a grade vem do DOM, coluna por coluna, na ordem visual.
 *
 * Durante o arrasto por teclado as setas são do dnd-kit (mudar de coluna); quem chama não repassa.
 */

/** Ids dos cartões por coluna, na ordem da tela. */
export type FocusGrid = string[][]

export type BoardArrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"

export const isBoardArrow = (key: string): key is BoardArrow =>
  key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight"

/** O próximo cartão a focar, ou `null` quando a seta bate na borda do quadro. */
export function nextFocus(grid: FocusGrid, currentId: string, key: BoardArrow): string | null {
  const col = grid.findIndex((ids) => ids.includes(currentId))
  if (col === -1) return grid.find((ids) => ids.length > 0)?.[0] ?? null
  const row = grid[col].indexOf(currentId)

  if (key === "ArrowUp") return row > 0 ? grid[col][row - 1] : null
  if (key === "ArrowDown") return row < grid[col].length - 1 ? grid[col][row + 1] : null

  const step = key === "ArrowRight" ? 1 : -1
  for (let next = col + step; next >= 0 && next < grid.length; next += step) {
    const ids = grid[next]
    if (ids.length > 0) return ids[Math.min(row, ids.length - 1)]
  }
  return null
}

/** O cartão que recebe o Tab ao entrar no quadro: o último focado, se ainda está na tela; senão o primeiro. */
export function tabStopOf(grid: FocusGrid, lastFocusedId: string | null): string | null {
  if (lastFocusedId && grid.some((ids) => ids.includes(lastFocusedId))) return lastFocusedId
  return grid.find((ids) => ids.length > 0)?.[0] ?? null
}
