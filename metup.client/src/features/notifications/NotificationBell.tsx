import { useCallback, useEffect, useRef, useState } from "react"
import { AlarmClock, Bell, CircleAlert, MessageCircleWarning, PauseCircle, RotateCw, type LucideIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { activityTypeLabels } from "@/features/activities/activity-labels"
import { toMessage } from "@/features/companies/form-errors"
import { numberFormatter } from "@/lib/format"
import { useRealtime } from "@/lib/realtime"
import { cn } from "@/lib/utils"
import { listNotifications, type AppNotification, type NotificationKind } from "./api"

/** As notificações dependem do relógio (vencer em 60 min, atrasar): revalida sozinha a cada minuto. */
const POLL_MS = 60_000
const REALTIME_DEBOUNCE_MS = 2_000

const kindIcons: Record<NotificationKind, LucideIcon> = {
  TaskDueSoon: AlarmClock,
  TaskOverdue: CircleAlert,
  DealStalledToday: PauseCircle,
  ConversationAwaitingReply: MessageCircleWarning,
}

function minutesBetween(from: number, to: number) {
  return Math.max(0, Math.round((to - from) / 60_000))
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${numberFormatter.format(minutes)} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${numberFormatter.format(hours)} h`
  const days = Math.round(hours / 24)
  return `${numberFormatter.format(days)} ${days === 1 ? "dia" : "dias"}`
}

/** A frase em pt-BR sai do tipo: o servidor manda só dados. */
function describeNotification(notification: AppNotification, now = Date.now()) {
  const task = notification.taskType ? activityTypeLabels[notification.taskType] : "Tarefa"
  const due = notification.dueAt ? new Date(notification.dueAt).getTime() : now
  switch (notification.kind) {
    case "TaskDueSoon":
      return { title: `${task} com ${notification.title}`, detail: `vence em ${durationLabel(minutesBetween(now, due))}` }
    case "TaskOverdue":
      return { title: `${task} com ${notification.title}`, detail: `atrasada há ${durationLabel(minutesBetween(due, now))}` }
    case "DealStalledToday":
      return {
        title: `${notification.title} ficou parado`,
        detail: `mais de ${notification.stalledDealDays ?? "—"} dias sem mudar de etapa`,
      }
    case "ConversationAwaitingReply":
      return { title: `${notification.title} aguarda resposta`, detail: `há ${durationLabel(minutesBetween(due, now))} no WhatsApp` }
  }
}

function seenKey(userId: string) {
  return `metup.notifications.seen.${userId}`
}

function readSeen(userId: string): number {
  try {
    return Number(localStorage.getItem(seenKey(userId))) || 0
  } catch {
    return 0
  }
}

/**
 * Sino com as notificações derivadas. "Lida" é só deste navegador: abrir o sino grava o instante, e o
 * contador mostra o que passou a valer depois disso. Atualiza ao receber evento em tempo real (com
 * espera de 2s), ao voltar o foco e a cada minuto.
 */
export function NotificationBell({
  userId,
  onOpenDeal,
  onOpenConversation,
}: {
  userId: string
  onOpenDeal: (dealId: string) => void
  onOpenConversation: (conversationId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seenAt, setSeenAt] = useState(() => readSeen(userId))
  // O que era novo no momento de abrir continua marcado enquanto o sino estiver aberto.
  const [seenBeforeOpen, setSeenBeforeOpen] = useState(seenAt)
  const request = useRef<AbortController | null>(null)
  const debounce = useRef<number | undefined>(undefined)

  const load = useCallback(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    listNotifications(controller.signal)
      .then((data) => {
        setItems(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(toMessage(err, "Não foi possível carregar as notificações."))
      })
  }, [])

  useEffect(() => {
    const first = window.setTimeout(load, 0)
    const poll = window.setInterval(load, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(poll)
      window.clearTimeout(debounce.current)
      document.removeEventListener("visibilitychange", onVisible)
      request.current?.abort()
    }
  }, [load])

  useRealtime(() => {
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(load, REALTIME_DEBOUNCE_MS)
  })

  const unread = (items ?? []).filter((item) => new Date(item.occurredAt).getTime() > seenAt).length

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    const now = Date.now()
    setSeenBeforeOpen(seenAt)
    setSeenAt(now)
    try {
      localStorage.setItem(seenKey(userId), String(now))
    } catch {
      /* sem storage, a leitura só não persiste entre recargas */
    }
    load()
  }

  function select(item: AppNotification) {
    setOpen(false)
    if (item.kind === "ConversationAwaitingReply" && item.conversationId) onOpenConversation(item.conversationId)
    else if (item.dealId) onOpenDeal(item.dealId)
  }

  const label = unread > 0 ? `Notificações: ${unread} ${unread === 1 ? "nova" : "novas"}` : "Notificações"

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-line-soft bg-surface-2/90 text-fg-muted shadow-raised backdrop-blur-sm transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring data-[state=open]:text-fg"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              data-testid="notification-count"
              className="absolute -top-1.5 -right-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-on-accent tabular"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] p-0" aria-label="Notificações">
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-sm font-medium text-fg">Notificações</h2>
          {items && <span className="text-xs text-muted tabular">{items.length}</span>}
        </header>

        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-fg">
              <span>{error}</span>
              <button
                type="button"
                onClick={load}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xs text-accent hover:text-accent-hover focus-visible:focus-ring"
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
                Tentar de novo
              </button>
            </div>
          )}
          {!items && !error && <p className="px-4 py-6 text-center text-sm text-muted">Carregando…</p>}
          {items && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nada pendente por aqui.</p>}
          {items && items.length > 0 && (
            <ul className="flex flex-col divide-y divide-line-soft/70">
              {items.map((item) => {
                const Icon = kindIcons[item.kind]
                const { title, detail } = describeNotification(item)
                const isNew = new Date(item.occurredAt).getTime() > seenBeforeOpen
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => select(item)}
                      className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-3/50 focus-visible:bg-surface-3/50 focus-visible:outline-none"
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          item.severity === "Critical" ? "text-danger" : item.severity === "Warning" ? "text-accent" : "text-muted"
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-fg">{title}</span>
                        <span className="truncate text-xs text-muted">{detail}</span>
                      </span>
                      {isNew && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent">
                          <span className="sr-only">nova</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
