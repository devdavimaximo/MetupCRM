import type { ReactNode } from "react"
import { MessageCircle, Pencil, Phone, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/ui/monogram"
import { EmptyState } from "@/components/ui/states"
import { telHref, whatsAppHref } from "@/lib/contact-links"
import { ContactForm } from "./ContactForm"
import type { Contact } from "./api"

type Props = {
  companyId: string
  contacts: Contact[]
  editingContactId: string | null
  onEdit: (contactId: string | null) => void
  onSaved: (contact: Contact) => void
}

export function ContactList({ companyId, contacts, editingContactId, onEdit, onSaved }: Props) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        compact
        icon={UserRound}
        title="Nenhum contato ainda"
        description="Adicione quem atende o telefone — é por onde a prospecção começa."
        className="rounded-sm border border-dashed border-line-soft"
      />
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft/60 rounded-sm border border-line-soft">
      {contacts.map((contact) =>
        editingContactId === contact.id ? (
          <li key={contact.id} className="p-1">
            <ContactForm companyId={companyId} contact={contact} onSaved={onSaved} onCancel={() => onEdit(null)} />
          </li>
        ) : (
          <li key={contact.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap">
            <Monogram name={contact.name} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate text-base font-medium text-fg">{contact.name}</span>
                {contact.role && <span className="truncate text-sm text-muted">{contact.role}</span>}
              </p>
              <p className="truncate text-sm text-muted">
                {[contact.phone ?? contact.whatsApp, contact.email].filter(Boolean).join(" · ") || "Sem dados de contato"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <QuickAction href={telHref(contact.phone ?? contact.whatsApp)} label={`Ligar para ${contact.name}`}>
                <Phone aria-hidden="true" />
              </QuickAction>

              <QuickAction href={whatsAppHref(contact.whatsApp ?? contact.phone)} label={`Abrir WhatsApp de ${contact.name}`}>
                <MessageCircle aria-hidden="true" />
              </QuickAction>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${contact.name}`}
                title="Editar"
                onClick={() => onEdit(contact.id)}
              >
                <Pencil aria-hidden="true" />
              </Button>
            </div>
          </li>
        )
      )}
    </ul>
  )
}

/** Ação rápida que vira link real quando há número, e botão desabilitado quando não há. */
function QuickAction({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  if (!href) {
    return (
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${label} (sem número)`} disabled>
        {children}
      </Button>
    )
  }

  // tel: abre o discador na própria aba; wa.me é externo e vai para outra.
  const isExternal = href.startsWith("http")

  return (
    <Button asChild variant="ghost" size="icon-sm" className="hover:text-accent">
      <a
        href={href}
        aria-label={label}
        title={label}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {children}
      </a>
    </Button>
  )
}
