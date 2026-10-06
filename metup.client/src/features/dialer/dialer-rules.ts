import type { ActivityOutcome, ActivityType } from "@/features/activities/api"
import { ALL_OUTCOMES } from "@/features/activities/activity-labels"
import type { DealStage, LostReason } from "@/features/deals/api"
import { ACTIVE_STAGES } from "@/features/deals/stage-labels"

/**
 * Sugestões do discador a partir do desfecho. São só o valor inicial dos campos — o SDR confirma
 * ou troca antes de salvar. Nada aqui roda sozinho: cadência automática é do n8n (V2).
 */

/** Tecla de cada desfecho, na ordem dos chips (1–7). */
export const OUTCOME_KEYS = Object.fromEntries(ALL_OUTCOMES.map((outcome, index) => [String(index + 1), outcome])) as Record<
  string,
  ActivityOutcome
>

export function outcomeKey(outcome: ActivityOutcome): string {
  return String(ALL_OUTCOMES.indexOf(outcome) + 1)
}

/** Alguém atendeu do outro lado — a "taxa de atendimento" da sessão. */
export const ANSWERED_OUTCOMES: ReadonlySet<ActivityOutcome> = new Set([
  "Atendeu",
  "PediuRetorno",
  "SemInteresse",
  "Interessado",
  "ReuniaoAgendada",
])

export type FollowUpKind = "next" | "lost" | "none"

export type FollowUp =
  | { kind: "next"; type: ActivityType; due: Date }
  | { kind: "lost"; reason: LostReason; note: string | null }
  | { kind: "none" }

const FOLLOW_UP_HOUR = 10

/** Próximo dia útil (seg–sex) às `hour`, contando `businessDays` a partir de `from`. */
export function businessDaysFrom(from: Date, businessDays: number, hour = FOLLOW_UP_HOUR): Date {
  const date = new Date(from)
  let remaining = businessDays
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) remaining--
  }
  date.setHours(hour, 0, 0, 0)
  return date
}

export function suggestedFollowUp(outcome: ActivityOutcome, now: Date): FollowUp {
  switch (outcome) {
    case "NaoAtendeu":
    case "PediuRetorno":
    case "Interessado":
      return { kind: "next", type: "Call", due: businessDaysFrom(now, 1) }
    case "Atendeu":
      return { kind: "next", type: "WhatsApp", due: businessDaysFrom(now, 1) }
    case "ReuniaoAgendada":
      return { kind: "next", type: "Meeting", due: businessDaysFrom(now, 1) }
    case "SemInteresse":
      return { kind: "lost", reason: "SemInteresse", note: null }
    case "NumeroInvalido":
      return { kind: "lost", reason: "Outro", note: "Número inválido" }
  }
}

/** Onde o desfecho põe o negócio no funil. */
const OUTCOME_STAGE: Record<ActivityOutcome, DealStage> = {
  NaoAtendeu: "PrimeiroContato",
  NumeroInvalido: "PrimeiroContato",
  Atendeu: "ContatoRealizado",
  PediuRetorno: "ContatoRealizado",
  SemInteresse: "ContatoRealizado",
  Interessado: "Qualificacao",
  ReuniaoAgendada: "Reuniao",
}

/** O estágio sugerido, só para frente — uma ligação nunca faz o negócio voltar. Nulo = fica onde está. */
export function suggestedStage(current: DealStage, outcome: ActivityOutcome): DealStage | null {
  const target = OUTCOME_STAGE[outcome]
  const from = ACTIVE_STAGES.indexOf(current)
  if (from < 0) return null
  return ACTIVE_STAGES.indexOf(target) > from ? target : null
}

/** Pula para o fim da fila; desfeito sai da fila. A ordem do resto não muda. */
export function sessionOrder<T extends { dealId: string }>(items: T[], skipped: string[], done: ReadonlySet<string>): T[] {
  const pending = items.filter((item) => !done.has(item.dealId))
  const skippedSet = new Set(skipped)
  const fresh = pending.filter((item) => !skippedSet.has(item.dealId))
  const byId = new Map(pending.map((item) => [item.dealId, item]))
  const later = skipped.map((id) => byId.get(id)).filter((item): item is T => item !== undefined)
  return [...fresh, ...later]
}
