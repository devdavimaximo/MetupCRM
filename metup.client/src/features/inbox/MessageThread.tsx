import { type FormEvent, Fragment, useEffect, useRef, useState } from "react"
import { Bot, CheckCheck, Download, FileText, Loader2, Music, Paperclip, SendHorizontal, Smile } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { Textarea } from "@/components/ui/textarea"
import { Hint } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toMessage } from "@/features/companies/form-errors"
import { sendMessage, type Message, type MessageAttachment } from "./api"
import { attachmentKindLabels, formatAttachmentSize } from "./inbox-format"

const MAX_LENGTH = 4096

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" })

/** Grade curta de emojis comuns em atendimento — sem biblioteca nova (item 16). */
const EMOJIS = [
  "😀", "😄", "😁", "😊", "🙂", "😉", "😍", "🤩", "😘", "😅",
  "😂", "🤝", "👍", "👏", "🙏", "💪", "🎉", "✅", "❌", "⚠️",
  "❤️", "🔥", "⭐", "💡", "📌", "📅", "⏰", "📎", "💬", "👋",
  "🙌", "🤔", "😎", "🚀", "💰", "📈", "✍️", "😢", "😱", "🤗",
]

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

/** Thread da conversa — inbound à esquerda, outbound (SDR ou automação) à direita, agrupado por dia. */
export function MessageThread({ conversationId, messages, isLoading, error, onMessageSent }: Props) {
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setBody((current) => current + emoji)
      return
    }
    const start = textarea.selectionStart ?? body.length
    const end = textarea.selectionEnd ?? body.length
    const next = body.slice(0, start) + emoji + body.slice(end)
    setBody(next.slice(0, MAX_LENGTH))
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + emoji.length
      textarea.setSelectionRange(cursor, cursor)
    })
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
                <MessageBubble message={message} />
              </Fragment>
            )
          })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-line-soft px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex items-end gap-1.5">
          <Hint content="Enviar anexo ainda depende de um destino de upload definido com o sócio.">
            <span tabIndex={0} className="inline-flex rounded-xs focus-visible:focus-ring">
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" disabled aria-label="Anexar arquivo (em breve)">
                <Paperclip aria-hidden="true" />
              </Button>
            </span>
          </Hint>

          <Textarea
            ref={textareaRef}
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

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Inserir emoji">
                <Smile aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="grid w-64 grid-cols-8 gap-0.5 p-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  aria-label={`Inserir ${emoji}`}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-xs text-lg transition-colors hover:bg-surface-3 focus-visible:focus-ring"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button type="submit" disabled={isSending || !body.trim()} size="icon" className="size-10 shrink-0" aria-label="Enviar mensagem">
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

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "Outbound"
  const isBot = message.authorKind === "Bot"
  const authorLabel = isBot ? "Assistente Metup" : message.authorUserName

  return (
    <div className={cn("flex flex-col gap-1", isOutbound ? "items-end" : "items-start")}>
      {message.body && (
        <div
          className={cn(
            "max-w-[min(34rem,85%)] rounded-sm border px-3.5 py-2.5 text-base whitespace-pre-wrap text-fg",
            isOutbound
              ? isBot
                ? "rounded-br-xs border-line-strong/40 bg-surface-3"
                : "rounded-br-xs border-accent/25 bg-accent/10"
              : "rounded-bl-xs border-line-soft bg-surface-2"
          )}
        >
          {message.body}
        </div>
      )}

      {message.attachments.map((attachment, index) => (
        <MessageAttachmentCard key={index} attachment={attachment} />
      ))}

      <p className="flex items-center gap-1 px-1 text-xs text-faint">
        {isOutbound && isBot && <Bot className="size-3" aria-hidden="true" />}
        {isOutbound && authorLabel ? `${authorLabel} · ` : ""}
        <span className="tabular">{timeFormatter.format(new Date(message.occurredAt))}</span>
        {isOutbound && (
          <span title="Enviado ao WhatsApp" className="inline-flex">
            <CheckCheck className="size-3.5 text-accent" aria-hidden="true" />
            <span className="sr-only">Enviado ao WhatsApp</span>
          </span>
        )}
      </p>
    </div>
  )
}

function MessageAttachmentCard({ attachment }: { attachment: MessageAttachment }) {
  if (attachment.kind === "Image") {
    return (
      <div className="max-w-[min(22rem,85%)] overflow-hidden rounded-sm border border-line-soft">
        <img
          src={attachment.url}
          alt={attachment.fileName ?? "Imagem enviada na conversa"}
          loading="lazy"
          className="max-h-72 w-full object-cover"
        />
      </div>
    )
  }

  if (attachment.kind === "Video") {
    return (
      <div className="max-w-[min(22rem,85%)] overflow-hidden rounded-sm border border-line-soft">
        <video controls preload="metadata" src={attachment.url} className="max-h-72 w-full bg-black" />
      </div>
    )
  }

  const size = formatAttachmentSize(attachment.sizeBytes)
  const Icon = attachment.kind === "Audio" ? Music : FileText

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      download={attachment.fileName ?? undefined}
      className="flex max-w-[min(22rem,85%)] items-center gap-2.5 rounded-sm border border-line-soft bg-surface px-3 py-2.5 text-sm text-fg transition-colors hover:border-line-strong focus-visible:focus-ring"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xs bg-surface-2 text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{attachment.fileName ?? attachmentKindLabels[attachment.kind]}</span>
        {size && <span className="block text-xs text-muted">{size}</span>}
      </span>
      <Download className="size-4 shrink-0 text-muted" aria-hidden="true" />
    </a>
  )
}
