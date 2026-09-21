import type { Page, WebSocketRoute } from "@playwright/test"

import type { RealtimeEvent } from "@/lib/realtime"

/** Separador de mensagens do protocolo JSON do SignalR. */
const RS = "\u001e"

/**
 * Um hub SignalR dublado: responde o `negotiate` e fala o protocolo JSON pelo WebSocket, então o
 * cliente de verdade (`lib/realtime.ts`) conecta e recebe os eventos como em produção. Deve ser
 * instalado **depois** do `installApi` (que corta o hub): no Playwright vale a rota mais recente.
 *
 * `send` empurra um evento para a tela; `connected` espera o aperto de mão terminar.
 */
export async function installHub(page: Page) {
  let socket: WebSocketRoute | null = null
  let ready: () => void = () => undefined
  const connected = new Promise<void>((resolve) => (ready = resolve))

  await page.route("**/hubs/dashboard/negotiate**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        negotiateVersion: 1,
        connectionId: "e2e",
        connectionToken: "e2e",
        availableTransports: [{ transport: "WebSockets", transferFormats: ["Text", "Binary"] }],
      }),
    })
  )

  await page.routeWebSocket(/\/hubs\/dashboard/, (ws) => {
    socket = ws
    ws.onMessage((message) => {
      // O primeiro pacote é o aperto de mão ({"protocol":"json",...}); a resposta vazia o aceita.
      if (String(message).includes('"protocol"')) {
        ws.send(`{}${RS}`)
        ready()
      }
    })
  })

  return {
    connected,
    send(event: RealtimeEvent) {
      if (!socket) throw new Error("O cliente ainda não abriu o WebSocket do hub.")
      socket.send(JSON.stringify({ type: 1, target: "event", arguments: [event] }) + RS)
    },
    /** Derruba a conexão: o cliente passa a "Reconectando…" e revalida ao voltar. */
    drop() {
      void socket?.close()
    },
  }
}
