import type { TaskStatus } from "./api"

export const taskStatusLabels: Record<TaskStatus, string> = {
  Pendente: "Pendente",
  Concluida: "Concluída",
  Cancelada: "Cancelada",
}
