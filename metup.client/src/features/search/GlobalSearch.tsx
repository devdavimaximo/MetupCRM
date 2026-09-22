import { useEffect, useState } from "react"
import { Building2, ChartColumn, Columns3, Handshake, LayoutGrid, ListChecks, MessagesSquare, UserRound } from "lucide-react"

import { CommandPalette, type CommandGroup, type CommandPaletteStatus } from "@/components/ui/command-palette"
import { toMessage } from "@/features/companies/form-errors"
import { stageLabels, statusLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import type { View } from "@/lib/url-state"
import { MIN_SEARCH_LENGTH, search, type SearchResult } from "./api"

const DEBOUNCE_MS = 250

const NAVIGATION: { view: View; label: string; icon: typeof LayoutGrid }[] = [
  { view: "dashboard", label: "Ir para Dashboard", icon: LayoutGrid },
  { view: "pipeline", label: "Ir para Pipeline", icon: Columns3 },
  { view: "tarefas", label: "Ir para Tarefas", icon: ListChecks },
  { view: "inbox", label: "Ir para Conversas", icon: MessagesSquare },
  { view: "empresas", label: "Ir para Empresas", icon: Building2 },
  { view: "relatorios", label: "Ir para Relatórios", icon: ChartColumn },
]

/** Mesmo critério do servidor para os atalhos locais: sem maiúsculas nem acentos. */
function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

const joinParts = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ")

type Response = { term: string; result?: SearchResult; error?: string }

/**
 * Busca global (Ctrl/⌘ K): atalhos de navegação sempre à mão e, a partir de 2 caracteres, empresas,
 * contatos e negócios do servidor, com espera de 250ms entre teclas. O pai remonta o componente a
 * cada abertura, então o campo sempre começa vazio.
 */
export function GlobalSearch({
  open,
  onOpenChange,
  onNavigate,
  onOpenCompany,
  onOpenDeal,
  onOpenConversation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: View) => void
  onOpenCompany: (companyId: string) => void
  onOpenDeal: (dealId: string) => void
  onOpenConversation: (conversationId: string) => void
}) {
  const [term, setTerm] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<Response | null>(null)
  const trimmed = term.trim()
  const canSearch = trimmed.length >= MIN_SEARCH_LENGTH

  useEffect(() => {
    if (!open || !canSearch) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      search(trimmed, controller.signal)
        .then((result) => setResponse({ term: trimmed, result }))
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setResponse({ term: trimmed, error: toMessage(err, "Não foi possível buscar agora.") })
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, canSearch, trimmed, attempt])

  // Resposta de outro termo não vale: enquanto a do termo atual não chega, é "carregando".
  const current = canSearch && response?.term === trimmed ? response : null
  const status: CommandPaletteStatus = !canSearch ? "idle" : !current ? "loading" : current.error ? "error" : "ready"

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  const needle = fold(trimmed)
  const navigation: CommandGroup = {
    id: "navigation",
    label: "Navegação",
    items: NAVIGATION.filter((item) => !needle || fold(item.label).includes(needle)).map((item) => ({
      id: `nav-${item.view}`,
      label: item.label,
      icon: item.icon,
      onSelect: () => run(() => onNavigate(item.view)),
    })),
  }

  // Enquanto o termo novo carrega, os resultados do anterior ficam na tela: a lista não pisca.
  const result = canSearch ? (current?.result ?? response?.result) : undefined
  const groups: CommandGroup[] = !result
    ? [navigation]
    : [
        {
          id: "companies",
          label: "Empresas",
          items: result.companies.map((company) => ({
            id: `company-${company.id}`,
            label: company.name,
            description: joinParts(company.segment, company.city) || undefined,
            icon: Building2,
            onSelect: () => run(() => onOpenCompany(company.id)),
          })),
        },
        {
          id: "contacts",
          label: "Contatos",
          items: result.contacts.map((contact) => ({
            id: `contact-${contact.id}`,
            label: contact.name,
            description: joinParts(contact.role, contact.companyName),
            icon: UserRound,
            onSelect: () => run(() => onOpenCompany(contact.companyId)),
          })),
        },
        {
          id: "deals",
          label: "Negócios",
          items: result.deals.map((deal) => ({
            id: `deal-${deal.id}`,
            label: deal.companyName,
            description: joinParts(
              deal.status === "Aberto" ? stageLabels[deal.stage] : statusLabels[deal.status],
              deal.amount === null ? null : formatMoney(deal.amount)
            ),
            icon: Handshake,
            onSelect: () => run(() => onOpenDeal(deal.id)),
          })),
        },
        {
          id: "conversations",
          label: "Conversas",
          items: result.conversations.map((conversation) => ({
            id: `conversation-${conversation.id}`,
            label: conversation.contactName,
            description: joinParts(conversation.companyName, conversation.lastMessagePreview),
            icon: MessagesSquare,
            onSelect: () => run(() => onOpenConversation(conversation.id)),
          })),
        },
        navigation,
      ]

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      value={term}
      onValueChange={setTerm}
      groups={groups}
      status={status}
      title="Buscar no CRM"
      placeholder="Buscar empresas, contatos e negócios…"
      hint={canSearch ? "Empresas, contatos e negócios · sem diferenciar acentos" : `Digite pelo menos ${MIN_SEARCH_LENGTH} caracteres para buscar`}
      emptyText={`Nada encontrado para “${trimmed}”.`}
      errorText={current?.error}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  )
}
