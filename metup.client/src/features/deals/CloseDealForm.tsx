import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChoiceChips } from "@/components/ui/choice-chips"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { InlineError } from "@/components/ui/states"
import { Textarea } from "@/components/ui/textarea"
import { toMessage } from "@/features/companies/form-errors"
import { formatMoney, parseMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { closeDeal, type Deal, type LostReason } from "./api"
import { LOST_NOTE_MAX_LENGTH, LOST_REASONS, lostReasonLabels } from "./stage-labels"
import { toMoneyInput, validateClose, type CloseOutcome } from "./close-deal"

/**
 * Confirmação de fechamento — o único formulário de ganho/perda do app. O `DealDrawer` o mostra na
 * seção "Fechar negócio" e o quadro, num diálogo, quando o cartão é solto em Ganho ou Perdido.
 * Ganho: valor fechado. Perdido: valor final, motivo (obrigatório) e observação curta.
 */
export function CloseDealForm({
  dealId,
  outcome,
  defaultAmount,
  onClosed,
  onCancel,
  idPrefix = "deal",
}: {
  dealId: string
  outcome: CloseOutcome
  /** Pré-preenchimento: o valor efetivo do negócio, sem a marca de estimado. */
  defaultAmount: number | null
  onClosed: (deal: Deal) => void
  onCancel: () => void
  /** Prefixo dos ids dos campos — o drawer e o diálogo podem coexistir na tela. */
  idPrefix?: string
}) {
  const [amount, setAmount] = useState(() => toMoneyInput(defaultAmount))
  const [lostReason, setLostReason] = useState<LostReason | "">("")
  const [lostNote, setLostNote] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reasonRef = useRef<HTMLDivElement>(null)
  const won = outcome === "won"

  async function confirm() {
    const invalid = validateClose(outcome, lostReason)
    if (invalid) {
      setReasonError(invalid)
      reasonRef.current?.querySelector<HTMLButtonElement>("[role=radio]")?.focus()
      return
    }

    setIsClosing(true)
    setError(null)
    try {
      const closed = won
        ? await closeDeal(dealId, true, parseMoney(amount))
        : await closeDeal(dealId, false, parseMoney(amount), lostReason || undefined, lostNote)
      onClosed(closed)
    } catch (err) {
      setError(toMessage(err, "Não foi possível fechar o negócio."))
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void confirm()
      }}
      className="flex flex-col gap-4"
    >
      <Field
        id={`${idPrefix}-closed-amount`}
        label={won ? "Valor fechado" : "Valor final"}
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        hint={amount ? formatMoney(parseMoney(amount)) : "Sem valor definido."}
        className="sm:max-w-xs"
      />

      {!won && (
        <>
          <div className="flex flex-col gap-2">
            <p id={`${idPrefix}-lost-reason-label`} className="text-sm font-medium text-fg">
              Motivo da perda
            </p>
            <div ref={reasonRef}>
              <ChoiceChips<LostReason>
                id={`${idPrefix}-lost-reason`}
                label="Motivo da perda"
                value={lostReason}
                onChange={(value) => {
                  setLostReason(value)
                  setReasonError(null)
                }}
                invalid={Boolean(reasonError)}
                describedBy={reasonError ? `${idPrefix}-lost-reason-error` : undefined}
                options={LOST_REASONS.map((reason) => ({ value: reason, label: lostReasonLabels[reason] }))}
              />
            </div>
            {reasonError && (
              <p id={`${idPrefix}-lost-reason-error`} role="alert" className="text-xs font-medium text-danger">
                {reasonError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:max-w-md">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={`${idPrefix}-lost-note`}>Observação (opcional)</Label>
              <span
                className={cn("text-xs tabular", lostNote.length > LOST_NOTE_MAX_LENGTH - 50 ? "text-fg-muted" : "text-muted")}
                aria-live="polite"
              >
                {lostNote.length}/{LOST_NOTE_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id={`${idPrefix}-lost-note`}
              rows={2}
              maxLength={LOST_NOTE_MAX_LENGTH}
              value={lostNote}
              onChange={(e) => setLostNote(e.target.value)}
              placeholder="Em uma linha: o que pesou na decisão."
            />
          </div>
        </>
      )}

      {error && <InlineError>{error}</InlineError>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant={won ? "default" : "destructive"} disabled={isClosing}>
          {isClosing && <Loader2 className="animate-spin" aria-hidden="true" />}
          Confirmar {won ? "ganho" : "perda"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isClosing} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/** O mesmo formulário num diálogo, para o quadro. Esc, "Cancelar" ou clique fora devolvem o cartão. */
export function CloseDealDialog({
  target,
  onClosed,
  onCancel,
}: {
  target: { dealId: string; companyName: string; outcome: CloseOutcome; defaultAmount: number | null } | null
  onClosed: (deal: Deal) => void
  onCancel: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      {target && (
        <DialogContent aria-describedby="close-deal-dialog-description">
          <DialogHeader>
            <DialogTitle>{target.outcome === "won" ? "Marcar como ganho" : "Marcar como perdido"}</DialogTitle>
            <DialogDescription id="close-deal-dialog-description">
              {target.companyName} ·{" "}
              {target.outcome === "won" ? "confirme o valor fechado." : "diga por que o negócio foi perdido."} Fechar tira o negócio do funil.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-5">
            <CloseDealForm
              key={`${target.dealId}-${target.outcome}`}
              dealId={target.dealId}
              outcome={target.outcome}
              defaultAmount={target.defaultAmount}
              onClosed={onClosed}
              onCancel={onCancel}
              idPrefix="board-close"
            />
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
