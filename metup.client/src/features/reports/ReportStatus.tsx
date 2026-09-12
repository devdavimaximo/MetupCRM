import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Estados de carregamento/erro compartilhados entre as seções de relatório. */
export function ReportLoading() {
  return (
    <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Carregando relatório…
    </p>
  )
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Tentar de Novo
      </Button>
    </div>
  )
}
