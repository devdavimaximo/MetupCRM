import {
  CalendarDays,
  Crosshair,
  FileText,
  Handshake,
  ListChecks,
  PhoneCall,
  PhoneOutgoing,
  Trophy,
  type LucideIcon,
} from "lucide-react"

import type { DealStage } from "./api"

/** Ícone do cabeçalho de cada coluna do quadro (e das abas no celular). Ganho e Perdido dividem Fechados. */
export const stageIcons: Record<DealStage, LucideIcon> = {
  Prospect: Crosshair,
  PrimeiroContato: PhoneOutgoing,
  ContatoRealizado: PhoneCall,
  Qualificacao: ListChecks,
  Reuniao: CalendarDays,
  Proposta: FileText,
  Negociacao: Handshake,
  Ganho: Trophy,
  Perdido: Trophy,
}

export const ClosedIcon = Trophy
