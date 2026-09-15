import { useEffect, useState } from "react"
import { ChevronRight, Handshake, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionTitle } from "@/components/ui/page"
import { Alert, EmptyState, Skeleton } from "@/components/ui/states"
import { listDeals, type DealListItem } from "@/features/deals/api"
import { stageLabels, statusLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { toMessage } from "./form-errors"

type Props = {
  companyId: string
  onOpenDeal: (dealId: string) => void
  onNewDeal: () => void
}

/** Negócios da empresa — abrir a ficha do negócio a partir da ficha da empresa (regra da seção 13). */
export function CompanyDealList({ companyId, onOpenDeal, onNewDeal }: Props) {
  const [deals, setDeals] = useState<DealListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    listDeals({ companyId, pageSize: 100 }, controller.signal)
      .then((result) => setDeals(result.items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar os negócios."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [companyId])

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        count={isLoading ? undefined : deals.length}
        action={
          <Button type="button" size="sm" variant="ghost" onClick={onNewDeal}>
            <Plus aria-hidden="true" />
            Novo negócio
          </Button>
        }
      >
        Negócios
      </SectionTitle>

      {isLoading && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Carregando negócios…</span>
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {!isLoading && !error && deals.length === 0 && (
        <EmptyState
          compact
          icon={Handshake}
          title="Nenhum negócio com esta empresa"
          description="Abra um negócio para colocá-la no funil e começar a registrar o contato."
          className="rounded-sm border border-dashed border-line-soft"
        />
      )}

      {!isLoading && deals.length > 0 && (
        <ul className="flex flex-col divide-y divide-line-soft/60 rounded-sm border border-line-soft">
          {deals.map((deal) => (
            <li key={deal.id}>
              <button
                type="button"
                onClick={() => onOpenDeal(deal.id)}
                className="group flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-2/60 focus-visible:focus-ring"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-fg">{deal.contactName ?? "Sem contato definido"}</p>
                    <p className="truncate text-sm text-muted">{deal.ownerUserName}</p>
                  </div>
                  {deal.status === "Aberto" ? (
                    <Badge variant="outline">{stageLabels[deal.stage]}</Badge>
                  ) : (
                    <Badge variant={deal.status === "Ganho" ? "success" : "danger"} dot>
                      {statusLabels[deal.status]}
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-right text-base tabular sm:w-28",
                    deal.status === "Ganho" ? "text-success" : "text-fg"
                  )}
                >
                  {formatMoney(deal.amount ?? deal.ticket)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-fg-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
