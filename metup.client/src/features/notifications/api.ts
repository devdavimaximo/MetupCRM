import { apiFetch } from "@/lib/api"
import type { ActivityType } from "@/features/activities/api"

export type NotificationKind = "TaskDueSoon" | "TaskOverdue" | "DealStalledToday" | "ConversationAwaitingReply"
export type NotificationSeverity = "Info" | "Warning" | "Critical"

/**
 * Notificação derivada. `occurredAt` é quando ela passou a valer (é o que conta como "nova");
 * `dueAt` é o prazo da tarefa ou a hora da última mensagem. `title` é a empresa (ou o contato).
 */
export type AppNotification = {
  id: string
  kind: NotificationKind
  severity: NotificationSeverity
  occurredAt: string
  dueAt: string | null
  title: string
  dealId: string | null
  taskId: string | null
  conversationId: string | null
  taskType: ActivityType | null
  stalledDealDays: number | null
}

export function listNotifications(signal?: AbortSignal) {
  return apiFetch<AppNotification[]>("/api/notifications", { signal })
}
