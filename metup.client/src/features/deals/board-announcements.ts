import type { DealStage } from "./api"
import { BOARD_COLUMN_COUNT } from "./board-state"
import { ACTIVE_STAGES, stageLabels } from "./stage-labels"

/**
 * Onde um cartão pode cair: uma etapa ativa, ou uma das zonas de Fechados (que abrem o diálogo de
 * fechamento em vez de mover).
 */
export type DropTarget = { kind: "stage"; stage: DealStage } | { kind: "close"; won: boolean }

/** Posição na tela, de 1 a 8 — Fechados é a oitava. */
export function targetPosition(target: DropTarget) {
  return target.kind === "stage" ? ACTIVE_STAGES.indexOf(target.stage) + 1 : BOARD_COLUMN_COUNT
}

export function targetLabel(target: DropTarget) {
  return target.kind === "stage" ? `Coluna ${stageLabels[target.stage]}` : `Fechados, zona ${target.won ? "Ganho" : "Perdido"}`
}

const where = (target: DropTarget) => `${targetLabel(target)}, ${targetPosition(target)} de ${BOARD_COLUMN_COUNT}.`

const sameTarget = (a: DropTarget, b: DropTarget) =>
  a.kind === "stage" && b.kind === "stage" ? a.stage === b.stage : a.kind === b.kind && a.kind === "close" && b.kind === "close" && a.won === b.won

/**
 * Frases em pt-br para o leitor de tela durante o arrasto (o `@dnd-kit` as põe numa região
 * `aria-live`). Ex.: "Negócio Tech Solutions pego. Coluna Qualificação, 4 de 8."
 */
export const boardAnnouncements = {
  pickup: (company: string, from: DropTarget) => `Negócio ${company} pego. ${where(from)}`,

  over: (target: DropTarget | null) =>
    target === null
      ? "Fora das colunas."
      : target.kind === "close"
        ? `${where(target)} Soltar abre a confirmação do fechamento.`
        : where(target),

  drop: (company: string, from: DropTarget, target: DropTarget | null) => {
    if (target === null || sameTarget(from, target)) return `Negócio ${company} solto na mesma coluna. Nada mudou.`
    if (target.kind === "close") return `Negócio ${company} solto em ${target.won ? "Ganho" : "Perdido"}. Confirme o fechamento.`
    return `Negócio ${company} movido para ${stageLabels[target.stage]}.`
  },

  cancel: (company: string, from: DropTarget) => `Movimento cancelado. Negócio ${company} continua na ${targetLabel(from)}.`,
}

/** Instruções lidas ao focar um cartão arrastável. */
export const boardScreenReaderInstructions =
  "Para mover o negócio de etapa, pressione Espaço. Use as setas para a esquerda e para a direita para trocar de coluna, Espaço para soltar e Esc para cancelar. Sem arrastar: abra o menu de ações e escolha Mover para."
