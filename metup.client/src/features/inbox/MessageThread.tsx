import { type FormEvent, Fragment, useEffect, useRef, useState } from "react"
import { Loader2, SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toMessage } from "@/features/companies/form-errors"
import { sendMessage, type Message } from "./api"

const MAX_LENGTH = 4096

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" })

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return "Hoje"
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Ontem"
  return dayFormatter.format(date).replace(/\./g, "")
}

type Props = {
  conversationId: string
  messages: Message[]
  isLoading: boolean
  error: string | null
  onMessageSent: (message: Message) => void
}

/** Thread da conversa — inbound à esquerda, outbound (quem o time mandou) à direita, agrupado por dia. */
export function MessageThread({ conversationId, messages, isLoading, error, onMessageSent }: Props) {
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return

    setIsSending(true)
    setSendError(null)

    try {
      const sent = await sendMessage(conversationId, body.trim())
      onMessageSent(sent)
      setBody("")
    } catch (err) {
      setSendError(toMessage(err, "Não foi possível enviar a mensagem."))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8" aria-live="polite">
        {isLoading && (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Carregando mensagens…</span>
            <Skeleton className="h-10 w-2/5" />
            <Skeleton className="h-14 w-1/2 self-end" />
            <Skeleton className="h-10 w-1/3" />
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        {!isLoading && !error && messages.length === 0 && (
          <EmptyState compact title="Nenhuma mensagem ainda" description="Escreva abaixo para iniciar a conversa." className="flex-1" />
        )}

        {!isLoading &&
          messages.map((message, index) => {
            const isOutbound = message.direction === "Outbound"
            const showDay = index === 0 || dayKey(messages[index - 1].occurredAt) !== dayKey(message.occurredAt)
            return (
              <Fragment key={message.id}>
                {showDay && (
                  <div className="my-3 flex items-center gap-3" role="separator" aria-label={dayLabel(message.occurredAt)}>
                    <span className="h-px flex-1 bg-line-soft" />
                    <span className="label-mono text-faint">{dayLabel(message.occurredAt)}</span>
                    <span className="h-px flex-1 bg-line-soft" />
                  </div>
                )}
                <div className={cn("flex flex-col gap-1", isOutbound ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[min(34rem,85%)] rounded-sm border px-3.5 py-2.5 text-base whitespace-pre-wrap text-fg",
                      isOutbound ? "rounded-br-xs border-accent/25 bg-accent/10" : "rounded-bl-xs border-line-soft bg-surface-2"
                    )}
                  >
                    {message.body}
                  </div>
                  <p className="px-1 text-xs text-faint">
                    {isOutbound && message.authorUserName ? `${message.authorUserName} · ` : ""}
                    <span className="tabular">{timeFormatter.format(new Date(message.occurredAt))}</span>
                  </p>
                </div>
              </Fragment>
            )
          })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-line-soft px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={1}
            placeholder="Escreva uma mensagem…"
            aria-label="Mensagem"
            className="max-h-40 min-h-10 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button type="submit" disabled={isSending || !body.trim()} size="icon" className="size-10" aria-label="Enviar mensagem">
            {isSending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 hidden text-xs text-faint sm:block">
          <kbd className="font-mono">Enter</kbd> envia · <kbd className="font-mono">Shift + Enter</kbd> quebra linha
        </p>
        {sendError && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {sendError}
          </p>
        )}
      </form>
    </div>
  )
}
