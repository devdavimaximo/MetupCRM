import type { ReactNode } from "react"
import { MessageCircle, Pencil, Phone, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
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
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhum contato nesta empresa ainda. Adicione quem atende o telefone.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {contacts.map((contact) =>
        editingContactId === contact.id ? (
          <li key={contact.id}>
            <ContactForm
              companyId={companyId}
              contact={contact}
              onSaved={onSaved}
              onCancel={() => onEdit(null)}
            />
          </li>
        ) : (
          <li
            key={contact.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{contact.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[contact.role, contact.phone ?? contact.whatsApp, contact.email]
                  .filter(Boolean)
                  .join(" · ") || "Sem dados de contato"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <QuickAction
                href={telHref(contact.phone ?? contact.whatsApp)}
                label={`Ligar para ${contact.name}`}
              >
                <Phone aria-hidden="true" />
              </QuickAction>

              <QuickAction
                href={whatsAppHref(contact.whatsApp ?? contact.phone)}
                label={`Abrir WhatsApp de ${contact.name}`}
              >
                <MessageCircle aria-hidden="true" />
              </QuickAction>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Editar ${contact.name}`}
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
function QuickAction({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: ReactNode
}) {
  if (!href) {
    return (
      <Button type="button" variant="ghost" size="icon" aria-label={`${label} (sem número)`} disabled>
        {children}
      </Button>
    )
  }

  // tel: abre o discador na própria aba; wa.me é externo e vai para outra.
  const isExternal = href.startsWith("http")

  return (
    <Button asChild variant="ghost" size="icon">
      <a
        href={href}
        aria-label={label}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {children}
      </a>
    </Button>
  )
}
