import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConversationMenu } from "./ConversationMenu"

function renderMenu(overrides: Partial<React.ComponentProps<typeof ConversationMenu>> = {}) {
  const props: React.ComponentProps<typeof ConversationMenu> = {
    contactName: "Ana Paula",
    status: "Aberta",
    isFavorite: false,
    dealId: "deal-1",
    companyId: "company-1",
    onMarkUnread: vi.fn(),
    onToggleFavorite: vi.fn(),
    onChangeStatus: vi.fn(),
    onOpenDeal: vi.fn(),
    onOpenCompany: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ConversationMenu {...props} />) }
}

describe("submenu de status", () => {
  it("marca o status atual como desabilitado e não dispara ao selecioná-lo", async () => {
    const user = userEvent.setup()
    const onChangeStatus = vi.fn()
    renderMenu({ status: "Pendente", onChangeStatus })

    await user.click(screen.getByRole("button", { name: /Ações de Ana Paula/ }))
    await user.click(screen.getByText("Status"))

    // Radix ignora o clique num item desabilitado — a prova aqui é o atributo, não o clique.
    expect(screen.getByRole("menuitem", { name: /Pendente/ })).toHaveAttribute("aria-disabled", "true")

    // `fireEvent` em vez de `user.click`: o hover simulado pelo user-event, sem geometria real no
    // jsdom, faz o Radix fechar o submenu antes do clique valer (heurística de "saiu da área segura").
    fireEvent.click(screen.getByRole("menuitem", { name: "Resolvida" }))
    expect(onChangeStatus).toHaveBeenCalledWith("Resolvida")
    expect(onChangeStatus).not.toHaveBeenCalledWith("Pendente")
  })
})

describe("favoritar e marcar como não lida", () => {
  it("rótulo do favorito muda conforme isFavorite e chama o callback", async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()
    renderMenu({ isFavorite: true, onToggleFavorite })

    await user.click(screen.getByRole("button", { name: /Ações de Ana Paula/ }))
    await user.click(screen.getByText("Desfavoritar"))

    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
  })

  it("marcar como não lida chama o callback", async () => {
    const user = userEvent.setup()
    const onMarkUnread = vi.fn()
    renderMenu({ onMarkUnread })

    await user.click(screen.getByRole("button", { name: /Ações de Ana Paula/ }))
    await user.click(screen.getByText("Marcar como não lida"))

    expect(onMarkUnread).toHaveBeenCalledTimes(1)
  })
})

describe("abrir negócio e empresa", () => {
  it("some 'Abrir negócio' sem dealId, e 'Abrir empresa' sempre chama com o companyId", async () => {
    const user = userEvent.setup()
    const onOpenCompany = vi.fn()
    renderMenu({ dealId: null, onOpenCompany })

    await user.click(screen.getByRole("button", { name: /Ações de Ana Paula/ }))
    expect(screen.queryByText("Abrir negócio")).not.toBeInTheDocument()

    await user.click(screen.getByText("Abrir empresa"))
    expect(onOpenCompany).toHaveBeenCalledWith("company-1")
  })
})
