import { type FormEvent, useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toMessage } from "@/features/companies/form-errors"
import { sendMessage, type Message } from "./api"

const MAX_LENGTH = 4096

type Props = {
  conversationId: string
  contactName: string
  messages: Message[]
  isLoading: boolean
  error: string | null
  onMessageSent: (message: Message) => void
}

/** Thread da conversa — bolhas inbound à esquerda, outbound à direita (quem o SDR mandou). */
export function MessageThread({ conversationId, contactName, messages, isLoading, error, onMessageSent }: Props) {
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
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold text-foreground">{contactName}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading && (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Carregando…
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {!isLoading && !error && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa ainda.</p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex flex-col gap-0.5", message.direction === "Outbound" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                message.direction === "Outbound"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {message.body}
            </div>
            <p className="text-xs text-muted-foreground">
              {message.direction === "Outbound" && message.authorUserName ? `${message.authorUserName} · ` : ""}
              {new Date(message.occurredAt).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:px-6">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder="Escreva uma mensagem…"
            aria-label="Mensagem"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button type="submit" disabled={isSending || !body.trim()} size="icon" aria-label="Enviar mensagem">
            {isSending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          </Button>
        </div>
        {sendError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {sendError}
          </p>
        )}
      </form>
    </div>
  )
}
