import type { ActivityType } from "@/features/activities/api"
import type { TaskItem, TaskStatus } from "./api"

export const taskStatusLabels: Record<TaskStatus, string> = {
  Pendente: "Pendente",
  Concluida: "Concluída",
  Cancelada: "Cancelada",
}

/** `Record` por tipo: um `ActivityType` novo sem verbo não compila. */
const taskTitlePrefixes: Record<ActivityType, string> = {
  Call: "Ligar para",
  WhatsApp: "Enviar WhatsApp para",
  Meeting: "Reunião com",
  Proposal: "Enviar proposta para",
  Note: "Nota sobre",
}

/** Título da tarefa, derivado do tipo e da empresa ("Ligar para Padaria Aurora"). Não existe `Title` no domínio. */
export function taskTitle(task: Pick<TaskItem, "type" | "companyName">): string {
  return `${taskTitlePrefixes[task.type]} ${task.companyName}`
}
