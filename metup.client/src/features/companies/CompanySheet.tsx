import { useState } from "react"
import { ArrowLeft, AtSign, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { instagramHref } from "@/lib/contact-links"
import { CompanyDealList } from "./CompanyDealList"
import { CompanyForm } from "./CompanyForm"
import { ContactForm } from "./ContactForm"
import { ContactList } from "./ContactList"
import type { Company, Contact } from "./api"

type Props = {
  /** null = ficha em branco, cadastrando uma empresa nova. */
  company: Company | null
  onCompanySaved: (company: Company) => void
  onContactsChanged: (company: Company) => void
  onBack: () => void
  onOpenDeal: (dealId: string) => void
  onNewDealForCompany: (companyId: string, companyName: string) => void
}

/** A ficha: dados da empresa, os contatos e os negócios dela, na mesma tela. */
export function CompanySheet({
  company,
  onCompanySaved,
  onContactsChanged,
  onBack,
  onOpenDeal,
  onNewDealForCompany,
}: Props) {
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [isAddingContact, setIsAddingContact] = useState(false)

  const instagramUrl = instagramHref(company?.instagram ?? null)

  function handleContactSaved(saved: Contact) {
    if (!company) return

    const exists = company.contacts.some((contact) => contact.id === saved.id)
    const contacts = exists
      ? company.contacts.map((contact) => (contact.id === saved.id ? saved : contact))
      : [...company.contacts, saved]

    contacts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

    setEditingContactId(null)
    setIsAddingContact(false)
    onContactsChanged({ ...company, contacts })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit lg:hidden"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
          Voltar para a lista
        </Button>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-xl font-semibold text-balance text-foreground">
            {company ? company.name : "Nova empresa"}
          </h2>

          {company && (
            <>
              {company.segment && <Badge variant="outline">{company.segment}</Badge>}
              {company.city && <Badge variant="outline">{company.city}</Badge>}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <AtSign className="size-3" aria-hidden="true" />
                  {company.instagram}
                </a>
              )}
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {company
            ? "Edite os dados da empresa e gerencie os contatos dela."
            : "Cadastre a empresa. Assim que ela existir, você adiciona os contatos aqui mesmo."}
        </p>
      </header>

      <section aria-labelledby="company-data-heading" className="flex flex-col gap-3">
        <h3 id="company-data-heading" className="text-sm font-semibold text-foreground">
          Dados da empresa
        </h3>
        <CompanyForm
          key={company?.id ?? "new"}
          company={company}
          onSaved={onCompanySaved}
          onCancel={company ? undefined : onBack}
        />
      </section>

      <section aria-labelledby="company-contacts-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="company-contacts-heading" className="text-sm font-semibold text-foreground">
            Contatos{" "}
            {company && (
              <span className="tabular font-normal text-muted-foreground">
                ({company.contacts.length})
              </span>
            )}
          </h3>

          {company && !isAddingContact && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingContactId(null)
                setIsAddingContact(true)
              }}
            >
              <Plus aria-hidden="true" />
              Novo Contato
            </Button>
          )}
        </div>

        {!company && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Salve a empresa primeiro para poder adicionar contatos.
          </p>
        )}

        {company && isAddingContact && (
          <ContactForm
            companyId={company.id}
            contact={null}
            onSaved={handleContactSaved}
            onCancel={() => setIsAddingContact(false)}
          />
        )}

        {company && (
          <ContactList
            companyId={company.id}
            contacts={company.contacts}
            editingContactId={editingContactId}
            onEdit={(contactId) => {
              setIsAddingContact(false)
              setEditingContactId(contactId)
            }}
            onSaved={handleContactSaved}
          />
        )}
      </section>

      {company && (
        <section aria-label="Negócios da empresa">
          <CompanyDealList
            companyId={company.id}
            onOpenDeal={onOpenDeal}
            onNewDeal={() => onNewDealForCompany(company.id, company.name)}
          />
        </section>
      )}
    </div>
  )
}
