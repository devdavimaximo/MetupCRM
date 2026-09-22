import { useState, type ReactNode } from "react"
import {
  ArrowUpRight,
  Bot,
  Building2,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Tag as TagIcon,
  UserRound,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monogram } from "@/components/ui/monogram"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { Switch } from "@/components/ui/switch"
import { ActivityEventButton } from "@/features/dashboard/activity-event"
import type { DealDrawerSection } from "@/features/deals/deal-section"
import { stageLabels, statusLabels as dealStatusLabels } from "@/features/deals/stage-labels"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { formatDue } from "@/lib/format"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { getActivityHistory, listConversationTagOptions, type ConversationContext } from "./api"
import { formatResponseTime } from "./inbox-format"

type Props = {
  conversationId: string | null
  context: ConversationContext | null
  isLoading: boolean
  error: string | null
  onOpenDeal: (dealId: string, section?: DealDrawerSection) => void
  onApplyTag: (conversationId: string, name: string) => void
  onRemoveTag: (conversationId: string, tagOptionId: string, name: string) => void
  onToggleAutomation: (conversationId: string, enabled: boolean) => void
  isAutomationPending: boolean
}

/** Painel de contexto: quem é, de qual empresa e onde está no funil — ao lado da conversa. */
export function ContextPanel({
  conversationId,
  context,
  isLoading,
  error,
  onOpenDeal,
  onApplyTag,
  onRemoveTag,
  onToggleAutomation,
  isAutomationPending,
}: Props) {
  if (isLoading) {
    return (
      <div role="status" className="flex flex-col gap-4 p-5">
        <span className="sr-only">Carregando contexto…</span>
        <Skeleton className="size-12" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-5">
        <Alert>{error}</Alert>
      </div>
    )
  }

  if (!context || !conversationId) {
    return <EmptyState compact icon={UserRound} title="Sem contato selecionado" description="O contexto do contato e do negócio aparece aqui." className="h-full" />
  }

  const value = context.dealAmount ?? context.dealTicket

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line-soft px-5 pt-6 pb-5">
        <Monogram name={context.contactName} size="lg" />
        <div>
          <p className="text-lg font-medium text-fg">{context.contactName}</p>
          {context.contactRole && <p className="text-sm text-muted">{context.contactRole}</p>}
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          {(context.contactWhatsApp ?? context.contactPhone) && (
            <InfoRow icon={<Phone className="size-3.5" aria-hidden="true" />} label="Telefone">
              <span className="tabular">{context.contactWhatsApp ?? context.contactPhone}</span>
            </InfoRow>
          )}
          {context.contactEmail && (
            <InfoRow icon={<Mail className="size-3.5" aria-hidden="true" />} label="E-mail">
              <span className="break-all">{context.contactEmail}</span>
            </InfoRow>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-3 border-b border-line-soft px-5 py-5">
        <h3 className="label-mono text-muted">Dados da empresa</h3>
        <p className="text-base text-fg">{context.companyName}</p>
        <dl className="flex flex-col gap-2 text-sm">
          {context.companyCnpj && (
            <InfoRow icon={<Building2 className="size-3.5" aria-hidden="true" />} label="CNPJ">
              <span className="tabular">{context.companyCnpj}</span>
            </InfoRow>
          )}
          {context.companySegment && (
            <InfoRow icon={<TagIcon className="size-3.5" aria-hidden="true" />} label="Segmento">
              {context.companySegment}
            </InfoRow>
          )}
          {context.companyCity && (
            <InfoRow icon={<MapPin className="size-3.5" aria-hidden="true" />} label="Cidade">
              {context.companyCity}
            </InfoRow>
          )}
          {context.companyWebsite && (
            <InfoRow icon={<Globe className="size-3.5" aria-hidden="true" />} label="Site">
              <a
                href={context.companyWebsite.startsWith("http") ? context.companyWebsite : `https://${context.companyWebsite}`}
                target="_blank"
                rel="noreferrer"
                className="break-all text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent"
              >
                {context.companyWebsite}
              </a>
            </InfoRow>
          )}
          {context.dealOwnerUserName && (
            <InfoRow icon={<UserRound className="size-3.5" aria-hidden="true" />} label="Responsável">
              {context.dealOwnerUserName}
            </InfoRow>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-3 border-b border-line-soft px-5 py-5">
        <h3 className="label-mono text-muted">Negócio</h3>
        {context.dealId && context.dealStage && context.dealStatus ? (
          <div className="flex flex-col gap-4 rounded-sm border border-line-soft bg-surface p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {context.dealStatus === "Aberto" ? (
                <Badge variant="accent" dot>
                  {stageLabels[context.dealStage]}
                </Badge>
              ) : (
                <Badge variant={context.dealStatus === "Ganho" ? "success" : "danger"} dot>
                  {dealStatusLabels[context.dealStatus]}
                </Badge>
              )}
            </div>
            <div>
              <p className="label-mono text-faint">Valor</p>
              <p className="font-display text-xl font-semibold text-fg tabular">{formatMoney(value)}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenDeal(context.dealId!)}>
              Abrir negócio
              <ArrowUpRight aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Sem negócio associado a este contato.</p>
        )}
      </section>

      <section className="flex flex-col gap-3 border-b border-line-soft px-5 py-5">
        <h3 className="label-mono text-muted">Resumo da conversa</h3>
        <dl className="flex flex-col gap-2 text-sm">
          {context.summary.lastInteractionAt && (
            <InfoRow icon={<MessageCircle className="size-3.5" aria-hidden="true" />} label="Última interação">
              {formatDue(context.summary.lastInteractionAt)}
            </InfoRow>
          )}
          <InfoRow icon={<MessageCircle className="size-3.5" aria-hidden="true" />} label="Total de mensagens">
            <span className="tabular">{context.summary.totalMessages}</span>
          </InfoRow>
          <InfoRow icon={<MessageCircle className="size-3.5" aria-hidden="true" />} label="Tempo médio de resposta">
            {formatResponseTime(context.summary.averageResponseTimeMinutes)}
          </InfoRow>
        </dl>
      </section>

      <TagsSection
        conversationId={conversationId}
        tags={context.tags}
        onApplyTag={(name) => onApplyTag(conversationId, name)}
        onRemoveTag={(tagOptionId, name) => onRemoveTag(conversationId, tagOptionId, name)}
      />

      {context.dealId && <ActivityHistorySection dealId={context.dealId} onOpenDeal={onOpenDeal} />}

      <section className="px-5 py-5">
        <div
          aria-busy={isAutomationPending}
          className={cn(
            "flex flex-col gap-1.5 rounded-sm border p-4",
            context.automationEnabled ? "border-accent/30 bg-accent/10" : "border-line-soft bg-surface"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-fg">
              <Bot className="size-4 text-accent" aria-hidden="true" />
              Automação
            </span>
            <Switch
              checked={context.automationEnabled}
              disabled={isAutomationPending}
              onCheckedChange={(checked) => onToggleAutomation(conversationId, checked)}
              aria-label={context.automationEnabled ? "Desativar automação" : "Ativar automação"}
            />
          </div>
          <p className="text-xs text-fg-muted">
            {context.automationEnabled ? "Este lead está recebendo comunicações automáticas." : "A automação está desligada para este lead."}
          </p>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-fg-muted">
      <dt className="mt-0.5 text-muted">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/**
 * Tags da conversa (item 19): chips aplicados com `×` direto e um popover com busca no catálogo da
 * organização + criação de uma tag nova. O catálogo completo (sem termo) também serve para achar o
 * id de uma tag já aplicada — o contexto só devolve os nomes — e é recarregado sempre que a lista de
 * tags aplicadas muda, o que também resolve o id de uma tag recém-criada.
 */
function TagsSection({
  conversationId,
  tags,
  onApplyTag,
  onRemoveTag,
}: {
  conversationId: string
  tags: string[]
  onApplyTag: (name: string) => void
  onRemoveTag: (tagOptionId: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)

  // Catálogo completo, sem termo de busca: só para resolver o id de uma tag já aplicada (o contexto
  // só devolve nomes). Recarrega quando as tags aplicadas mudam — cobre também uma tag recém-criada.
  const catalogResource = useAsyncResource(
    (signal) => listConversationTagOptions(undefined, signal),
    [conversationId, tags]
  )
  const catalog = catalogResource.data ?? []

  const searchResource = useAsyncResource((signal) => listConversationTagOptions(debouncedSearch || undefined, signal), [debouncedSearch], {
    enabled: open,
  })
  const options = searchResource.data ?? []
  const isSearching = searchResource.isLoading

  function idOf(name: string) {
    return catalog.find((option) => option.name.toLowerCase() === name.toLowerCase())?.id ?? null
  }

  const trimmedSearch = search.trim()
  const hasExactMatch = options.some((option) => option.name.toLowerCase() === trimmedSearch.toLowerCase())

  return (
    <section className="flex flex-col gap-2.5 border-b border-line-soft px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="label-mono text-muted">Tags</h3>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setSearch("")
          }}
        >
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-accent hover:text-accent-hover">
              <Plus className="size-3.5" aria-hidden="true" />
              Adicionar tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-64 flex-col gap-2.5 p-3">
            <Label htmlFor="conversation-tag-search" className="sr-only">
              Buscar ou criar tag
            </Label>
            <Input
              id="conversation-tag-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ou criar tag…"
              autoComplete="off"
              spellCheck={false}
              className="h-9"
            />
            <div className="flex flex-wrap gap-1.5">
              {isSearching && <p className="text-xs text-muted">Buscando…</p>}
              {!isSearching &&
                options.map((option) => {
                  const applied = tags.some((tag) => tag.toLowerCase() === option.name.toLowerCase())
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={applied}
                      onClick={() => (applied ? onRemoveTag(option.id, option.name) : onApplyTag(option.name))}
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center rounded-xs border px-2 text-xs transition-colors focus-visible:focus-ring",
                        applied ? "border-accent/60 bg-accent/10 text-accent" : "border-line-soft bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg"
                      )}
                    >
                      {option.name}
                    </button>
                  )
                })}
              {!isSearching && trimmedSearch && !hasExactMatch && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyTag(trimmedSearch)
                    setSearch("")
                  }}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-xs border border-dashed border-line-strong px-2 text-xs text-accent transition-colors hover:bg-accent/10 focus-visible:focus-ring"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  Criar “{trimmedSearch}”
                </button>
              )}
              {!isSearching && options.length === 0 && !trimmedSearch && (
                <p className="text-xs text-muted">Digite para buscar ou criar uma tag.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="outline" className="gap-1 py-0.5 pr-1">
                {tag}
                <button
                  type="button"
                  aria-label={`Remover tag ${tag}`}
                  onClick={() => {
                    const id = idOf(tag)
                    if (id) onRemoveTag(id, tag)
                  }}
                  className="inline-flex size-3.5 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-fg focus-visible:focus-ring"
                >
                  <X className="size-2.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Sem tags nesta conversa.</p>
      )}
    </section>
  )
}

/**
 * Histórico de atividades do negócio (item 20): os 5 últimos eventos, mesmo item visual do feed do
 * dashboard (`ActivityEventButton`). Some se a conversa não tiver negócio vinculado.
 */
function ActivityHistorySection({
  dealId,
  onOpenDeal,
}: {
  dealId: string
  onOpenDeal: (dealId: string, section?: DealDrawerSection) => void
}) {
  const history = useAsyncResource((signal) => getActivityHistory(dealId, signal).then((page) => page.items), [dealId])
  const items = history.error ? [] : history.data

  return (
    <section className="flex flex-col gap-2.5 border-b border-line-soft px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="label-mono text-muted">Histórico de atividades</h3>
        <button
          type="button"
          onClick={() => onOpenDeal(dealId, "activity")}
          className="cursor-pointer rounded-xs text-xs text-accent hover:text-accent-hover focus-visible:focus-ring"
        >
          Ver tudo
        </button>
      </div>

      {items === null && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Carregando histórico…</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {items !== null && items.length === 0 && <p className="text-sm text-muted">Sem atividade registrada neste negócio ainda.</p>}

      {items !== null && items.length > 0 && (
        <ol className="flex flex-col divide-y divide-line-soft/70">
          {items.map((event) => (
            <li key={event.id}>
              <ActivityEventButton event={event} onOpenDeal={() => onOpenDeal(dealId)} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
