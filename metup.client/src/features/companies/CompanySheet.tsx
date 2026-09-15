import { useState, type ComponentProps, type ReactNode } from "react"
import { ArrowLeft, ArrowUpRight, Phone, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/ui/monogram"
import { Eyebrow, SectionTitle } from "@/components/ui/page"
import { instagramHref, telHref } from "@/lib/contact-links"
import { cn } from "@/lib/utils"
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

/** A ficha: quem atende (contatos), o que está em jogo (negócios) e o cadastro — nessa ordem de uso. */
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
  const phoneUrl = telHref(company?.phone ?? null)

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
    <div className="flex w-full min-w-0 flex-col">
      <header className="flex flex-col gap-4 border-b border-line-soft px-5 pt-5 pb-5 sm:px-7 sm:pt-7">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit lg:hidden" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Lista de empresas
        </Button>

        {company ? (
          <div className="flex items-start gap-4">
            <Monogram name={company.name} size="lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-balance text-fg">{company.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
                {company.segment && <MetaItem label="Segmento">{company.segment}</MetaItem>}
                {company.city && <MetaItem label="Cidade">{company.city}</MetaItem>}
                {company.phone &&
                  (phoneUrl ? (
                    <a
                      href={phoneUrl}
                      className="inline-flex items-center gap-1.5 rounded-xs text-fg-muted tabular hover:text-fg focus-visible:focus-ring"
                    >
                      <Phone className="size-3.5" aria-hidden="true" />
                      {company.phone}
                    </a>
                  ) : (
                    <span className="tabular">{company.phone}</span>
                  ))}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xs text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-accent focus-visible:focus-ring"
                  >
                    {company.instagram}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Eyebrow>Nova empresa</Eyebrow>
            <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-fg">Cadastrar empresa-alvo</h2>
            <p className="text-base text-fg-muted">
              Comece pelo nome. Assim que a empresa existir, você adiciona os contatos e abre negócios aqui mesmo.
            </p>
          </div>
        )}
      </header>

      {company && (
        <SheetSection aria-labelledby="company-contacts-heading">
          <SectionTitle
            id="company-contacts-heading"
            count={company.contacts.length}
            action={
              !isAddingContact && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingContactId(null)
                    setIsAddingContact(true)
                  }}
                >
                  <Plus aria-hidden="true" />
                  Novo contato
                </Button>
              )
            }
          >
            Contatos
          </SectionTitle>

          {isAddingContact && (
            <ContactForm
              companyId={company.id}
              contact={null}
              onSaved={handleContactSaved}
              onCancel={() => setIsAddingContact(false)}
            />
          )}

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
        </SheetSection>
      )}

      {company && (
        <SheetSection aria-label="Negócios da empresa">
          <CompanyDealList
            companyId={company.id}
            onOpenDeal={onOpenDeal}
            onNewDeal={() => onNewDealForCompany(company.id, company.name)}
          />
        </SheetSection>
      )}

      <SheetSection aria-labelledby={company ? "company-data-heading" : undefined} aria-label={company ? undefined : "Dados da empresa"}>
        {company && <SectionTitle id="company-data-heading">Dados da empresa</SectionTitle>}
        <CompanyForm key={company?.id ?? "new"} company={company} onSaved={onCompanySaved} onCancel={company ? undefined : onBack} />
      </SheetSection>
    </div>
  )
}

function SheetSection({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("flex flex-col gap-4 border-b border-line-soft px-5 py-6 last:border-b-0 sm:px-7", className)} {...props}>
      {children}
    </section>
  )
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}:</span>
      <span aria-hidden="true" className="size-1 bg-line-strong" />
      <span className="text-fg-muted">{children}</span>
    </span>
  )
}
