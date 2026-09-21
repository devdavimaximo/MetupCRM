/**
 * O quadro do Pipeline dublado **com estado**: mover, fechar e o 409 mudam a loja, e o quadro e as
 * colunas seguintes refletem isso — com as mesmas regras do servidor (contagem e soma da coluna
 * inteira, `perColumn` 20, Fechados só no período, `expectedFromStage`).
 *
 * O relógio do navegador fica em `NOW` (terça, 15/09/2026, 15:00) por `gotoPipeline`; o período
 * padrão de Fechados é 17/08–15/09.
 */

import type { Route } from "@playwright/test"

import type {
  Deal,
  DealBoard,
  DealBoardCard,
  DealBoardColumn,
  DealSource,
  DealStage,
  LostReason,
  PipelineInsights,
  PipelineSummary,
} from "@/features/deals/api"
import type { Handler } from "./app"
import { NOW } from "./tasks"

const OWNER = { id: "11111111-1111-1111-1111-111111111111", name: "Davi Maximo" }

/** Os mesmos responsáveis de `data.users`, para a reatribuição devolver um nome de verdade. */
const OWNERS: Record<string, string> = { "u-1": "Davi Maximo", "u-2": "Ana Prado", [OWNER.id]: OWNER.name }
const at = (localIso: string) => new Date(`${localIso}-03:00`).toISOString()

const ACTIVE: DealStage[] = ["Prospect", "PrimeiroContato", "ContatoRealizado", "Qualificacao", "Reuniao", "Proposta", "Negociacao"]
const SEGMENTS = ["Varejo", "Saúde", "Serviços"]
const SOURCES: DealSource[] = ["Sdr", "WhatsApp", "MetaAds"]

export function boardCard(patch: Partial<DealBoardCard> = {}): DealBoardCard {
  return {
    id: "deal-x",
    companyId: "company-x",
    companyName: "Empresa X",
    companySegment: "Varejo",
    contactName: null,
    stage: "Prospect",
    status: "Aberto",
    source: "Sdr",
    ownerUserId: OWNER.id,
    ownerUserName: OWNER.name,
    value: 5000,
    valueIsEstimated: false,
    stageEnteredAt: at("2026-09-10T10:00:00"),
    daysInStage: 5,
    isStalled: false,
    lastActivityAt: at("2026-09-15T10:00:00"),
    nextTask: { type: "Call", dueDate: at("2026-09-16T10:00:00"), isOverdue: false },
    expectedCloseDate: null,
    closedAt: null,
    lostReason: null,
    ...patch,
  }
}

function seed(): DealBoardCard[] {
  const prospects = Array.from({ length: 30 }, (_, i) =>
    boardCard({
      id: `p-${i + 1}`,
      companyId: `company-p-${i + 1}`,
      companyName: `Prospect ${String(i + 1).padStart(2, "0")}`,
      companySegment: SEGMENTS[i % 3],
      source: SOURCES[i % 3],
      value: 1000 + i * 100,
    })
  )

  return [
    ...prospects,
    boardCard({ id: "pc-1", companyName: "Padaria Aurora", stage: "PrimeiroContato", value: 8000, companySegment: "Varejo" }),
    boardCard({ id: "pc-2", companyName: "Mercado Bonfim", stage: "PrimeiroContato", value: null, companySegment: null, source: "WhatsApp" }),
    // Contato Realizado fica vazia: "Solte aqui".
    boardCard({
      id: "q-1",
      companyName: "Tech Solutions",
      stage: "Qualificacao",
      value: 12_000,
      valueIsEstimated: true,
      isStalled: true,
      daysInStage: 12,
      stageEnteredAt: at("2026-09-03T10:00:00"),
      lastActivityAt: null,
      nextTask: { type: "Call", dueDate: at("2026-09-14T10:00:00"), isOverdue: true },
      companySegment: "Serviços",
    }),
    boardCard({ id: "q-2", companyName: "Ótica Lumen", stage: "Qualificacao", value: 3000, nextTask: null, companySegment: "Saúde" }),
    boardCard({ id: "r-1", companyName: "Auto Center Sul", stage: "Reuniao", value: 20_000 }),
    boardCard({ id: "pr-1", companyName: "Studio Forma", stage: "Proposta", value: 15_000 }),
    boardCard({ id: "n-1", companyName: "Clínica Vida", stage: "Negociacao", value: 30_000, companySegment: "Saúde" }),
    boardCard({ id: "n-2", companyName: "Pet Feliz", stage: "Negociacao", value: 9000, valueIsEstimated: true }),
    boardCard({ id: "w-1", companyName: "Farmácia Central", stage: "Ganho", status: "Ganho", value: 40_000, closedAt: at("2026-09-10T16:00:00"), nextTask: null }),
    boardCard({ id: "w-2", companyName: "Livraria Nobre", stage: "Ganho", status: "Ganho", value: 7000, closedAt: at("2026-08-20T16:00:00"), nextTask: null }),
    // Fora do período padrão: não aparece.
    boardCard({ id: "w-old", companyName: "Antiga Ganha", stage: "Ganho", status: "Ganho", value: 1, closedAt: at("2026-06-01T16:00:00"), nextTask: null }),
    boardCard({
      id: "l-1",
      companyName: "Bistrô Sabor",
      stage: "Perdido",
      status: "Perdido",
      value: 5000,
      closedAt: at("2026-09-12T16:00:00"),
      lostReason: "Preco",
      nextTask: null,
    }),
  ]
}

/**
 * Resumo do pipeline (KPIs, sparklines e funil). Números redondos de propósito: os testes conferem
 * o valor compacto ("R$ 2,86 mi") e a conversão em coorte da frase do funil.
 */
export function pipelineSummary(patch: Partial<PipelineSummary> = {}): PipelineSummary {
  const stages: DealStage[] = [...ACTIVE, "Ganho"]
  return {
    ownerUserId: null,
    periodStartLocal: "2026-08-17",
    periodEndLocal: "2026-09-15",
    snapshotAt: at("2026-09-15T15:00:00"),
    kpis: {
      pipelineTotal: 2_860_000,
      forecastRevenue: 184_200,
      openDeals: 42,
      conversionRate: 0.08,
      averageTicket: 12_400,
    },
    previous: {
      pipelineTotal: 2_600_000,
      forecastRevenue: 200_000,
      openDeals: 40,
      conversionRate: 0.1,
      averageTicket: 10_000,
    },
    sparklines: {
      granularity: "day",
      bucketStarts: Array.from({ length: 5 }, (_, i) => `2026-09-1${i}`),
      pipelineTotal: [2_500_000, 2_600_000, 2_700_000, 2_800_000, 2_860_000],
      forecastRevenue: [150_000, 160_000, 170_000, 180_000, 184_200],
      openDeals: [38, 39, 40, 41, 42],
      conversionRate: [0.05, 0.06, 0.07, 0.08, 0.08],
      averageTicket: [9_000, 10_000, 11_000, 12_000, 12_400],
    },
    funnel: stages.map((stage, i) => ({
      stage,
      reached: 342 - i * 40,
      value: (342 - i * 40) * 1000,
      pctOfTop: (342 - i * 40) / 342,
    })),
    funnelSummary: { top: 342, won: 27, pct: 0.08 },
    ...patch,
  }
}

const problem = (route: Route, status: number, title: string, extra: Record<string, unknown> = {}) =>
  route.fulfill({ status, contentType: "application/problem+json", body: JSON.stringify({ title, status, ...extra }) })

export class BoardStore {
  cards: DealBoardCard[] = seed()
  boardRequests: URLSearchParams[] = []
  columnRequests: URLSearchParams[] = []
  stageRequests: { id: string; stage: DealStage; expectedFromStage: DealStage | null; view: string | null }[] = []
  closeRequests: { id: string; won: boolean; closedAmount: number | null; lostReason: LostReason | null; lostNote: string | null }[] = []
  /** Outro usuário move este negócio para esta etapa logo antes do próximo pedido chegar (→ 409). */
  movedByOther = new Map<string, DealStage>()
  /** O próximo pedido de etapa falha com 500. */
  failNextStage = false
  reassignRequests: { id: string; ownerUserId: string }[] = []
  summaryRequests: URLSearchParams[] = []
  insightsRequests: URLSearchParams[] = []
  evolutionRequests: number[] = []

  toDeal(card: DealBoardCard): Deal {
    return {
      id: card.id,
      companyId: card.companyId,
      companyName: card.companyName,
      contactId: null,
      contactName: card.contactName,
      stage: card.stage,
      source: card.source,
      ownerUserId: card.ownerUserId,
      ownerUserName: card.ownerUserName,
      ticket: card.valueIsEstimated ? card.value : null,
      amount: card.valueIsEstimated ? null : card.value,
      expectedCloseDate: card.expectedCloseDate,
      status: card.status,
      createdAt: at("2026-09-01T10:00:00"),
      closedAt: card.closedAt,
      stageHistory: [],
      lostReason: card.lostReason,
      lostNote: null,
      value: card.value,
      valueIsEstimated: card.valueIsEstimated,
    }
  }

  private matches(card: DealBoardCard, params: URLSearchParams) {
    const sources = params.getAll("sources")
    const segments = params.getAll("segments")
    const search = params.get("search")?.toLowerCase()
    return (
      (sources.length === 0 || sources.includes(card.source)) &&
      (segments.length === 0 || (card.companySegment !== null && segments.includes(card.companySegment))) &&
      (!search || card.companyName.toLowerCase().includes(search)) &&
      // `parados=1` (item 17): só os abertos com o selo de parado.
      (params.get("stalledOnly") !== "true" || card.isStalled)
    )
  }

  private inPeriod(card: DealBoardCard, params: URLSearchParams) {
    const day = card.closedAt ? new Date(new Date(card.closedAt).getTime() - 3 * 3_600_000).toISOString().slice(0, 10) : ""
    return day >= (params.get("from") ?? "2026-08-17") && day <= (params.get("to") ?? "2026-09-15")
  }

  private column(stage: DealStage, cards: DealBoardCard[], page: number, perColumn: number): DealBoardColumn {
    const start = (page - 1) * perColumn
    return {
      stage,
      count: cards.length,
      total: cards.reduce((sum, c) => sum + (c.value ?? 0), 0),
      totalHasEstimate: cards.some((c) => c.valueIsEstimated),
      page,
      items: cards.slice(start, start + perColumn),
      hasMore: start + perColumn < cards.length,
    }
  }

  private cardsFor(key: DealStage | "won" | "lost", params: URLSearchParams) {
    const visible = this.cards.filter((c) => this.matches(c, params))
    if (key === "won") return visible.filter((c) => c.status === "Ganho" && this.inPeriod(c, params))
    if (key === "lost") return visible.filter((c) => c.status === "Perdido" && this.inPeriod(c, params))
    return visible.filter((c) => c.status === "Aberto" && c.stage === key)
  }

  board: Handler = (route) => {
    const params = new URL(route.request().url()).searchParams
    this.boardRequests.push(params)
    const perColumn = Number(params.get("perColumn") ?? 20)
    const body: DealBoard = {
      ownerUserId: params.get("allOwners") ? null : (params.get("ownerUserId") ?? OWNER.id),
      periodStartLocal: params.get("from") ?? "2026-08-17",
      periodEndLocal: params.get("to") ?? "2026-09-15",
      sort: (params.get("sort") as DealBoard["sort"]) ?? "Stalled",
      columns: ACTIVE.map((stage) => this.column(stage, this.cardsFor(stage, params), 1, perColumn)),
      closed: {
        won: this.column("Ganho", this.cardsFor("won", params), 1, perColumn),
        lost: this.column("Perdido", this.cardsFor("lost", params), 1, perColumn),
      },
    }
    return body
  }

  boardColumn: Handler = (route) => {
    const params = new URL(route.request().url()).searchParams
    this.columnRequests.push(params)
    const closed = params.get("closed") as "won" | "lost" | null
    const stage = params.get("stage") as DealStage | null
    const key = closed ?? stage!
    const label: DealStage = closed === "won" ? "Ganho" : closed === "lost" ? "Perdido" : stage!
    return this.column(label, this.cardsFor(key, params), Number(params.get("page") ?? 1), Number(params.get("perColumn") ?? 20))
  }

  stage: Handler = async (route) => {
    const url = new URL(route.request().url())
    const id = url.pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as { stage: DealStage; expectedFromStage: DealStage | null }
    this.stageRequests.push({ id, ...body, view: url.searchParams.get("view") })

    if (this.failNextStage) {
      this.failNextStage = false
      return problem(route, 500, "O servidor não respondeu.")
    }

    const card = this.cards.find((c) => c.id === id)
    if (!card) return problem(route, 404, "Negócio não encontrado.")

    const other = this.movedByOther.get(id)
    if (other) {
      this.movedByOther.delete(id)
      card.stage = other
    }
    if (card.status === "Aberto" && card.stage === body.stage) return card
    if (body.expectedFromStage && card.stage !== body.expectedFromStage) {
      return problem(route, 409, "O negócio mudou de etapa.", { current: this.toDeal(card) })
    }

    card.stage = body.stage
    card.stageEnteredAt = new Date(NOW).toISOString()
    card.daysInStage = 0
    card.isStalled = false
    return card
  }

  close: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as BoardStore["closeRequests"][number]
    this.closeRequests.push({ ...body, id })
    const card = this.cards.find((c) => c.id === id)
    if (!card) return problem(route, 404, "Negócio não encontrado.")
    if (!body.won && !body.lostReason) {
      return problem(route, 400, "Dados inválidos.", { errors: { LostReason: ["Informe o motivo da perda."] } })
    }

    card.status = body.won ? "Ganho" : "Perdido"
    card.stage = body.won ? "Ganho" : "Perdido"
    card.closedAt = new Date(NOW).toISOString()
    card.value = body.closedAmount
    card.valueIsEstimated = false
    card.lostReason = body.lostReason
    card.nextTask = null
    return { ...this.toDeal(card), lostNote: body.lostNote }
  }

  /** Reatribuir (item 15 da PL3): troca o dono na loja e devolve o cartão, como o `?view=card`. */
  reassign: Handler = (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const body = JSON.parse(route.request().postData() ?? "{}") as { ownerUserId: string }
    this.reassignRequests.push({ id, ownerUserId: body.ownerUserId })

    const card = this.cards.find((c) => c.id === id)
    if (!card) return problem(route, 404, "Negócio não encontrado.")
    if (card.status !== "Aberto") return problem(route, 422, "O negócio já está fechado.")

    card.ownerUserId = body.ownerUserId
    card.ownerUserName = OWNERS[body.ownerUserId] ?? card.ownerUserName
    return card
  }

  /** `GET /api/deals/{id}/card`: o cartão como está agora na loja. */
  /** Quantas vezes a tela releu um cartão (revalidação e tempo real). */
  cardRequests = 0

  card: Handler = (route) => {
    this.cardRequests++
    const id = new URL(route.request().url()).pathname.split("/").at(-2)!
    const card = this.cards.find((c) => c.id === id)
    return card ?? problem(route, 404, "Negócio não encontrado.")
  }

  /** KPIs, funil e o resumo — números fixos, o bastante para a tela e para as asserções. */
  summary: Handler = (route) => {
    this.summaryRequests.push(new URL(route.request().url()).searchParams)
    return pipelineSummary()
  }

  insights: Handler = (route) => {
    this.insightsRequests.push(new URL(route.request().url()).searchParams)
    return this.insightsBody
  }

  insightsBody: PipelineInsights = {
    ownerUserId: null,
    windowStartLocal: "2026-08-17",
    windowEndLocal: "2026-09-15",
    volume: { stage: "Qualificacao", entered: 18, totalEntered: 56, pctOfTotal: 0.321, tied: [] },
    bestPassage: { fromStage: "Qualificacao", toStage: "Reuniao", entered: 5, advanced: 4, rate: 0.8, tied: [] },
    risk: { count: 3, value: 84_000, stalledAfterDays: 7 },
  }

  evolution: Handler = (route) => {
    const months = Number(new URL(route.request().url()).searchParams.get("months") ?? 6)
    this.evolutionRequests.push(months)
    return {
      ownerUserId: null,
      points: Array.from({ length: months }, (_, i) => ({
        month: `2026-${String(i + 4).padStart(2, "0")}`,
        monthEndLocal: `2026-${String(i + 4).padStart(2, "0")}-30`,
        isPartial: i === months - 1,
        pipelineTotal: 2_000_000 + i * 120_000,
        forecastRevenue: 400_000 + i * 20_000,
        openDeals: 40 + i,
      })),
    }
  }

  filterOptions = { segments: SEGMENTS, cities: ["Curitiba"] }

  routes() {
    return {
      board: this.board,
      boardColumn: this.boardColumn,
      changeStage: this.stage,
      closeDeal: this.close,
      reassignDeal: this.reassign,
      dealCard: this.card,
      pipelineSummary: this.summary,
      pipelineInsights: this.insights,
      pipelineEvolution: this.evolution,
      companyFilterOptions: this.filterOptions,
    }
  }

  /** Onde o negócio está agora na loja (a verdade do "servidor"). */
  find(id: string) {
    return this.cards.find((c) => c.id === id)!
  }
}
