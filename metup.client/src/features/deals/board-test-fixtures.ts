import type { DealBoard, DealBoardCard, DealBoardColumn, DealStage } from "./api"
import { ACTIVE_STAGES } from "./stage-labels"

/** Fixtures dos testes do quadro (estado otimista, reatribuição e tempo real). */

export function card(overrides: Partial<DealBoardCard> = {}): DealBoardCard {
  return {
    id: "d1",
    companyId: "c1",
    companyName: "Tech Solutions",
    companySegment: "Varejo",
    contactName: null,
    stage: "Qualificacao",
    status: "Aberto",
    source: "Sdr",
    ownerUserId: "u1",
    ownerUserName: "Ana Prado",
    value: 1000,
    valueIsEstimated: false,
    stageEnteredAt: "2026-09-01T12:00:00Z",
    daysInStage: 18,
    isStalled: true,
    lastActivityAt: null,
    nextTask: null,
    expectedCloseDate: null,
    closedAt: null,
    lostReason: null,
    ...overrides,
  }
}

export function column(stage: DealStage, items: DealBoardCard[], extra: Partial<DealBoardColumn> = {}): DealBoardColumn {
  return {
    stage,
    count: items.length,
    total: items.reduce((sum, c) => sum + (c.value ?? 0), 0),
    totalHasEstimate: items.some((c) => c.valueIsEstimated),
    page: 1,
    items,
    hasMore: false,
    ...extra,
  }
}

export function board(byStage: Partial<Record<DealStage, DealBoardColumn>>): DealBoard {
  return {
    ownerUserId: null,
    periodStartLocal: "2026-08-21",
    periodEndLocal: "2026-09-19",
    sort: "Stalled",
    columns: ACTIVE_STAGES.map((stage) => byStage[stage] ?? column(stage, [])),
    closed: { won: column("Ganho", []), lost: column("Perdido", []) },
  }
}
