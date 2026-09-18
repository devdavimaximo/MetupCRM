import { useState, type KeyboardEvent } from "react"
import { Check, ChevronDown, Search, Users } from "lucide-react"

import { Monogram } from "@/components/ui/monogram"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { UserSummary } from "@/features/deals/api"
import { cn } from "@/lib/utils"
import type { OwnerFilter } from "./task-format"

/** Acima disso a lista ganha busca — até 8 nomes, bater o olho é mais rápido que digitar. */
const SEARCH_THRESHOLD = 8

function ownerLabel(owner: OwnerFilter, users: UserSummary[]) {
  if (owner.kind === "mine") return "Minhas tarefas"
  if (owner.kind === "all") return "Todos os responsáveis"
  return users.find((u) => u.id === owner.userId)?.name ?? "Responsável"
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

/**
 * "De quem são as tarefas": Minhas · Todos · um usuário. Listbox num popover — setas movem, Enter
 * escolhe, Esc fecha — com busca quando a equipe passa de 8 pessoas. Só existe para Admin/Closer.
 */
export function OwnerPicker({
  value,
  users,
  currentUserId,
  onChange,
  className,
}: {
  value: OwnerFilter
  users: UserSummary[]
  currentUserId: string
  onChange: (owner: OwnerFilter) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const others = users.filter((u) => u.id !== currentUserId)
  const visible = query ? others.filter((u) => normalize(u.name).includes(normalize(query))) : others
  const options: { key: string; label: string; owner: OwnerFilter; user?: UserSummary }[] = [
    { key: "mine", label: "Minhas tarefas", owner: { kind: "mine" } },
    { key: "all", label: "Todos os responsáveis", owner: { kind: "all" } },
    ...visible.map((user) => ({ key: user.id, label: user.name, owner: { kind: "user", userId: user.id } as OwnerFilter, user })),
  ]
  const selectedKey = value.kind === "user" ? value.userId : value.kind

  function choose(owner: OwnerFilter) {
    onChange(owner)
    setOpen(false)
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=option]")]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1)
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Responsável: ${ownerLabel(value, users)}`}
          className={cn(
            "inline-flex h-10 min-w-0 cursor-pointer items-center gap-3 rounded-md border border-line-soft bg-surface px-4 text-sm text-fg transition-colors hover:border-line-strong focus-visible:focus-ring data-[state=open]:border-line-strong",
            className
          )}
        >
          <Users className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate">{ownerLabel(value, users)}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-fg-muted" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Escolher responsável"
        className="flex w-72 flex-col"
        onOpenAutoFocus={(event) => {
          // Sem busca, o foco vai para a opção escolhida (e as setas já funcionam).
          if (others.length > SEARCH_THRESHOLD) return
          event.preventDefault()
          const content = event.currentTarget as HTMLElement
          content.querySelector<HTMLElement>("[aria-selected=true]")?.focus()
        }}
      >
        {others.length > SEARCH_THRESHOLD && (
          <label className="flex items-center gap-2 border-b border-line-soft px-3">
            <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">Buscar responsável</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar responsável…"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return
                event.preventDefault()
                event.currentTarget.closest("[data-slot=popover-content]")?.querySelector<HTMLElement>("[role=option]")?.focus()
              }}
            />
          </label>
        )}
        <ul role="listbox" aria-label="Responsáveis" className="max-h-80 overflow-y-auto p-1" onKeyDown={handleListKeyDown}>
          {options.map((option, index) => {
            const selected = option.key === selectedKey
            return (
              <li
                key={option.key}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => choose(option.owner)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  choose(option.owner)
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm outline-none select-none hover:bg-surface-3 hover:text-fg focus-visible:bg-surface-3 focus-visible:text-fg",
                  selected ? "text-fg" : "text-fg-muted",
                  index === 2 && "mt-1 border-t border-line-soft pt-2.5"
                )}
              >
                {option.user ? (
                  <Monogram name={option.user.name} size="xs" />
                ) : (
                  <Users className="size-4 shrink-0 text-muted" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />}
              </li>
            )
          })}
          {query && visible.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">Ninguém com esse nome.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
