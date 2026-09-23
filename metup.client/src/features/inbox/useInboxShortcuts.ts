import { useEffect, useMemo } from "react"

import type { ConversationListItem } from "./api"

function isEditableTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA"
}

type Options = {
  conversations: ConversationListItem[]
  selectedId: string | null
  /** Verdadeiro só quando a thread cobre a lista (abaixo de `lg`) — no desktop `Esc` não faz nada. */
  isThreadOpenOnMobile: boolean
  onSelect: (conversationId: string) => void
  onFocusSearch: () => void
  onBack: () => void
}

/**
 * Atalhos de teclado da tela de Conversas (item 23): `/` foca a busca, `J`/`K` navegam a lista
 * carregada (sem voltar ao início/fim — sem wrap) e `Esc` volta para a lista no celular. Nunca
 * captura teclado com foco em campo de texto/`contenteditable`, nem com um modificador pressionado
 * (evita brigar com atalhos do navegador e o `⌘K`).
 */
export function useInboxShortcuts({ conversations, selectedId, isThreadOpenOnMobile, onSelect, onFocusSearch, onBack }: Options) {
  const ids = useMemo(() => conversations.map((c) => c.id), [conversations])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(document.activeElement)) return

      if (event.key === "/") {
        event.preventDefault()
        onFocusSearch()
        return
      }

      if (event.key === "Escape") {
        if (isThreadOpenOnMobile) onBack()
        return
      }

      const key = event.key.toLowerCase()
      if (key !== "j" && key !== "k") return
      if (ids.length === 0) return

      const currentIndex = selectedId ? ids.indexOf(selectedId) : -1
      if (key === "j") {
        if (currentIndex === -1) return onSelect(ids[0])
        if (currentIndex >= ids.length - 1) return
        onSelect(ids[currentIndex + 1])
      } else {
        if (currentIndex <= 0) return
        onSelect(ids[currentIndex - 1])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [ids, selectedId, isThreadOpenOnMobile, onSelect, onFocusSearch, onBack])
}
