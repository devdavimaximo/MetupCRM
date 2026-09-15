import type { ReactNode } from "react"
import { ArrowUpRight, Mail, Phone, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/ui/monogram"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { stageLabels, statusLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import type { ConversationContext } from "./api"

type Props = {
  context: ConversationContext | null
  isLoading: boolean
  error: string | null
  onOpenDeal: (dealId: string) => void
}

/** Painel de contexto: quem é, de qual empresa e onde está no funil — ao lado da conversa. */
export function ContextPanel({ context, isLoading, error, onOpenDeal }: Props) {
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

  if (!context) {
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

      <section className="flex flex-col gap-2 border-b border-line-soft px-5 py-5">
        <h3 className="label-mono text-muted">Empresa</h3>
        <p className="text-base text-fg">{context.companyName}</p>
      </section>

      <section className="flex flex-col gap-3 px-5 py-5">
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
                  {statusLabels[context.dealStatus]}
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
