import { useEffect, useState } from "react"
import { ShieldOff } from "lucide-react"

import { AppShell } from "@/components/AppShell"
import { Page } from "@/components/ui/page"
import { EmptyState } from "@/components/ui/states"
import { getCurrentUser } from "@/features/admin/api"
import { RolesPage } from "@/features/admin/RolesPage"
import { UsersPage } from "@/features/admin/UsersPage"
import { CompaniesPage } from "@/features/companies/CompaniesPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import type { DealStage } from "@/features/deals/api"
import { dealSectionToUrl, type DealDrawerSection } from "@/features/deals/deal-section"
import { PipelinePage } from "@/features/deals/PipelinePage"
import { InboxPage } from "@/features/inbox/InboxPage"
import { ReportsPage } from "@/features/reports/ReportsPage"
import { readInitialReportsPeriod, reportsPeriodUrlPatch, storeReportsPeriod } from "@/features/reports/reports-period"
import { TasksPage } from "@/features/tasks/TasksPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { ApiError } from "@/lib/api"
import { can, clearSession, getSession, saveSession, type Session } from "@/lib/auth"
import { viewPermission } from "@/lib/permissions"
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
    return { period: readInitialReportsPeriod(initial), tab: initial.reportTab }
  })
  const [initialDashboardScope] = useState(() => readUrlState().dashboardScope)
  const sessionToken = session?.token

  // Cargo e permissões podem ter mudado desde o login: relê ao abrir o app. 401 = desativado ou token
  // inválido, e a sessão acaba.
  useEffect(() => {
    if (!sessionToken) return
    const controller = new AbortController()
    getCurrentUser(controller.signal)
      .then((user) =>
        setSession((current) => {
          if (!current || current.token !== sessionToken) return current
          const next = { ...current, user }
          saveSession(next)
          return next
        })
      )
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession()
          setSession(null)
        }
      })
    return () => controller.abort()
  }, [sessionToken])

  if (!session) {
    return <LoginPage onLoggedIn={setSession} />
  }

  // A tela pedida (URL ou navegação) só abre se o cargo libera; senão cai na primeira liberada.
  const allowedViews = (Object.keys(viewPermission) as View[]).filter((v) => can(session.user, viewPermission[v]))
  const currentView: View | null = allowedViews.includes(view) ? view : (allowedViews[0] ?? null)

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
      view={currentView ?? view}
      onNavigate={navigate}
      navigation={{ onNavigate: navigate, onOpenCompany: openCompany, onOpenDeal: openDeal, onOpenConversation: openConversation }}
      onLogout={() => {
        clearSession()
        setSession(null)
      }}
    >
      {currentView === "dashboard" && (
        <DashboardPage
          key={`dashboard-${navSeed}`}
          userName={session.user.name}
          canSeeTeam={can(session.user, "TeamWideAccess")}
          initialScope={initialDashboardScope}
          onOpenDeal={openDeal}
          onOpenCompany={openCompany}
          onLogActivity={(dealId) => openDeal(dealId, "activity")}
          onOpenPipelineAtStage={openPipelineAtStage}
          onNavigate={navigate}
        />
      )}
      {currentView === "empresas" && (
        <CompaniesPage
          key={`empresas-${navSeed}`}
          onOpenDeal={openDeal}
          onNewDealForCompany={openNewDealForCompany}
        />
      )}
      {currentView === "pipeline" && (
        <PipelinePage
          key={`pipeline-${navSeed}`}
          user={session.user}
          onOpenCompany={openCompany}
          newDealIntent={newDealIntent}
        />
      )}
      {currentView === "tarefas" && (
        <TasksPage key={`tarefas-${navSeed}`} user={session.user} onOpenCompany={openCompany} />
      )}
      {currentView === "inbox" && <InboxPage key={`inbox-${navSeed}`} onOpenDeal={openDeal} onOpenCompany={openCompany} />}
      {currentView === "relatorios" && (
        <ReportsPage
          key={`relatorios-${navSeed}`}
          initialPeriod={reportState.period}
          initialTab={reportState.tab}
          onStateChange={({ period, tab }) => {
            storeReportsPeriod(period)
            writeUrlState({ ...reportsPeriodUrlPatch(period), reportTab: tab === "visao-geral" ? "" : tab })
          }}
        />
      )}
      {currentView === "usuarios" && <UsersPage key={`usuarios-${navSeed}`} currentUserId={session.user.userId} />}
      {currentView === "cargos" && <RolesPage key={`cargos-${navSeed}`} grantable={session.user.permissions} />}
      {currentView === null && (
        <Page>
          <EmptyState
            icon={ShieldOff}
            title="Seu cargo ainda não libera nenhuma tela"
            description="Peça a um administrador para ajustar as permissões do seu cargo."
          />
        </Page>
      )}
    </AppShell>
  )
}

export default App
