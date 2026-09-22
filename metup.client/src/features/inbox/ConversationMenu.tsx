import { Building2, EllipsisVertical, Handshake, MailOpen, Star, StarOff } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { ConversationStatus } from "./api"
import { STATUS_OPTIONS, statusLabels } from "./inbox-format"

type Props = {
  contactName: string
  status: ConversationStatus
  isFavorite: boolean
  dealId: string | null
  companyId: string
  onMarkUnread: () => void
  onToggleFavorite: () => void
  onChangeStatus: (status: ConversationStatus) => void
  onOpenDeal: (dealId: string) => void
  onOpenCompany: (companyId: string) => void
}

/**
 * O `⋮` do cabeçalho da thread (item 18) — só existe aqui, não duplicado no painel de contexto.
 * Toda ação é decidida por quem chama (`InboxPage`), que aplica o otimismo e o desfazer.
 */
export function ConversationMenu({
  contactName,
  status,
  isFavorite,
  dealId,
  companyId,
  onMarkUnread,
  onToggleFavorite,
  onChangeStatus,
  onOpenDeal,
  onOpenCompany,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ações de ${contactName}`}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onMarkUnread}>
          <MailOpen aria-hidden="true" />
          Marcar como não lida
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleFavorite}>
          {isFavorite ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
          {isFavorite ? "Desfavoritar" : "Favoritar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent aria-label="Status da conversa">
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuItem key={option} disabled={option === status} onSelect={() => onChangeStatus(option)}>
                {statusLabels[option]}
                {option === status && <span className="ml-auto text-xs text-faint">atual</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {dealId && (
          <DropdownMenuItem onSelect={() => onOpenDeal(dealId)}>
            <Handshake aria-hidden="true" />
            Abrir negócio
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onOpenCompany(companyId)}>
          <Building2 aria-hidden="true" />
          Abrir empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
