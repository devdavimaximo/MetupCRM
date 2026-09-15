import type { DealSource, DealStage, DealStatus } from "./api"

/** Estágios ativos do funil, na ordem em que o negócio percorre (seção 4.2 do CLAUDE.md). */
export const ACTIVE_STAGES: DealStage[] = [
  "Prospect",
  "PrimeiroContato",
  "ContatoRealizado",
  "Qualificacao",
  "Reuniao",
  "Proposta",
  "Negociacao",
]

/** Ganho e Perdido só são alcançados fechando o negócio — nunca pelo seletor de estágio. */
export const TERMINAL_STAGES: DealStage[] = ["Ganho", "Perdido"]

export const ALL_STAGES: DealStage[] = [...ACTIVE_STAGES, ...TERMINAL_STAGES]

export const stageLabels: Record<DealStage, string> = {
  Prospect: "Prospect",
  PrimeiroContato: "Primeiro Contato",
  ContatoRealizado: "Contato Realizado",
  Qualificacao: "Qualificação",
  Reuniao: "Reunião",
  Proposta: "Proposta",
  Negociacao: "Negociação",
  Ganho: "Ganho",
  Perdido: "Perdido",
}

/** A ordem aqui é a ordem das listas de origem (formulário e filtro do Pipeline). */
export const sourceLabels: Record<DealSource, string> = {
  Sdr: "SDR",
  Outbound: "Outbound",
  WhatsApp: "WhatsApp",
  MetaAds: "Meta Ads",
  Indicacao: "Indicação",
  Site: "Site",
  LinkedIn: "LinkedIn",
  Evento: "Evento",
  Outro: "Outro",
}

export const statusLabels: Record<DealStatus, string> = {
  Aberto: "Em aberto",
  Ganho: "Ganho",
  Perdido: "Perdido",
}
