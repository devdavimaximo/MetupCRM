import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import { Kbd } from "@/components/ui/command-palette"
import { NotificationBell } from "@/features/notifications/NotificationBell"
import { GlobalSearch } from "@/features/search/GlobalSearch"
import type { View } from "@/lib/url-state"

export type ShellNavigation = {
  onNavigate: (view: View) => void
  onOpenCompany: (companyId: string) => void
  onOpenDeal: (dealId: string) => void
  onOpenConversation: (conversationId: string) => void
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Busca e sino, no mesmo lugar em todas as telas: fixos no canto superior direito da área de conteúdo,
 * fora do fluxo, para não empurrar nenhum layout (o dashboard e a Inbox ocupam a altura exata da tela).
 * Montado uma vez só no AppShell: um atalho Ctrl/⌘ K, uma paleta, um sino.
 */
export function ShellActions({ userId, navigation }: { userId: string; navigation: ShellNavigation }) {
  const [searchOpen, setSearchOpen] = useState(false)
  // Cada abertura remonta a busca: campo vazio e sem resultado antigo.
  const [searchSession, setSearchSession] = useState(0)

  function openSearch() {
    setSearchSession((session) => session + 1)
    setSearchOpen(true)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      event.preventDefault()
      setSearchSession((session) => session + 1)
      setSearchOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <div
        role="toolbar"
        aria-label="Busca e notificações"
        data-testid="shell-actions"
        className="fixed top-2.5 right-14 z-40 flex items-center gap-2 lg:top-3 lg:right-6"
      >
        <button
          type="button"
          onClick={openSearch}
          aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-soft bg-surface-2/90 px-2.5 text-sm text-muted shadow-raised backdrop-blur-sm transition-colors hover:border-line-strong hover:text-fg focus-visible:focus-ring"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">Buscar</span>
          <Kbd className="max-sm:hidden">{isMac ? "⌘K" : "Ctrl K"}</Kbd>
        </button>
        <NotificationBell userId={userId} onOpenDeal={navigation.onOpenDeal} onOpenConversation={navigation.onOpenConversation} />
      </div>

      <GlobalSearch
        key={searchSession}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={navigation.onNavigate}
        onOpenCompany={navigation.onOpenCompany}
        onOpenDeal={navigation.onOpenDeal}
      />
    </>
  )
}
