import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2, RotateCw, Search, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type CommandItem = {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
  onSelect: () => void
}

export type CommandGroup = { id: string; label: string; items: CommandItem[] }

export type CommandPaletteStatus = "idle" | "loading" | "error" | "ready"

/**
 * Paleta de comandos: um campo e uma lista agrupada. É um combobox de verdade: o foco fica no campo,
 * as setas movem a opção ativa (`aria-activedescendant`), Enter executa, Escape fecha. Sem biblioteca:
 * Radix Dialog cuida do foco preso, do Escape e do retorno do foco.
 */
export function CommandPalette({
  open,
  onOpenChange,
  value,
  onValueChange,
  groups,
  status,
  placeholder,
  hint,
  emptyText,
  errorText,
  onRetry,
  title = "Buscar",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onValueChange: (value: string) => void
  groups: CommandGroup[]
  status: CommandPaletteStatus
  placeholder: string
  /** Linha discreta abaixo da lista (ex.: "Digite pelo menos 2 caracteres"). */
  hint?: ReactNode
  emptyText: string
  errorText?: string
  onRetry?: () => void
  title?: string
}) {
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null

  useEffect(() => {
    if (!active) return
    listRef.current?.querySelector(`[data-command-id="${CSS.escape(active.id)}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  function move(delta: number) {
    if (items.length === 0) return
    const index = active ? items.indexOf(active) : -1
    setActiveId(items[(index + delta + items.length) % items.length].id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        move(1)
        break
      case "ArrowUp":
        event.preventDefault()
        move(-1)
        break
      case "Home":
        if (items.length) {
          event.preventDefault()
          setActiveId(items[0].id)
        }
        break
      case "End":
        if (items.length) {
          event.preventDefault()
          setActiveId(items[items.length - 1].id)
        }
        break
      case "Enter":
        if (active) {
          event.preventDefault()
          active.onSelect()
        }
        break
    }
  }

  const optionId = (item: CommandItem) => `${listId}-${item.id}`

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-sunken/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line-soft bg-surface-2 shadow-panel outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-line-soft px-4">
            <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              autoFocus
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-activedescendant={active ? optionId(active) : undefined}
              aria-autocomplete="list"
              aria-label={title}
              value={value}
              onChange={(event) => {
                onValueChange(event.target.value)
                setActiveId(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-faint"
            />
            {status === "loading" && <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden="true" />}
          </div>

          <div ref={listRef} id={listId} role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {groups.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.id} role="group" aria-label={group.label} className="py-1">
                  <p aria-hidden="true" className="label-mono px-2 pt-1 pb-1.5 text-faint">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === active?.id
                    return (
                      <div
                        key={item.id}
                        id={optionId(item)}
                        data-command-id={item.id}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActiveId(item.id)}
                        onClick={() => item.onSelect()}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm",
                          isActive ? "bg-surface-3 text-fg" : "text-fg-muted"
                        )}
                      >
                        {Icon && <Icon className={cn("size-4 shrink-0", isActive ? "text-accent" : "text-muted")} aria-hidden="true" />}
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{item.label}</span>
                          {item.description && <span className="truncate text-xs text-muted">{item.description}</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            <div aria-live="polite" className="empty:hidden">
              {status === "error" && (
                <div role="alert" className="flex items-center justify-between gap-3 px-2 py-3 text-sm text-fg">
                  <span>{errorText}</span>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs text-accent hover:text-accent-hover focus-visible:focus-ring"
                    >
                      <RotateCw className="size-3.5" aria-hidden="true" />
                      Tentar de novo
                    </button>
                  )}
                </div>
              )}
              {status === "ready" && items.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted">{emptyText}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2 text-2xs text-muted">
            <span className="truncate">{hint}</span>
            <span className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden="true">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navegar <Kbd>Enter</Kbd> abrir <Kbd>Esc</Kbd> fechar
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-soft bg-surface-3 px-1 font-mono text-2xs text-fg-muted", className)}>
      {children}
    </kbd>
  )
}
