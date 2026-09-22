import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ConversationListItem } from "./api"
import { ConversationList } from "./ConversationList"

const base: ConversationListItem = {
  id: "c1",
  contactId: "ct1",
  contactName: "Ana Paula",
  companyId: "co1",
  companyName: "Tech Solutions",
  lastMessagePreview: "Olá, tudo bem?",
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  channel: "WhatsApp",
  status: "Aberta",
  isUnread: false,
  isFavorite: false,
  tags: [],
}

function renderList(overrides: Partial<React.ComponentProps<typeof ConversationList>> = {}) {
  const props: React.ComponentProps<typeof ConversationList> = {
    conversations: [base],
    totalCount: 1,
    selectedId: null,
    search: "",
    tab: "all",
    counts: { total: 12, unread: 3, favorite: 1 },
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    onSearchChange: vi.fn(),
    onTabChange: vi.fn(),
    onSelect: vi.fn(),
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ConversationList {...props} />) }
}

describe("badge de não lida", () => {
  it("aparece quando a conversa está não lida e some quando está lida", () => {
    const { rerender, props } = renderList({ conversations: [{ ...base, isUnread: true }] })
    expect(screen.getByText("Não lida")).toBeInTheDocument()

    rerender(<ConversationList {...props} conversations={[{ ...base, isUnread: false }]} />)
    expect(screen.queryByText("Não lida")).not.toBeInTheDocument()
  })

  it("a estrela só aparece quando a conversa é favorita", () => {
    renderList({ conversations: [{ ...base, isFavorite: true }] })
    expect(screen.getByText("Favorita")).toBeInTheDocument()
  })
})

describe("abas", () => {
  it("mostra a contagem de cada aba vinda do resumo", () => {
    renderList()
    expect(screen.getByRole("tab", { name: /Todas/ })).toHaveTextContent("12")
    expect(screen.getByRole("tab", { name: /Não lidas/ })).toHaveTextContent("3")
    expect(screen.getByRole("tab", { name: /Favoritas/ })).toHaveTextContent("1")
  })

  it("clicar numa aba avisa qual recorte foi escolhido", async () => {
    const user = userEvent.setup()
    const onTabChange = vi.fn()
    renderList({ onTabChange })

    await user.click(screen.getByRole("tab", { name: /Não lidas/ }))
    expect(onTabChange).toHaveBeenCalledWith("unread")

    await user.click(screen.getByRole("tab", { name: /Favoritas/ }))
    expect(onTabChange).toHaveBeenCalledWith("favorite")
  })
})
