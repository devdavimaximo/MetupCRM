import type { ActivityOutcome, ActivityType } from "./api"

export const activityTypeLabels: Record<ActivityType, string> = {
  Call: "Ligação",
  WhatsApp: "WhatsApp",
  Meeting: "Reunião",
  Proposal: "Proposta",
  Note: "Nota",
}

/** Tipos que fazem sentido como próxima ação agendada — Note é registro, não ação futura. */
export const NEXT_ACTION_TYPES: ActivityType[] = ["Call", "WhatsApp", "Meeting", "Proposal"]

export const activityOutcomeLabels: Record<ActivityOutcome, string> = {
  Atendeu: "Atendeu",
  NaoAtendeu: "Não atendeu",
  NumeroInvalido: "Número inválido",
  PediuRetorno: "Pediu retorno",
  SemInteresse: "Sem interesse",
  Interessado: "Interessado",
  ReuniaoAgendada: "Reunião agendada",
}

export const ALL_OUTCOMES: ActivityOutcome[] = [
  "Atendeu",
  "NaoAtendeu",
  "NumeroInvalido",
  "PediuRetorno",
  "SemInteresse",
  "Interessado",
  "ReuniaoAgendada",
]
