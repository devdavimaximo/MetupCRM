import { Button } from "@/components/ui/button"
import type { Session } from "@/lib/auth"

type Props = {
  session: Session
  onLogout: () => void
}

export function DashboardStub({ session, onLogout }: Props) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Bem-vindo(a), {session.user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.user.email} · {session.user.role} · Organização {session.user.organizationId}
        </p>
      </div>
      <Button variant="outline" onClick={onLogout}>
        Sair
      </Button>
    </main>
  )
}
