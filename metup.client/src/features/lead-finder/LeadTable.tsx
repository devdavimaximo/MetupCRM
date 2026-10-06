import { ArrowUpRight, AtSign, Ban, Check, Globe, Loader2, MapPin, MessageCircle, Phone, Star, Undo2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/ui/tooltip"
import { instagramHref, telHref, whatsAppHref } from "@/lib/contact-links"
import { cn } from "@/lib/utils"
import type { FoundLead } from "./api"
import { formatRating, formatReviewCount, isLikelyMobile, mapsHref, shortAddress, websiteLabel } from "./lead-format"

export type RowActions = {
  busyIds: ReadonlySet<string>
  onImport: (lead: FoundLead) => void
  onDiscard: (lead: FoundLead) => void
  onRestore: (lead: FoundLead) => void
  onOpenDeal: (dealId: string) => void
}

type Props = {
  leads: FoundLead[]
  selected: ReadonlySet<string>
  onToggle: (id: string, shift: boolean) => void
  onToggleAll: () => void
  actions: RowActions
}

/* ─── Células compartilhadas ─────────────────────────────────────────────── */

const iconLink =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-line-soft text-fg-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg focus-visible:focus-ring"

function LeadName({ lead }: { lead: FoundLead }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-fg">{lead.name}</span>
        {lead.existingCompanyId && lead.status === "New" && (
          <Hint content="O telefone já é de uma empresa cadastrada. Importar reaproveita a empresa, sem duplicar.">
            <span tabIndex={0} className="rounded-xs focus-visible:focus-ring">
              <Badge variant="outline">Já na base</Badge>
            </span>
          </Hint>
        )}
      </span>
      {lead.category && <span className="truncate text-xs text-muted">{lead.category}</span>}
    </div>
  )
}

function ContactLinks({ lead }: { lead: FoundLead }) {
  const tel = telHref(lead.phone)
  const wa = isLikelyMobile(lead.phone) ? whatsAppHref(lead.phone) : null
  if (!lead.phone) return <span className="text-sm text-faint">Sem telefone</span>

  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-sm text-fg tabular">{lead.phone}</span>
      {tel && (
        <a href={tel} className={iconLink} aria-label={`Ligar para ${lead.name}`}>
          <Phone className="size-4" aria-hidden="true" />
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className={iconLink} aria-label={`WhatsApp de ${lead.name} (abre em nova aba)`}>
          <MessageCircle className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

function WebsiteCell({ lead }: { lead: FoundLead }) {
  if (!lead.website) return <Badge variant="accent">Sem site</Badge>
  return (
    <a
      href={lead.website}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-xs text-sm text-fg-muted decoration-line-strong underline-offset-4 hover:text-fg hover:underline focus-visible:focus-ring"
    >
      <Globe className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="truncate">{websiteLabel(lead.website)}</span>
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  )
}

/** "@sorrisocuritiba", vindo como @handle ou como URL do perfil. */
function instagramHandle(value: string) {
  const handle = value.trim().replace(/\/+$/, "")
  const fromUrl = /instagram\.com\/([^/?#]+)/i.exec(handle)?.[1]
  return `@${(fromUrl ?? handle).replace(/^@/, "")}`
}

function InstagramCell({ lead }: { lead: FoundLead }) {
  const href = instagramHref(lead.instagram)
  if (!lead.instagram || !href) return <span className="text-sm text-faint">—</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded-xs text-sm text-fg-muted decoration-line-strong underline-offset-4 hover:text-fg hover:underline focus-visible:focus-ring"
    >
      <AtSign className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="truncate">{instagramHandle(lead.instagram).slice(1)}</span>
      <span className="sr-only">(Instagram, abre em nova aba)</span>
    </a>
  )
}

function AddressLink({ lead }: { lead: FoundLead }) {
  const address = shortAddress(lead)
  return (
    <a
      href={mapsHref(lead)}
      target="_blank"
      rel="noreferrer"
      title={address ?? undefined}
      className="flex max-w-full min-w-0 items-center gap-1.5 rounded-xs text-xs text-muted hover:text-fg focus-visible:focus-ring min-[1680px]:text-sm"
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{address ?? "Ver no mapa"}</span>
      <span className="sr-only">(abre o mapa em nova aba)</span>
    </a>
  )
}

function RatingCell({ lead }: { lead: FoundLead }) {
  if (lead.rating === null) return <span className="text-sm text-faint">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap tabular">
      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
      <span className="font-medium text-fg">{formatRating(lead.rating)}</span>
      {lead.reviewCount !== null && (
        <span className="text-muted">
          ({formatReviewCount(lead.reviewCount)}
          <span className="sr-only"> avaliações</span>)
        </span>
      )}
    </span>
  )
}

function RowAction({ lead, actions }: { lead: FoundLead; actions: RowActions }) {
  const busy = actions.busyIds.has(lead.id)

  if (lead.status === "Imported") {
    return lead.dealId ? (
      <Button type="button" size="sm" variant="ghost" onClick={() => actions.onOpenDeal(lead.dealId!)}>
        Ver negócio
        <ArrowUpRight aria-hidden="true" />
      </Button>
    ) : (
      <Badge variant="success">Importado</Badge>
    )
  }

  if (lead.status === "Discarded") {
    return (
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => actions.onRestore(lead)}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
        Restaurar
      </Button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Hint content="Descartar — fora do perfil">
        <button
          type="button"
          disabled={busy}
          onClick={() => actions.onDiscard(lead)}
          aria-label={`Descartar ${lead.name}`}
          className={cn(iconLink, "hover:border-danger/60 hover:bg-danger/10 hover:text-danger disabled:opacity-45")}
        >
          <Ban className="size-4" aria-hidden="true" />
        </button>
      </Hint>
      <Button type="button" size="sm" disabled={busy} onClick={() => actions.onImport(lead)} aria-label={`Importar ${lead.name} para o pipeline`}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
        Importar
      </Button>
    </div>
  )
}

function SelectBox({ label, checked, indeterminate, onChange }: { label: string; checked: boolean; indeterminate?: boolean; onChange: (shift: boolean) => void }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate)
      }}
      // O change não diz se o Shift estava pressionado; o clique diz (teclado = Espaço, sem Shift).
      onClick={(event) => onChange(event.shiftKey)}
      onChange={() => undefined}
      className="size-4 cursor-pointer rounded-xs accent-accent focus-visible:focus-ring"
    />
  )
}

/* ─── Tabela (≥ 1024px) e cards (abaixo) ─────────────────────────────────── */

export function LeadTable({ leads, selected, onToggle, onToggleAll, actions }: Props) {
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const someSelected = !allSelected && leads.some((l) => selected.has(l.id))

  return (
    <>
      <div className="max-lg:hidden">
        {/* Tabela na largura toda: cada informação na sua coluna. O endereço ganha coluna própria
            a partir de 1680px; abaixo disso vai na linha do nome, como link para o mapa. */}
        <Table minWidth="62rem" className="table-fixed">
          <TableHeader>
            <tr>
              <TableHead className="w-12">
                <SelectBox label="Selecionar todos desta página" checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="w-52">Telefone</TableHead>
              <TableHead className="w-36">Instagram</TableHead>
              <TableHead className="w-40">Site</TableHead>
              <TableHead className="w-32">Avaliação</TableHead>
              <TableHead className="hidden w-64 min-[1680px]:table-cell">Endereço</TableHead>
              <TableHead className="w-40 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} data-selected={selected.has(lead.id) || undefined} className="data-selected:bg-accent/5">
                <TableCell>
                  <SelectBox label={`Selecionar ${lead.name}`} checked={selected.has(lead.id)} onChange={(shift) => onToggle(lead.id, shift)} />
                </TableCell>
                <TableCell className="h-auto py-3 whitespace-normal">
                  <LeadName lead={lead} />
                  <div className="mt-1 min-[1680px]:hidden">
                    <AddressLink lead={lead} />
                  </div>
                </TableCell>
                <TableCell>
                  <ContactLinks lead={lead} />
                </TableCell>
                <TableCell>
                  <InstagramCell lead={lead} />
                </TableCell>
                <TableCell>
                  <WebsiteCell lead={lead} />
                </TableCell>
                <TableCell>
                  <RatingCell lead={lead} />
                </TableCell>
                <TableCell className="hidden min-[1680px]:table-cell">
                  <AddressLink lead={lead} />
                </TableCell>
                <TableCell>
                  <RowAction lead={lead} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col divide-y divide-line-soft/70 lg:hidden">
        {leads.map((lead) => (
          <li key={lead.id} className={cn("flex flex-col gap-3 px-4 py-4", selected.has(lead.id) && "bg-accent/5")}>
            <div className="flex items-start gap-3">
              <span className="pt-0.5">
                <SelectBox label={`Selecionar ${lead.name}`} checked={selected.has(lead.id)} onChange={(shift) => onToggle(lead.id, shift)} />
              </span>
              <div className="min-w-0 flex-1">
                <LeadName lead={lead} />
              </div>
              <RatingCell lead={lead} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
              <ContactLinks lead={lead} />
              <WebsiteCell lead={lead} />
              {lead.instagram && <InstagramCell lead={lead} />}
              <a href={mapsHref(lead)} target="_blank" rel="noreferrer" className={iconLink} aria-label={`Ver ${lead.name} no mapa (abre em nova aba)`}>
                <MapPin className="size-4" aria-hidden="true" />
              </a>
            </div>
            {shortAddress(lead) && <p className="pl-7 text-xs text-muted">{shortAddress(lead)}</p>}
            <div className="flex justify-end">
              <RowAction lead={lead} actions={actions} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
