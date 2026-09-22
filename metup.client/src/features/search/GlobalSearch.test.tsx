import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import * as searchApi from "./api"
import type { SearchResult } from "./api"
import { GlobalSearch } from "./GlobalSearch"

const emptyResult: SearchResult = { companies: [], contacts: [], deals: [], conversations: [] }

function renderSearch(overrides: Partial<React.ComponentProps<typeof GlobalSearch>> = {}) {
  const props: React.ComponentProps<typeof GlobalSearch> = {
    open: true,
    onOpenChange: vi.fn(),
    onNavigate: vi.fn(),
    onOpenCompany: vi.fn(),
    onOpenDeal: vi.fn(),
    onOpenConversation: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<GlobalSearch {...props} />) }
}

describe("grupo Conversas", () => {
  it("mostra as conversas encontradas e abre a conversa selecionada", async () => {
    const user = userEvent.setup()
    const onOpenConversation = vi.fn()
    const onOpenChange = vi.fn()
    vi.spyOn(searchApi, "search").mockResolvedValue({
      ...emptyResult,
      conversations: [{ id: "conv-1", contactName: "Ana Paula", companyName: "Tech Solutions", lastMessagePreview: "Olá, tudo bem?" }],
    })

    renderSearch({ onOpenConversation, onOpenChange })

    await user.type(screen.getByRole("combobox"), "ana")

    const group = await waitFor(() => screen.getByRole("group", { name: "Conversas" }))
    expect(within(group).getByText("Ana Paula")).toBeInTheDocument()

    await user.click(within(group).getByText("Ana Paula"))

    expect(onOpenConversation).toHaveBeenCalledWith("conv-1")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("sem resultado, o grupo Conversas não aparece", async () => {
    const user = userEvent.setup()
    vi.spyOn(searchApi, "search").mockResolvedValue(emptyResult)

    renderSearch()
    await user.type(screen.getByRole("combobox"), "zzz")

    await waitFor(() => expect(searchApi.search).toHaveBeenCalled())
    expect(screen.queryByRole("group", { name: "Conversas" })).not.toBeInTheDocument()
  })
})
