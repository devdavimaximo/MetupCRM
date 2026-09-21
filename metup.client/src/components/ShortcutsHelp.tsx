import { Keyboard } from "lucide-react"

import { Kbd } from "@/components/ui/command-palette"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ShortcutHelpItem } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

/**
 * Folha de atalhos de uma tela: o botão de teclado no cabeçalho e o `?` abrem o mesmo popover.
 * Controlado por fora, para o `?` da tela abrir e fechar. Some no celular (não há teclado físico).
 */
export function ShortcutsHelp({
  shortcuts,
  open,
  onOpenChange,
  className,
}: {
  shortcuts: ShortcutHelpItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Atalhos de teclado"
          title="Atalhos de teclado (?)"
          className={cn(
            "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-soft text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:focus-ring data-[state=open]:bg-surface-3 data-[state=open]:text-fg max-md:hidden",
            className
          )}
        >
          <Keyboard className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Atalhos de teclado" className="w-[min(22rem,calc(100vw-1.5rem))] p-4">
        <p className="label-mono mb-3 text-muted">Atalhos de teclado</p>
        <dl className="flex flex-col gap-2 text-sm">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-4">
              <dt className="text-fg-muted">{shortcut.label}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}
