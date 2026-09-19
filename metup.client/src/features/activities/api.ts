import { apiFetch } from "@/lib/api"
import type { TaskItem } from "@/features/tasks/api"

export type ActivityType = "Call" | "WhatsApp" | "Meeting" | "Proposal" | "Note"

export type ActivityOutcome =
  | "Atendeu"
  | "NaoAtendeu"
  | "NumeroInvalido"
  | "PediuRetorno"
  | "SemInteresse"
  | "Interessado"
  | "ReuniaoAgendada"

export type Activity = {
  id: string
  dealId: string
  contactId: string | null
  contactName: string | null
  type: ActivityType
  outcome: ActivityOutcome | null
  note: string | null
  authorUserId: string
  authorUserName: string
  occurredAt: string
  createdAt: string
}

export type LogActivityInput = {
  contactId: string | null
  type: ActivityType
  outcome: ActivityOutcome | null
  note: string | null
  occurredAt: string | null
  nextActionType: ActivityType | null
  nextActionDueDate: string | null
  nextActionNote: string | null
  /** Conclui a tarefa de origem na mesma transação (aditivo). */
  completesTaskId?: string
}

export type LogActivityResult = {
  activity: Activity
  nextAction: TaskItem | null
}

/** A organização e o autor nunca são enviados: o servidor os resolve pelo token. */
export function logActivity(dealId: string, input: LogActivityInput) {
  return apiFetch<LogActivityResult>(`/api/deals/${dealId}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function listActivitiesByDeal(dealId: string, signal?: AbortSignal) {
  return apiFetch<Activity[]>(`/api/deals/${dealId}/activities`, { signal })
}
