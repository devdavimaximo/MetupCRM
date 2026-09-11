import { Building2, Mail, Phone, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
  }

  if (error) {
    return (
      <p role="alert" className="p-4 text-sm font-medium text-destructive">
        {error}
      </p>
    )
  }

  if (!context) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
          Contato
        </h3>
        <p className="text-sm font-medium text-foreground">{context.contactName}</p>
        {context.contactRole && <p className="text-xs text-muted-foreground">{context.contactRole}</p>}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {(context.contactWhatsApp ?? context.contactPhone) && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" aria-hidden="true" />
              {context.contactWhatsApp ?? context.contactPhone}
            </span>
          )}
          {context.contactEmail && (
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {context.contactEmail}
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          Empresa
        </h3>
        <p className="text-sm text-foreground">{context.companyName}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Negócio</h3>
        {context.dealId && context.dealStage && context.dealStatus ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{statusLabels[context.dealStatus]}</Badge>
              <Badge variant="outline">{stageLabels[context.dealStage]}</Badge>
            </div>
            {(context.dealAmount ?? context.dealTicket) != null && (
              <p className="text-sm text-foreground">{formatMoney(context.dealAmount ?? context.dealTicket)}</p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenDeal(context.dealId!)}>
              Ver negócio
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem negócio associado a este contato.</p>
        )}
      </section>
    </div>
  )
}
