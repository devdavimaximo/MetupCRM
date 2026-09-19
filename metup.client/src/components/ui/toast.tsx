import { useEffect, useRef, useState } from "react"
import { CircleAlert, X } from "lucide-react"

import type { Toast } from "@/lib/toasts"
import { cn } from "@/lib/utils"

/**
 * Pilha de avisos no rodapé da tela. Cada aviso some sozinho (padrão 5 s), com o tempo pausado
 * enquanto o ponteiro ou o foco estão nele — dá para chegar ao "Desfazer" com calma. Anunciado por
 * `aria-live` sem mover o foco.
 */
export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <section
      aria-label="Avisos"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center gap-2 px-4 max-md:bottom-20"
    >
      <ol aria-live="polite" className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </ol>
    </section>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.durationMs)
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (paused) return
    const startedAt = Date.now()
    const timer = window.setTimeout(() => dismissRef.current(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt))
    }
  }, [paused])

  const danger = toast.tone === "danger"

  return (
    <li
      role={danger ? "alert" : "status"}
      data-toast
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
      className={cn(
        "pointer-events-auto flex min-h-12 items-center gap-3 rounded-md border bg-surface-2 py-2 pr-2 pl-4 text-sm text-fg shadow-panel",
        "animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none",
        danger ? "border-danger/50" : "border-line-strong/60"
      )}
    >
      {danger && <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />}
      <p className="min-w-0 flex-1">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction()
            onDismiss()
          }}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-sm px-3 font-medium text-accent transition-colors hover:bg-surface-3 focus-visible:focus-ring"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={onDismiss}
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  )
}
