import { ChevronDown } from "lucide-react"

import { RealtimeIndicator } from "@/components/RealtimeIndicator"
import { Button } from "@/components/ui/button"
import { ToggleChips } from "@/components/ui/choice-chips"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ConversationChannel, ConversationStatus } from "./api"
import { CHANNEL_OPTIONS, channelLabels, STATUS_OPTIONS, statusLabels } from "./inbox-format"

type Props = {
  channels: ConversationChannel[]
  onChannelsChange: (channels: ConversationChannel[]) => void
  statuses: ConversationStatus[]
  onStatusesChange: (statuses: ConversationStatus[]) => void
}

/**
 * Cabeçalho da tela de Conversas: breadcrumb, título e os dois filtros de leitura (canal/status).
 * A pílula de período fica de fora desta onda — o back-end da C1 não filtra por data (item 13).
 */
export function InboxHeader({ channels, onChannelsChange, statuses, onStatusesChange }: Props) {
  return (
    // O cluster de busca/sino (ShellActions) flutua fixo no canto superior direito em qualquer
    // largura ≥ lg — este respiro evita que os filtros fiquem embaixo dele.
    <header className="flex shrink-0 flex-col gap-4 border-b border-line-soft px-4 pt-5 pb-4 sm:px-6 lg:pr-56 lg:pt-6 lg:pb-5 xl:px-10">
      <nav aria-label="Trilha de navegação">
        <ol className="label-mono flex items-center gap-2 text-muted">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-px w-5 shrink-0 bg-accent" />
            CRM
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-accent">
            Conversas
          </li>
          <li>
            <RealtimeIndicator />
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg">Conversas</h1>
          <p className="max-w-2xl text-sm text-fg-muted">Acompanhe todas as interações do seu time com leads e clientes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ConversationFilter
            label="Canal"
            emptyLabel="Todos os canais"
            options={CHANNEL_OPTIONS}
            optionLabels={channelLabels}
            values={channels}
            onChange={onChannelsChange}
          />
          <ConversationFilter
            label="Status"
            emptyLabel="Todos os status"
            options={STATUS_OPTIONS}
            optionLabels={statusLabels}
            values={statuses}
            onChange={onStatusesChange}
          />
        </div>
      </div>
    </header>
  )
}

function ConversationFilter<T extends string>({
  label,
  emptyLabel,
  options,
  optionLabels,
  values,
  onChange,
}: {
  label: string
  emptyLabel: string
  options: T[]
  optionLabels: Record<T, string>
  values: T[]
  onChange: (values: T[]) => void
}) {
  const triggerLabel = values.length === 0 ? emptyLabel : values.map((v) => optionLabels[v]).join(", ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 max-w-56"
          aria-label={`${label}: ${triggerLabel}`}
        >
          <span className={cn("truncate", values.length === 0 && "text-muted")}>{triggerLabel}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2 p-3">
        <p className="label-mono px-0.5 text-muted">{label}</p>
        <ToggleChips
          label={label}
          options={options.map((value) => ({ value, label: optionLabels[value] }))}
          values={values}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  )
}
