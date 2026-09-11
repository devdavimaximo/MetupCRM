import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toMessage } from "@/features/companies/form-errors"
import { readUrlState, writeUrlState } from "@/lib/url-state"
import { DealBoard } from "./DealBoard"
import { DealDrawer, type DealDrawerTarget } from "./DealDrawer"
import { changeDealStage, listDeals, listUsers, type DealListItem, type DealStage, type UserSummary } from "./api"

type Props = {
  onOpenCompany: (companyId: string) => void
  newDealIntent?: { companyId: string; companyName: string } | null
}

export function PipelinePage({ onOpenCompany, newDealIntent }: Props) {
  const [deals, setDeals] = useState<DealListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const [users, setUsers] = useState<UserSummary[]>([])

  const [target, setTarget] = useState<DealDrawerTarget>(() => {
    if (newDealIntent) return { mode: "new", ...newDealIntent }
    const dealId = readUrlState().dealId
    return dealId ? { mode: "deal", id: dealId } : null
  })

  const [movingDealId, setMovingDealId] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)

  const reload = useCallback(() => setReloadVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    listDeals({ pageSize: 200 }, controller.signal)
      .then((result) => setDeals(result.items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(toMessage(err, "Não foi possível carregar o pipeline."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [reloadVersion])

  useEffect(() => {
    const controller = new AbortController()
    listUsers(controller.signal)
      .then(setUsers)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  function openDeal(dealId: string) {
    writeUrlState({ dealId })
    setTarget({ mode: "deal", id: dealId })
  }

  function closeDrawer() {
    writeUrlState({ dealId: null })
    setTarget(null)
  }

  async function handleMoveStage(dealId: string, stage: DealStage) {
    setMovingDealId(dealId)
    setBoardError(null)

    try {
      await changeDealStage(dealId, stage)
      reload()
    } catch (err) {
      setBoardError(toMessage(err, "Não foi possível mover o negócio de estágio."))
    } finally {
      setMovingDealId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${deals.length} ${deals.length === 1 ? "negócio" : "negócios"} no funil`}
          </p>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={reload}>
            Tentar de Novo
          </Button>
        </div>
      )}

      {boardError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {boardError}
        </p>
      )}

      {isLoading && deals.length === 0 && !error && (
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Carregando pipeline…
        </p>
      )}

      {!error && (isLoading === false || deals.length > 0) && (
        <DealBoard
          deals={deals}
          movingDealId={movingDealId}
          onOpenDeal={openDeal}
          onMoveStage={handleMoveStage}
        />
      )}

      <DealDrawer
        target={target}
        users={users}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
        onOpenCompany={onOpenCompany}
        onSaved={reload}
      />
    </div>
  )
}
