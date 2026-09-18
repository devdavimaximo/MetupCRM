import { useState } from "react"

import { AppShell } from "@/components/AppShell"
import { CompaniesPage } from "@/features/companies/CompaniesPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import type { DealStage } from "@/features/deals/api"
import { dealSectionToUrl, type DealDrawerSection } from "@/features/deals/deal-section"
import { PipelinePage } from "@/features/deals/PipelinePage"
import { InboxPage } from "@/features/inbox/InboxPage"
import { ReportsPage } from "@/features/reports/ReportsPage"
import { TasksPage } from "@/features/tasks/TasksPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { clearSession, getSession, type Session } from "@/lib/auth"
import { readUrlState, writeUrlState, type View } from "@/lib/url-state"

type NewDealIntent = { companyId: string; companyName: string } | null

/** Parâmetros de chegada (destaque, sheet, seção inicial): valem só para a navegação que os pôs. */
const ARRIVAL_CLEARED = { pipelineStage: "", activityFeed: "", dealSection: "" }

function App() {
  const [session, setSession] = useState<Session | null>(() => getSession())
  const [view, setView] = useState<View>(() => readUrlState().view)
  const [navSeed, setNavSeed] = useState(0)
  const [newDealIntent, setNewDealIntent] = useState<NewDealIntent>(null)
  const [reportState] = useState(() => {
    const initial = readUrlState()
    return { from: initial.reportFrom, to: initial.reportTo, tab: initial.reportTab }
  })
  const [initialDashboardScope] = useState(() => readUrlState().dashboardScope)

  if (!session) {
    return <LoginPage onLoggedIn={setSession} />
  }

  // `etapa` é um destaque de chegada no Pipeline, `feed` é o sheet da atividade no dashboard e `acao`
  // é a seção de chegada no negócio: toda navegação descarta os três.
  function navigate(nextView: View) {
    writeUrlState({ view: nextView, companyId: null, dealId: null, ...ARRIVAL_CLEARED })
    setNewDealIntent(null)
    setView(nextView)
    setNavSeed((seed) => seed + 1)
  }

  function openCompany(companyId: string) {
    writeUrlState({ view: "empresas", companyId, dealId: null, search: "", ...ARRIVAL_CLEARED })
    setNewDealIntent(null)
    setView("empresas")
    setNavSeed((seed) => seed + 1)
  }

  function openDeal(dealId: string, section?: DealDrawerSection) {
    writeUrlState({ view: "pipeline", dealId, companyId: null, ...ARRIVAL_CLEARED, dealSection: dealSectionToUrl(section) })
    setNewDealIntent(null)
    setView("pipeline")
    setNavSeed((seed) => seed + 1)
  }

  function openPipelineAtStage(stage: DealStage) {
    writeUrlState({ view: "pipeline", dealId: null, companyId: null, ...ARRIVAL_CLEARED, pipelineStage: stage })
    setNewDealIntent(null)
    setView("pipeline")
    setNavSeed((seed) => seed + 1)
  }

  function openConversation(conversationId: string) {
    writeUrlState({ view: "inbox", conversationId, dealId: null, companyId: null, search: "", ...ARRIVAL_CLEARED })
    setNewDealIntent(null)
    setView("inbox")
    setNavSeed((seed) => seed + 1)
  }

  function openNewDealForCompany(companyId: string, companyName: string) {
    writeUrlState({ view: "pipeline", dealId: null, companyId: null, ...ARRIVAL_CLEARED })
    setNewDealIntent({ companyId, companyName })
    setView("pipeline")
    setNavSeed((seed) => seed + 1)
  }

  return (
    <AppShell
      session={session}
      view={view}
      onNavigate={navigate}
      navigation={{ onNavigate: navigate, onOpenCompany: openCompany, onOpenDeal: openDeal, onOpenConversation: openConversation }}
      onLogout={() => {
        clearSession()
        setSession(null)
      }}
    >
      {view === "dashboard" && (
        <DashboardPage
          key={`dashboard-${navSeed}`}
          userName={session.user.name}
          role={session.user.role}
          initialScope={initialDashboardScope}
          onOpenDeal={openDeal}
          onOpenCompany={openCompany}
          onLogActivity={(dealId) => openDeal(dealId, "activity")}
          onOpenPipelineAtStage={openPipelineAtStage}
          onNavigate={navigate}
        />
      )}
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
        <ReportsPage
          key={`relatorios-${navSeed}`}
          initialFrom={reportState.from}
          initialTo={reportState.to}
          initialTab={reportState.tab}
          onStateChange={({ from, to, tab }) => writeUrlState({ reportFrom: from, reportTo: to, reportTab: tab === "funil" ? "" : tab })}
        />
      )}
    </AppShell>
  )
}

export default App
