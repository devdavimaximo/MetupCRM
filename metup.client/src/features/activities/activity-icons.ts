import { FileText, MessageCircle, Phone, StickyNote, Users, type LucideIcon } from "lucide-react"

import type { ActivityType } from "./api"

/** Um ícone por tipo de atividade — o mesmo em timeline, tarefas e dashboard. */
export const activityTypeIcons: Record<ActivityType, LucideIcon> = {
  Call: Phone,
  WhatsApp: MessageCircle,
  Meeting: Users,
  Proposal: FileText,
  Note: StickyNote,
}
