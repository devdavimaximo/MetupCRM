import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import * as dealsApi from "./api"
import type { Deal } from "./api"
import { toMoneyInput, validateClose } from "./close-deal"
import { CloseDealForm } from "./CloseDealForm"

const closeDeal = vi.spyOn(dealsApi, "closeDeal")

afterEach(() => closeDeal.mockReset())

const closed = { id: "d1", status: "Perdido" } as Deal

describe("regra do fechamento", () => {
  it("perdido sem motivo é recusado; ganho não pede motivo", () => {
    expect(validateClose("lost", "")).toBe("Escolha o motivo da perda.")
    expect(validateClose("lost", "Preco")).toBeNull()
    expect(validateClose("won", "")).toBeNull()
  })

  it("o valor pré-preenchido volta igual pelo parseMoney (sem virar 120005)", () => {
    expect(toMoneyInput(12000.5)).toBe("12000,50")
    expect(toMoneyInput(null)).toBe("")
  })
})

describe("diálogo de fechamento", () => {
  it("perdido: sem motivo não chama o servidor, mostra o erro e foca o grupo", async () => {
    const user = userEvent.setup()
    render(<CloseDealForm dealId="d1" outcome="lost" defaultAmount={5000} onClosed={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Confirmar perda" }))

    expect(closeDeal).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha o motivo da perda.")
    expect(screen.getByRole("radiogroup", { name: "Motivo da perda" })).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("radio", { name: "Preço" })).toHaveFocus()
  })

  it("perdido com motivo e observação envia os dois", async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    closeDeal.mockResolvedValue(closed)
    render(<CloseDealForm dealId="d1" outcome="lost" defaultAmount={5000} onClosed={onClosed} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("radio", { name: "Concorrente" }))
    await user.type(screen.getByLabelText("Observação (opcional)"), "Fechou com outro")
    expect(screen.getByText("16/280")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirmar perda" }))

    expect(closeDeal).toHaveBeenCalledWith("d1", false, 5000, "Concorrente", "Fechou com outro")
    expect(onClosed).toHaveBeenCalledWith(closed)
  })

  it("ganho vem com o valor efetivo e não mostra motivo", async () => {
    const user = userEvent.setup()
    closeDeal.mockResolvedValue({ ...closed, status: "Ganho" })
    render(<CloseDealForm dealId="d1" outcome="won" defaultAmount={12000.5} onClosed={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText("Valor fechado")).toHaveValue("12000,50")
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirmar ganho" }))
    expect(closeDeal).toHaveBeenCalledWith("d1", true, 12000.5)
  })

  it("cancelar não chama o servidor", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<CloseDealForm dealId="d1" outcome="lost" defaultAmount={null} onClosed={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(onCancel).toHaveBeenCalled()
    expect(closeDeal).not.toHaveBeenCalled()
  })
})
