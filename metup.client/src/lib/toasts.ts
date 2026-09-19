import { useCallback, useRef, useState } from "react"

export type ToastTone = "neutral" | "danger"

export type ToastInput = {
  message: string
  tone?: ToastTone
  /** Uma ação só ("Desfazer"). Ao ser usada, o aviso some. */
  action?: { label: string; onAction: () => void }
  /** Tempo na tela; pausa enquanto o ponteiro ou o foco estão no aviso. */
  durationMs?: number
}

export type Toast = Required<Omit<ToastInput, "action">> & Pick<ToastInput, "action"> & { id: number }

/** Mais do que isso empilhado vira ruído: o aviso mais antigo sai. */
const MAX_VISIBLE = 3

/**
 * Fila de avisos curtos de uma tela (o `Toaster` mostra). Não rouba foco e não bloqueia nada: é
 * confirmação e desfazer, nunca a única forma de saber de um erro que exige decisão.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), [])

  const show = useCallback((input: ToastInput) => {
    const toast: Toast = {
      id: nextId.current++,
      message: input.message,
      tone: input.tone ?? "neutral",
      action: input.action,
      durationMs: input.durationMs ?? 5000,
    }
    setToasts((current) => [...current, toast].slice(-MAX_VISIBLE))
    return toast.id
  }, [])

  return { toasts, show, dismiss }
}

export type ToastQueue = ReturnType<typeof useToasts>
