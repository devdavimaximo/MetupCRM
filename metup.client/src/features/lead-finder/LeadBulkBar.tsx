import { useState } from "react"
import { Ban, Check, Loader2, PhoneCall, Undo2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { UserSummary } from "@/features/deals/api"
import { numberFormatter } from "@/lib/format"
import type { FoundLeadStatus } from "./api"

export type ImportOptions = { ownerUserId: string | null; scheduleCall: boolean }

export type BulkBusy = "import" | "dial" | "discard" | "restore" | null

/**
 * Aparece com leads selecionados (só da página atual). Importar abre um painel curto: responsável
 * (para quem enxerga a equipe) e "ligação para hoje" — o lead já cai na fila do SDR.
 */
export function LeadBulkBar({
  count,
  tab,
  busy,
  canAssignOthers,
  users,
  currentUserId,
  importOptions,
  onImportOptionsChange,
  onImport,
  onDial,
  onDiscard,
  onRestore,
  onClear,
}: {
  count: number
  tab: FoundLeadStatus
  busy: BulkBusy
  canAssignOthers: boolean
  users: UserSummary[]
  currentUserId: string
  importOptions: ImportOptions
  onImportOptionsChange: (options: ImportOptions) => void
  onImport: () => Promise<void>
  /** Importa (se preciso) para a própria carteira e abre o discador com o lote. Ausente = sem discador. */
  onDial?: () => void
  onDiscard: () => void
  onRestore: () => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const countText = `${numberFormatter.format(count)} ${count === 1 ? "selecionado" : "selecionados"}`
  const disabled = busy !== null

  return (
    <div
      role="region"
      aria-label="Ações em massa"
      className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-line-soft bg-surface-2/95 px-4 py-2.5 backdrop-blur-sm"
    >
      <p aria-live="polite" className="mr-2 text-sm font-medium text-fg tabular">
        {countText}
      </p>

      {tab !== "Imported" && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" disabled={disabled}>
              {busy === "import" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Importar para o pipeline
            </Button>
          </PopoverTrigger>
          <PopoverContent role="dialog" aria-label={`Importar ${countText}`} side="top" align="start" className="flex w-80 flex-col gap-4 p-4">
            <p className="text-sm text-fg">
              {count === 1 ? "O lead vira" : `Os ${numberFormatter.format(count)} leads viram`} empresa + negócio em{" "}
              <strong className="font-medium">Prospect</strong>, com origem <strong className="font-medium">Buscador de leads</strong>.
            </p>

            {canAssignOthers && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="import-owner">Responsável</Label>
                <Select
                  id="import-owner"
                  value={importOptions.ownerUserId ?? currentUserId}
                  onChange={(e) => onImportOptionsChange({ ...importOptions, ownerUserId: e.target.value === currentUserId ? null : e.target.value })}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.id === currentUserId ? `${user.name} (eu)` : user.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-fg">Agendar ligação para hoje</span>
                <span className="text-xs text-muted">Cada negócio novo entra na fila de tarefas de hoje.</span>
              </span>
              <Switch
                checked={importOptions.scheduleCall}
                onCheckedChange={(checked) => onImportOptionsChange({ ...importOptions, scheduleCall: checked })}
                aria-label="Agendar ligação para hoje"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={async () => {
                  await onImport()
                  setOpen(false)
                }}
              >
                {busy === "import" && <Loader2 className="animate-spin" aria-hidden="true" />}
                Importar {numberFormatter.format(count)}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {onDial && tab !== "Discarded" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onDial}
          title={tab === "Imported" ? "Abre o discador com estes negócios" : "Importa para a sua carteira, agenda a ligação de hoje e abre o discador"}
        >
          {busy === "dial" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PhoneCall aria-hidden="true" />}
          {tab === "Imported" ? "Discar" : "Importar e discar"}
        </Button>
      )}

      {tab === "New" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onDiscard}
          className="hover:border-danger hover:bg-danger/10 hover:text-danger"
        >
          {busy === "discard" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />}
          Descartar
        </Button>
      )}

      {tab === "Discarded" && (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onRestore}>
          {busy === "restore" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
          Restaurar
        </Button>
      )}

      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onClear} disabled={disabled}>
        <X aria-hidden="true" />
        Limpar seleção
      </Button>
    </div>
  )
}
