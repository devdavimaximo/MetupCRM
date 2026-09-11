import { useState } from "react"

import { DashboardStub } from "@/features/dashboard/DashboardStub"
import { LoginPage } from "@/features/auth/LoginPage"
import { clearSession, getSession, type Session } from "@/lib/auth"

function App() {
  const [session, setSession] = useState<Session | null>(() => getSession())

  if (!session) {
    return <LoginPage onLoggedIn={setSession} />
  }

  return (
    <DashboardStub
      session={session}
      onLogout={() => {
        clearSession()
        setSession(null)
      }}
    />
  )
}

export default App
