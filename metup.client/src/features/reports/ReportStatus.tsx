import { Card } from "@/components/ui/card"
import { Alert, Skeleton } from "@/components/ui/states"

/** Estados de carregamento/erro compartilhados entre as seções de relatório. */
export function ReportLoading() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Carregando relatório…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <Card className="flex flex-col gap-4 p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </Card>
    </div>
  )
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Alert onRetry={onRetry}>{message}</Alert>
}
