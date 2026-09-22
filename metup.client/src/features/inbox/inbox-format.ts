import type { ConversationChannel, ConversationStatus, MessageAttachmentKind } from "./api"

export const channelLabels: Record<ConversationChannel, string> = {
  WhatsApp: "WhatsApp",
}

export const CHANNEL_OPTIONS: ConversationChannel[] = ["WhatsApp"]

export const statusLabels: Record<ConversationStatus, string> = {
  Aberta: "Aberta",
  Pendente: "Pendente",
  Resolvida: "Resolvida",
}

export const STATUS_OPTIONS: ConversationStatus[] = ["Aberta", "Pendente", "Resolvida"]

export const statusBadgeVariant: Record<ConversationStatus, "accent" | "default" | "success"> = {
  Aberta: "accent",
  Pendente: "default",
  Resolvida: "success",
}

/** `tel:` só com dígitos e o `+` inicial — sem telefonia própria, só abre o discador do sistema. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

export const attachmentKindLabels: Record<MessageAttachmentKind, string> = {
  Image: "Imagem",
  Video: "Vídeo",
  Document: "Documento",
  Audio: "Áudio",
}

/** "2h 18min" · "45min" · "Sem dados suficientes" quando ainda não há par inbound→outbound. */
export function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return "Sem dados suficientes"
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}min`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

/** "2,4 MB" · "850 KB" — bytes sempre com uma casa decimal em MB, sem casa em KB. */
export function formatAttachmentSize(bytes: number | null): string | null {
  if (bytes === null) return null
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1).replace(".", ",")} MB`
}
