import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { Message } from "./api"
import { MessageThread } from "./MessageThread"

const base: Message = {
  id: "m1",
  conversationId: "c1",
  direction: "Outbound",
  body: "Olá!",
  authorUserId: null,
  authorUserName: null,
  dealId: null,
  dealStageAtMessage: null,
  occurredAt: new Date().toISOString(),
  authorKind: null,
  attachments: [],
}

function renderThread(messages: Message[]) {
  return render(
    <TooltipProvider>
      <MessageThread conversationId="c1" messages={messages} isLoading={false} error={null} onMessageSent={vi.fn()} />
    </TooltipProvider>
  )
}

describe("autoria da mensagem outbound", () => {
  it("authorKind Bot mostra 'Assistente Metup', não o nome de um usuário", () => {
    renderThread([{ ...base, id: "m1", authorKind: "Bot", authorUserName: null }])
    expect(screen.getByText(/Assistente Metup/)).toBeInTheDocument()
  })

  it("authorKind Sdr mostra o nome de quem enviou", () => {
    renderThread([{ ...base, id: "m2", authorKind: "Sdr", authorUserName: "Davi Máximo" }])
    expect(screen.getByText(/Davi Máximo/)).toBeInTheDocument()
    expect(screen.queryByText(/Assistente Metup/)).not.toBeInTheDocument()
  })

  it("mensagem antiga sem authorKind (pré-C1) continua mostrando o autor humano", () => {
    renderThread([{ ...base, id: "m3", authorKind: null, authorUserName: "Davi Máximo" }])
    expect(screen.getByText(/Davi Máximo/)).toBeInTheDocument()
  })
})
