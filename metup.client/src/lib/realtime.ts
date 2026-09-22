import { useEffect, useRef, useSyncExternalStore } from "react"
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr"

import { API_URL } from "@/lib/api"
import { getSession } from "@/lib/auth"

/** Tipos que o servidor manda pelo hub. `revalidate` é local: reconectou, voltou o foco ou passou o intervalo sem conexão. */
export type RealtimeEventType =
  | "deal.created"
  | "deal.stageChanged"
  | "deal.closed"
  | "activity.logged"
  | "task.completed"
  | "conversation.messageReceived"
  | "conversation.messageSent"
  | "conversation.statusChanged"
  | "conversation.favorited"
  | "revalidate"

/** Só o que mudou e onde: as telas refazem as próprias queries, que aplicam o escopo de quem vê. */
export type RealtimeEvent = {
  type: RealtimeEventType
  dealId: string | null
  ownerUserId: string | null
  conversationId?: string | null
}

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "disconnected"

const HUB_PATH = "/hubs/dashboard"
/** Sem conexão, as telas revalidam a cada 60s. */
const OFFLINE_REVALIDATE_MS = 60_000

type Listener = (event: RealtimeEvent) => void

/**
 * Uma conexão só para o app inteiro, aberta enquanto houver alguém ouvindo. Reconecta sozinha, para
 * sempre, com espera crescente até 30s. Enquanto não está conectada, avisa as telas para revalidarem
 * ao voltar o foco da aba e a cada 60s. Ao reconectar, pede uma revalidação.
 */
class RealtimeClient {
  private connection: HubConnection | null = null
  private status: RealtimeStatus = "disconnected"
  private readonly listeners = new Set<Listener>()
  private readonly statusListeners = new Set<() => void>()
  private retryTimer: number | undefined
  private offlineTimer: number | undefined
  private retryAttempt = 0

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  subscribeStatus = (onChange: () => void) => {
    this.statusListeners.add(onChange)
    return () => this.statusListeners.delete(onChange)
  }

  getStatus = () => this.status

  private emit(event: RealtimeEvent) {
    for (const listener of [...this.listeners]) listener(event)
  }

  private setStatus(status: RealtimeStatus) {
    if (status === this.status) return
    this.status = status
    for (const onChange of [...this.statusListeners]) onChange()

    window.clearInterval(this.offlineTimer)
    if (status === "reconnecting" || status === "disconnected") {
      this.offlineTimer = window.setInterval(() => this.revalidate(), OFFLINE_REVALIDATE_MS)
    }
  }

  private revalidate = () => this.emit({ type: "revalidate", dealId: null, ownerUserId: null })

  private handleVisibility = () => {
    if (document.visibilityState === "visible" && this.status !== "connected") this.revalidate()
  }

  private start() {
    if (this.connection) return
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}${HUB_PATH}`, {
        // WebSocket não leva header: o JWT vai como access_token, lido fresco a cada (re)conexão.
        accessTokenFactory: () => getSession()?.token ?? "",
        withCredentials: false,
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (context) => Math.min(30_000, 1_000 * 2 ** context.previousRetryCount) })
      .configureLogging(LogLevel.None)
      .build()

    connection.on("event", (message: RealtimeEvent) => this.emit(message))
    connection.onreconnecting(() => this.setStatus("reconnecting"))
    connection.onreconnected(() => {
      this.setStatus("connected")
      this.revalidate()
    })
    // A reconexão automática desistiu (ou a primeira conexão caiu): tenta de novo por conta própria.
    connection.onclose(() => {
      if (this.connection !== connection) return
      this.setStatus("reconnecting")
      this.scheduleRetry(connection)
    })

    this.connection = connection
    document.addEventListener("visibilitychange", this.handleVisibility)
    this.setStatus("connecting")
    void this.connect(connection)
  }

  private async connect(connection: HubConnection) {
    try {
      await connection.start()
      if (this.connection !== connection) return
      this.retryAttempt = 0
      this.setStatus("connected")
    } catch {
      if (this.connection !== connection) return
      this.setStatus("reconnecting")
      this.scheduleRetry(connection)
    }
  }

  private scheduleRetry(connection: HubConnection) {
    window.clearTimeout(this.retryTimer)
    const delay = Math.min(30_000, 1_000 * 2 ** this.retryAttempt++)
    this.retryTimer = window.setTimeout(() => {
      if (this.connection === connection && connection.state === HubConnectionState.Disconnected) void this.connect(connection)
    }, delay)
  }

  private stop() {
    const connection = this.connection
    this.connection = null
    window.clearTimeout(this.retryTimer)
    document.removeEventListener("visibilitychange", this.handleVisibility)
    this.setStatus("disconnected")
    window.clearInterval(this.offlineTimer)
    void connection?.stop()
  }
}

const client = new RealtimeClient()

/** Estado da conexão para o indicador ("Atualização em tempo real" / "Reconectando…"). */
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(client.subscribeStatus, client.getStatus, client.getStatus)
}

/**
 * Assina os eventos do hub (e as revalidações locais) enquanto o componente estiver montado. O
 * handler mais recente é sempre o usado, sem reassinar a cada render.
 */
export function useRealtime(handler: (event: RealtimeEvent) => void) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => client.subscribe((event) => handlerRef.current(event)), [])
}
