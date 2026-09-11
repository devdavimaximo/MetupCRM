import { useState } from "react"

import { AppShell } from "@/components/AppShell"
import { CompaniesPage } from "@/features/companies/CompaniesPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { clearSession, getSession, type Session } from "@/lib/auth"

function App() {
  const [session, setSession] = useState<Session | null>(() => getSession())

  if (!session) {
    return <LoginPage onLoggedIn={setSession} />
  }

  return (
    <AppShell
      session={session}
      onLogout={() => {
        clearSession()
        setSession(null)
      }}
    >
      <CompaniesPage />
    </AppShell>
  )
}

export default App
