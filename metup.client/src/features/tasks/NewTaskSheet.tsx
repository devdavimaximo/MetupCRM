import { useRef, useState, type KeyboardEvent } from "react"
import { Loader2, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChoiceChips } from "@/components/ui/choice-chips"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { activityTypeIcons } from "@/features/activities/activity-icons"
import { activityTypeLabels, NEXT_ACTION_TYPES } from "@/features/activities/activity-labels"
import type { ActivityType } from "@/features/activities/api"
import { toFieldErrors, toMessage } from "@/features/companies/form-errors"
import type { DealStage, UserSummary } from "@/features/deals/api"
import { stageLabels } from "@/features/deals/stage-labels"
import { MIN_SEARCH_LENGTH, search, type DealSearchHit } from "@/features/search/api"
import { ApiError } from "@/lib/api"
import { useAsyncResource, useDebouncedValue } from "@/lib/hooks"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { createTask, type TaskItem } from "./api"
import { dueShortcuts, toDateTimeInputValue } from "./task-format"

const MAX_NOTE = 500

/** Negócio já escolhido — pela busca, ou pré-selecionado por quem abriu (a T3 abre do `DealDrawer`). */
export type NewTaskDeal = { id: string; companyName: string; stage: DealStage; ownerUserName?: string | null }

type Fields = "dealId" | "type" | "dueDate" | "ownerUserId" | "note"
type Errors = Partial<Record<Fields, string>> & { general?: string }

/** 400 vem por campo; 403, 404 e 409 viram frases no campo a que dizem respeito. */
function mapCreateError(error: unknown): Errors {
  if (!(error instanceof ApiError)) return { general: "Não foi possível criar a tarefa. Tente de novo." }
  if (error.status === 409) return { dealId: "Este negócio está fechado. Escolha um negócio em aberto." }
  if (error.status === 403) return { ownerUserId: "Você só pode criar tarefas para você mesmo." }
  if (error.status === 404) return { dealId: "Negócio ou responsável não encontrado. Ele pode ter sido removido." }
  const fields = toFieldErrors(error) as Errors
  return Object.keys(fields).length > 0 ? fields : { general: toMessage(error, "Não foi possível criar a tarefa.") }
}

export function NewTaskSheet({
  open,
  onOpenChange,
  canAssign,
  users,
  currentUserId,
  initialDeal = null,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Admin/Closer escolhem o responsável; SDR cria só para si. */
  canAssign: boolean
  users: UserSummary[]
  currentUserId: string
  initialDeal?: NewTaskDeal | null
  onCreated: (task: TaskItem) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <NewTaskForm
          canAssign={canAssign}
          users={users}
          currentUserId={currentUserId}
          initialDeal={initialDeal}
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      )}
    </Sheet>
  )
}

/** Montado só com o diálogo aberto: cada abertura começa limpa, sem efeito para "resetar" estado. */
function NewTaskForm({
  canAssign,
  users,
  currentUserId,
  initialDeal,
  onClose,
  onCreated,
}: {
  canAssign: boolean
  users: UserSummary[]
  currentUserId: string
  initialDeal: NewTaskDeal | null
  onClose: () => void
  onCreated: (task: TaskItem) => void
}) {
  const [deal, setDeal] = useState<NewTaskDeal | null>(initialDeal)
  const [query, setQuery] = useState("")
  const [type, setType] = useState<ActivityType>("Call")
  const [due, setDue] = useState("")
  const [ownerUserId, setOwnerUserId] = useState(currentUserId)
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Aberto por estado (não por um Trigger), o Radix não sabe para onde devolver o foco: guardamos quem abriu.
  const [opener] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)))
  const searchRef = useRef<HTMLInputElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)

  const term = useDebouncedValue(query.trim(), 300)
  const results = useAsyncResource((signal) => search(term, signal), [term], {
    enabled: deal === null && term.length >= MIN_SEARCH_LENGTH,
  })
  // A busca global devolve negócios de qualquer status; tarefa só entra em negócio aberto.
  const openDeals = (results.data?.deals ?? []).filter((hit) => hit.status === "Aberto")
  const closedCount = (results.data?.deals.length ?? 0) - openDeals.length

  const [now] = useState(() => new Date())
  const shortcuts = dueShortcuts(now, "next-hour")
  const dirty = (deal !== null && deal !== initialDeal) || query !== "" || due !== "" || note !== "" || type !== "Call"

  function pickDeal(hit: DealSearchHit) {
    setDeal({ id: hit.id, companyName: hit.companyName, stage: hit.stage, ownerUserName: hit.ownerUserName })
    setErrors((e) => ({ ...e, dealId: undefined }))
    // O próximo campo recebe o foco: quem escolheu o negócio segue preenchendo sem mouse.
    requestAnimationFrame(() => typeRef.current?.querySelector<HTMLElement>("[tabindex='0']")?.focus())
  }

  function requestClose() {
    if (dirty && !isSaving) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  async function submit() {
    const nextErrors: Errors = {}
    if (!deal) nextErrors.dealId = "Escolha o negócio da tarefa."
    const dueDate = due ? new Date(due) : null
    if (!dueDate) nextErrors.dueDate = "Escolha quando a tarefa vence."
    else if (dueDate <= new Date()) nextErrors.dueDate = "O prazo não pode estar no passado."
    if (Object.keys(nextErrors).length > 0 || !deal || !dueDate) {
      setErrors(nextErrors)
      return
    }

    setIsSaving(true)
    setErrors({})
    try {
      const task = await createTask({
        dealId: deal.id,
        type,
        dueDate: dueDate.toISOString(),
        ownerUserId: canAssign && ownerUserId !== currentUserId ? ownerUserId : undefined,
        note: note.trim() || undefined,
      })
      onCreated(task)
    } catch (error) {
      setErrors(mapCreateError(error))
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void submit()
    }
  }

  const assignees = [
    ...users.filter((u) => u.id === currentUserId).map((u) => ({ value: u.id, label: `${u.name} (eu)` })),
    ...users.filter((u) => u.id !== currentUserId).map((u) => ({ value: u.id, label: u.name })),
  ]

  return (
    <SheetContent
      size="md"
      aria-describedby="new-task-description"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        if (initialDeal) typeRef.current?.querySelector<HTMLElement>("[tabindex='0']")?.focus()
        else searchRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        opener?.focus()
      }}
      onEscapeKeyDown={(event) => {
        if (!dirty || isSaving) return
        event.preventDefault()
        setConfirmDiscard(true)
      }}
      onInteractOutside={(event) => {
        if (!dirty) return
        event.preventDefault()
        setConfirmDiscard(true)
      }}
    >
      <SheetHeader>
        <SheetTitle>Nova tarefa</SheetTitle>
        <SheetDescription id="new-task-description">
          A próxima ação de um negócio em aberto. Ctrl+Enter salva.
        </SheetDescription>
      </SheetHeader>

      <SheetBody>
        <form
          noValidate
          onKeyDown={handleKeyDown}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-1 flex-col gap-6 px-5 py-5 sm:px-6"
        >
          {/* Negócio */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-task-deal">
              Negócio<span aria-hidden="true" className="text-muted">*</span>
            </Label>
            {deal ? (
              <div className="flex items-center justify-between gap-3 rounded-sm border border-line-soft bg-surface-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{deal.companyName}</p>
                  <p className="truncate text-xs text-muted">
                    {stageLabels[deal.stage]}
                    {deal.ownerUserName && ` · ${deal.ownerUserName}`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDeal(null)
                    requestAnimationFrame(() => searchRef.current?.focus())
                  }}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input
                    ref={searchRef}
                    id="new-task-deal"
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar pela empresa…"
                    aria-invalid={Boolean(errors.dealId) || undefined}
                    aria-describedby={errors.dealId ? "new-task-deal-error" : undefined}
                    aria-controls="new-task-deal-results"
                    className="pl-9"
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        document.querySelector<HTMLElement>("#new-task-deal-results [role=option]")?.focus()
                      }
                      if (event.key === "Enter" && openDeals.length === 1) {
                        event.preventDefault()
                        pickDeal(openDeals[0])
                      }
                    }}
                  />
                </div>
                <DealResults
                  term={term}
                  isLoading={results.isLoading}
                  failed={results.error !== null}
                  deals={openDeals}
                  closedCount={closedCount}
                  onPick={pickDeal}
                />
              </>
            )}
            {errors.dealId && (
              <p id="new-task-deal-error" className="text-xs font-medium text-danger">
                {errors.dealId}
              </p>
            )}
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-2">
            <p id="new-task-type-label" className="text-sm font-medium text-fg">
              Tipo
            </p>
            <div ref={typeRef}>
              <ChoiceChips<ActivityType>
                id="new-task-type"
                label="Tipo da tarefa"
                value={type}
                onChange={setType}
                invalid={Boolean(errors.type)}
                options={NEXT_ACTION_TYPES.map((t) => ({ value: t, label: activityTypeLabels[t], icon: activityTypeIcons[t] }))}
              />
            </div>
            {errors.type && <p className="text-xs font-medium text-danger">{errors.type}</p>}
          </div>

          {/* Quando */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-task-due">
              Quando<span aria-hidden="true" className="text-muted">*</span>
            </Label>
            <div role="group" aria-label="Atalhos de prazo" className="flex flex-wrap gap-1.5">
              {shortcuts.map((shortcut) => {
                const value = toDateTimeInputValue(shortcut.date)
                return (
                  <button
                    key={shortcut.id}
                    type="button"
                    aria-pressed={due === value}
                    onClick={() => {
                      setDue(value)
                      setErrors((e) => ({ ...e, dueDate: undefined }))
                    }}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center rounded-xs border px-2.5 text-sm transition-colors focus-visible:focus-ring",
                      due === value
                        ? "border-accent/60 bg-accent/10 text-fg"
                        : "border-line-soft bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg"
                    )}
                  >
                    {shortcut.label}
                  </button>
                )
              })}
            </div>
            <Input
              id="new-task-due"
              type="datetime-local"
              value={due}
              min={toDateTimeInputValue(now)}
              onChange={(e) => setDue(e.target.value)}
              aria-invalid={Boolean(errors.dueDate) || undefined}
              aria-describedby={errors.dueDate ? "new-task-due-error" : undefined}
              className="w-full sm:w-64"
            />
            {errors.dueDate && (
              <p id="new-task-due-error" className="text-xs font-medium text-danger">
                {errors.dueDate}
              </p>
            )}
          </div>

          {/* Responsável */}
          {canAssign && assignees.length > 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-fg">Responsável</p>
              <ChoiceChips
                id="new-task-owner"
                label="Responsável"
                value={ownerUserId}
                onChange={setOwnerUserId}
                invalid={Boolean(errors.ownerUserId)}
                options={assignees}
              />
              {errors.ownerUserId && <p className="text-xs font-medium text-danger">{errors.ownerUserId}</p>}
            </div>
          )}
          {!canAssign && errors.ownerUserId && <p className="text-xs font-medium text-danger">{errors.ownerUserId}</p>}

          {/* Observação */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="new-task-note">Observação</Label>
              <span className={cn("text-xs tabular", note.length > MAX_NOTE - 50 ? "text-fg-muted" : "text-muted")} aria-live="polite">
                {note.length}/{MAX_NOTE}
              </span>
            </div>
            <Textarea
              id="new-task-note"
              rows={3}
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="O que fazer, em uma linha. Enter salva; Shift+Enter quebra a linha."
              aria-invalid={Boolean(errors.note) || undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
            />
            {errors.note && <p className="text-xs font-medium text-danger">{errors.note}</p>}
          </div>

          {errors.general && (
            <p role="alert" className="text-sm font-medium text-danger">
              {errors.general}
            </p>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {Object.values(errors).filter(Boolean).join(" ")}
          </p>

          <div className="mt-auto flex flex-col gap-3 border-t border-line-soft pt-4">
            {confirmDiscard ? (
              <div role="alertdialog" aria-label="Descartar a tarefa?" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-fg">Descartar o que você preencheu?</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setConfirmDiscard(false)}>
                    Continuar editando
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={onClose}>
                    Descartar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={requestClose}>
                  <X aria-hidden="true" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Criar tarefa
                </Button>
              </div>
            )}
          </div>
        </form>
      </SheetBody>
    </SheetContent>
  )
}

function DealResults({
  term,
  isLoading,
  failed,
  deals,
  closedCount,
  onPick,
}: {
  term: string
  isLoading: boolean
  failed: boolean
  deals: DealSearchHit[]
  closedCount: number
  onPick: (deal: DealSearchHit) => void
}) {
  if (term.length < MIN_SEARCH_LENGTH) {
    return <p className="text-xs text-muted">Digite ao menos {MIN_SEARCH_LENGTH} letras do nome da empresa.</p>
  }
  if (isLoading && deals.length === 0) return <p className="text-xs text-muted" role="status">Buscando…</p>
  if (failed) return <p className="text-xs text-danger" role="alert">A busca falhou. Tente de novo.</p>
  if (deals.length === 0) {
    return (
      <p className="text-xs text-muted" role="status">
        {closedCount > 0 ? "Só há negócios fechados com esse nome — tarefa precisa de negócio em aberto." : "Nenhum negócio com esse nome."}
      </p>
    )
  }

  return (
    <ul
      id="new-task-deal-results"
      role="listbox"
      aria-label="Negócios encontrados"
      className="flex flex-col overflow-hidden rounded-sm border border-line-soft"
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
        event.preventDefault()
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=option]")]
        const index = items.indexOf(document.activeElement as HTMLElement)
        items[Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus()
      }}
    >
      {deals.map((hit) => (
        <li
          key={hit.id}
          role="option"
          aria-selected={false}
          tabIndex={-1}
          onClick={() => onPick(hit)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onPick(hit)
          }}
          className="flex cursor-pointer items-center justify-between gap-3 border-b border-line-soft/60 px-3 py-2.5 outline-none last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{hit.companyName}</p>
            <p className="truncate text-xs text-muted">
              {stageLabels[hit.stage]}
              {hit.ownerUserName && ` · ${hit.ownerUserName}`}
            </p>
          </div>
          {hit.amount !== null && <span className="shrink-0 text-xs text-fg-muted tabular">{formatMoney(hit.amount)}</span>}
        </li>
      ))}
    </ul>
  )
}
