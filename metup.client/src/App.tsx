import { useState } from "react"

import { AppShell } from "@/components/AppShell"
import { CompaniesPage } from "@/features/companies/CompaniesPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { PipelinePage } from "@/features/deals/PipelinePage"
import { InboxPage } from "@/features/inbox/InboxPage"
import { FunnelReportPage } from "@/features/reports/FunnelReportPage"
import { TasksPage } from "@/features/tasks/TasksPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { clearSession, getSession, type Session } from "@/lib/auth"
import { readUrlState, writeUrlState, type View } from "@/lib/url-state"

type NewDealIntent = { companyId: string; companyName: string } | null

function App() {
  const [session, setSession] = useState<Session | null>(() => getSession())
  const [view, setView] = useState<View>(() => readUrlState().view)
  const [navSeed, setNavSeed] = useState(0)
  const [newDealIntent, setNewDealIntent] = useState<NewDealIntent>(null)
  const [reportPeriod] = useState(() => {
    const initial = readUrlState()
    return { from: initial.reportFrom, to: initial.reportTo }
  })

  if (!session) {
    return <LoginPage onLoggedIn={setSession} />
  }

  function navigate(nextView: View) {
    writeUrlState({ view: nextView, companyId: null, dealId: null })
    setNewDealIntent(null)
    setView(nextView)
    setNavSeed((seed) => seed + 1)
  }

  function openCompany(companyId: string) {
    writeUrlState({ view: "empresas", companyId, dealId: null, search: "" })
    setNewDealIntent(null)
    setView("empresas")
    setNavSeed((seed) => seed + 1)
  }

  function openDeal(dealId: string) {
    writeUrlState({ view: "pipeline", dealId, companyId: null })
    setNewDealIntent(null)
    setView("pipeline")
    setNavSeed((seed) => seed + 1)
  }

  function openNewDealForCompany(companyId: string, companyName: string) {
    writeUrlState({ view: "pipeline", dealId: null, companyId: null })
    setNewDealIntent({ companyId, companyName })
    setView("pipeline")
    setNavSeed((seed) => seed + 1)
  }

  return (
    <AppShell
      session={session}
      view={view}
      onNavigate={navigate}
      onLogout={() => {
        clearSession()
        setSession(null)
      }}
    >
      {view === "dashboard" && <DashboardPage key={`dashboard-${navSeed}`} onOpenDeal={openDeal} />}
      {view === "empresas" && (
        <CompaniesPage
          key={`empresas-${navSeed}`}
          onOpenDeal={openDeal}
          onNewDealForCompany={openNewDealForCompany}
        />
      )}
      {view === "pipeline" && (
        <PipelinePage
          key={`pipeline-${navSeed}`}
          onOpenCompany={openCompany}
          newDealIntent={newDealIntent}
        />
      )}
      {view === "tarefas" && (
        <TasksPage key={`tarefas-${navSeed}`} role={session.user.role} onOpenDeal={openDeal} />
      )}
      {view === "inbox" && <InboxPage key={`inbox-${navSeed}`} onOpenDeal={openDeal} />}
      {view === "relatorios" && (
        <FunnelReportPage
          key={`relatorios-${navSeed}`}
          initialFrom={reportPeriod.from}
          initialTo={reportPeriod.to}
          onPeriodChange={({ from, to }) => writeUrlState({ reportFrom: from, reportTo: to })}
        />
      )}
    </AppShell>
  )
}

export default App
