import { useEffect, useState } from "react"
import { Handshake, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listDeals, type DealListItem } from "@/features/deals/api"
import { stageLabels, statusLabels } from "@/features/deals/stage-labels"
import { formatMoney } from "@/lib/money"
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Negócios{" "}
          {!isLoading && <span className="tabular font-normal text-muted-foreground">({deals.length})</span>}
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={onNewDeal}>
          <Handshake aria-hidden="true" />
          Novo Negócio
        </Button>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando negócios…
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {!isLoading && !error && deals.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum negócio aberto com esta empresa ainda.
        </p>
      )}

      {!isLoading && deals.length > 0 && (
        <ul className="flex flex-col gap-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <button
                type="button"
                onClick={() => onOpenDeal(deal.id)}
                className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {deal.contactName ?? "Sem contato definido"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{deal.ownerUserName}</p>
                </div>
                <Badge variant={deal.status === "Ganho" ? "success" : "outline"} className="tabular">
                  {formatMoney(deal.amount ?? deal.ticket)}
                </Badge>
                <Badge variant="outline">
                  {deal.status === "Aberto" ? stageLabels[deal.stage] : statusLabels[deal.status]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
