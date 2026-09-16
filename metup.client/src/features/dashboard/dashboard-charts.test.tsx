import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { DealSource } from "@/features/deals/api"
import type { SourceBreakdown } from "./api"
import { OriginBreakdown } from "./dashboard-charts"

function source(source: DealSource, newDeals: number, wonDeals = 0, revenue = 0): SourceBreakdown {
  return { source, newDeals, wonDeals, revenue }
}

function renderOrigins(sources: SourceBreakdown[]) {
  return render(
    <TooltipProvider>
      <OriginBreakdown sources={sources} />
    </TooltipProvider>
  )
}

describe("legenda das origens", () => {
  it("cada linha diz a origem e a fatia do período no nome acessível", () => {
    renderOrigins([source("Sdr", 6), source("WhatsApp", 2)])

    expect(screen.getByRole("button", { name: "SDR: 75% dos negócios do período" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "WhatsApp: 25% dos negócios do período" })).toBeInTheDocument()
  })

  it("percorre a legenda com as setas, sem precisar de mouse", async () => {
    renderOrigins([source("Sdr", 6), source("WhatsApp", 3), source("MetaAds", 1)])
    const [first, second, third] = screen.getAllByRole("button")

    first.focus()
    expect(first).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(second).toHaveFocus()

    await userEvent.keyboard("{ArrowDown}")
    expect(third).toHaveFocus()

    // Na última linha a seta para baixo não sai da lista.
    await userEvent.keyboard("{ArrowDown}")
    expect(third).toHaveFocus()

    await userEvent.keyboard("{ArrowUp}")
    expect(second).toHaveFocus()
  })

  it("o foco do teclado abre os mesmos detalhes que o ponteiro mostra", async () => {
    renderOrigins([source("Sdr", 6, 2, 12_000), source("WhatsApp", 2)])

    screen.getAllByRole("button")[0].focus()

    const details = await screen.findByRole("tooltip")
    expect(details).toHaveTextContent("Negócios no período")
    expect(details).toHaveTextContent("Taxa de ganho")
  })

  it("junta as origens menores numa fatia só quando passam do limite do donut", () => {
    renderOrigins([
      source("Sdr", 20),
      source("WhatsApp", 10),
      source("MetaAds", 8),
      source("Outbound", 6),
      source("Indicacao", 4),
      source("Site", 3),
      source("LinkedIn", 2),
      source("Evento", 1),
    ])

    expect(screen.getByRole("button", { name: /^Outras:/ })).toBeInTheDocument()
    // Oito origens não viram oito linhas: o donut tem teto e a sobra é agrupada.
    expect(screen.getAllByRole("button").length).toBeLessThan(8)
  })

  it("sem negócio novo, diz isso em vez de desenhar um donut mentiroso", () => {
    renderOrigins([])
    expect(screen.getByText("Nenhum negócio novo.")).toBeInTheDocument()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })
})
