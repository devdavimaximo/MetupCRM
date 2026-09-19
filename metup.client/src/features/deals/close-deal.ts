import type { LostReason } from "./api"

export type CloseOutcome = "won" | "lost"

/** Valor no formato que o campo aceita ("12000,50"): `String(12000.5)` viraria 120005 no `parseMoney`. */
export const toMoneyInput = (value: number | null) => (value === null ? "" : value.toFixed(2).replace(".", ","))

/** A regra do diálogo: perdido exige motivo. Devolve a mensagem do erro, ou null. */
export function validateClose(outcome: CloseOutcome, lostReason: LostReason | "") {
  return outcome === "lost" && lostReason === "" ? "Escolha o motivo da perda." : null
}
