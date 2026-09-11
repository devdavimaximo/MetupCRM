import type { ReactNode } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Session } from "@/lib/auth"

type Props = {
  session: Session
  onLogout: () => void
  children: ReactNode
}

const roleLabels: Record<Session["user"]["role"], string> = {
  Admin: "Admin",
  Closer: "Closer",
  Sdr: "SDR",
}

export function AppShell({ session, onLogout, children }: Props) {
  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="font-semibold tracking-tight text-foreground">
            Metup <span className="text-primary">CRM</span>
          </p>

          <nav aria-label="Principal" className="flex items-center gap-1">
            <span
              aria-current="page"
              className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-accent-foreground"
            >
              Empresas
            </span>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <p className="hidden min-w-0 text-right text-xs text-muted-foreground sm:block">
              <span className="block truncate font-medium text-foreground">{session.user.name}</span>
              <span className="block truncate">{roleLabels[session.user.role]}</span>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onLogout}>
              <LogOut aria-hidden="true" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>
    </div>
  )
}
