import { Hint } from "@/components/ui/tooltip"
import { useRealtimeStatus } from "@/lib/realtime"
import { cn } from "@/lib/utils"

/**
 * Ponto discreto do estado do tempo real, com o texto no tooltip e para leitor de tela. O mesmo no
 * dashboard e no Pipeline. Precisa de um `TooltipProvider` acima.
 */
export function RealtimeIndicator({ className }: { className?: string }) {
  const status = useRealtimeStatus()
  const live = status === "connected"
  const text = live ? "Atualização em tempo real" : "Reconectando…"
  return (
    <Hint content={text}>
      <span
        tabIndex={0}
        data-testid="realtime-indicator"
        data-status={status}
        className={cn("ml-1 inline-flex size-4 items-center justify-center rounded-full focus-visible:focus-ring", className)}
      >
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", live ? "bg-success" : "animate-pulse bg-accent motion-reduce:animate-none")}
        />
        <span className="sr-only">{text}</span>
      </span>
    </Hint>
  )
}
