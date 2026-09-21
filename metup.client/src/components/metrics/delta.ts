/**
 * O que dá para dizer da variação contra a janela anterior. Percentual só quando existe base real;
 * nos demais casos o cartão diz por que não há comparação, em vez de um "sem base anterior" mudo.
 */
export type Delta =
  | { kind: "change"; direction: "up" | "down" | "flat"; label: string }
  | { kind: "new" }
  | { kind: "idle" }
  | { kind: "no-history" }
  /** A fonte não tem a janela anterior (resumo de tarefas com `previous = null`). */
  | { kind: "no-base" }

/**
 * O que "subir" significa para o número. Receita subir é bom; atrasadas subir é ruim; volume de
 * tarefas do dia não é bom nem ruim — a seta continua, a cor fica neutra.
 */
export type DeltaPolarity = "higher-is-better" | "higher-is-worse" | "neutral"

export type DeltaTone = "positive" | "negative" | "neutral"

export function deltaTone(direction: "up" | "down" | "flat", polarity: DeltaPolarity = "higher-is-better"): DeltaTone {
  if (direction === "flat" || polarity === "neutral") return "neutral"
  const good = polarity === "higher-is-better" ? direction === "up" : direction === "down"
  return good ? "positive" : "negative"
}
