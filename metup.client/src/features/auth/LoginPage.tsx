import { type FormEvent, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

import { BrandLockup } from "@/components/BrandLockup"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Eyebrow } from "@/components/ui/page"
import { Alert } from "@/components/ui/states"
import { ApiError, apiFetch } from "@/lib/api"
import { saveSession, type AuthenticatedUser, type Session } from "@/lib/auth"
import { brand } from "@/lib/brand"

type LoginResponse = {
  token: string
  expiresAtUtc: string
  user: AuthenticatedUser
}

type Props = {
  onLoggedIn: (session: Session) => void
}

/** O caminho que o sistema opera (CLAUDE.md §1) — a mesma frase que define o produto. */
const FUNNEL_STEPS = ["Prospecção", "Contato", "Follow-up", "Reunião", "Proposta", "Venda"]

export function LoginPage({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })

      const session: Session = { token: response.token, expiresAtUtc: response.expiresAtUtc, user: response.user }

      saveSession(session)
      onLoggedIn(session)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-svh overflow-hidden bg-bg lg:grid-cols-[minmax(0,1.1fr)_minmax(26rem,1fr)]">
      {/* Halo quente — o mesmo gesto da primeira dobra da LP, em CSS puro (sem custo de GPU). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[28%] hidden size-168 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent)] lg:block"
      />

      <section className="relative hidden flex-col justify-between border-r border-line-soft px-12 py-12 lg:flex xl:px-16">
        <BrandLockup />

        <div className="flex max-w-xl flex-col gap-8">
          <Eyebrow>{brand.tagline}</Eyebrow>
          <p className="font-display text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-fg">
            Toda a máquina comercial, <span className="text-accent">do primeiro contato à venda.</span>
          </p>
          <ol className="grid grid-cols-3 border-t border-line-soft" aria-label="Etapas do funil">
            {FUNNEL_STEPS.map((step, index) => (
              <li
                key={step}
                className="label-mono flex flex-col gap-1.5 border-b border-line-soft py-3.5 text-fg-muted nth-[n+4]:border-b-0"
              >
                <span className={index === FUNNEL_STEPS.length - 1 ? "text-accent" : "text-faint"}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <p className="label-mono text-faint">
          {brand.name} {brand.product}
        </p>
      </section>

      <section className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="flex w-full max-w-sm flex-col gap-10">
          <div className="lg:hidden">
            <BrandLockup />
          </div>

          <header className="flex flex-col gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-fg">Entrar</h1>
            <p className="text-base text-fg-muted">Acesse o sistema operacional comercial com o e-mail da sua equipe.</p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <Field
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
            />

            <Field
              id="password"
              label="Senha"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
            />

            {error && <Alert>{error}</Alert>}

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}
