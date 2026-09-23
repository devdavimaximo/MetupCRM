import { Panel } from "@/components/metrics/panel"
import { Alert, Skeleton } from "@/components/ui/states"

/** Estados de carregamento/erro compartilhados entre as abas de relatório. */
export function ReportLoading() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Carregando relatório…</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <Panel className="gap-4 p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Alert onRetry={onRetry}>{message}</Alert>
}
