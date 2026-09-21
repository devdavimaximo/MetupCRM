import { Panel, PanelHeading, SeeAll } from "@/components/metrics/panel"
import { Alert, Skeleton } from "@/components/ui/states"
import { ActivityEventButton } from "@/features/dashboard/activity-event"
import type { RecentEvent } from "@/features/dashboard/api"

/**
 * As cinco últimas movimentações dos negócios no escopo do quadro (item 19). É o mesmo feed do
 * dashboard — mesma linha (`ActivityEventButton`) e mesmo "Ver todas" (`ActivityFeedSheet`) —, só
 * que já filtrado pelo responsável escolhido no quadro.
 */
export function PipelineActivities({
  events,
  isLoading,
  error,
  onRetry,
  onOpenDeal,
  onSeeAll,
}: {
  events: RecentEvent[] | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onOpenDeal: (dealId: string) => void
  onSeeAll: () => void
}) {
  return (
    <Panel aria-labelledby="pipeline-activities-heading" className="min-h-fit gap-2 px-4 py-3.5">
      <PanelHeading
        id="pipeline-activities-heading"
        title="Atividades Recentes"
        aside={<SeeAll onClick={onSeeAll} />}
      />

      {error && !events ? (
        <Alert onRetry={onRetry}>{error}</Alert>
      ) : !events ? (
        <div role="status" aria-busy={isLoading} className="flex flex-col gap-2">
          <span className="sr-only">Carregando as atividades recentes…</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nenhuma movimentação nos negócios deste recorte.</p>
      ) : (
        <ul className="flex flex-col">
          {events.map((event) => (
            <li key={event.id}>
              <ActivityEventButton event={event} onOpenDeal={onOpenDeal} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
