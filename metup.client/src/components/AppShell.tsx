import { useEffect, useState, type ReactNode } from "react"
import {
  Building2,
  ChartColumn,
  Columns3,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  MessagesSquare,
  ShieldCheck,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react"

import { BrandLockup } from "@/components/BrandLockup"
import { ShellActions, type ShellNavigation } from "@/components/ShellActions"
import { Monogram } from "@/components/ui/monogram"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { can, type Session } from "@/lib/auth"
import { brand } from "@/lib/brand"
import { viewPermission } from "@/lib/permissions"
import type { View } from "@/lib/url-state"
import { cn } from "@/lib/utils"

type Props = {
  session: Session
  onLogout: () => void
  view: View
  onNavigate: (view: View) => void
  /** Destinos da busca global e das notificações. */
  navigation: ShellNavigation
  children: ReactNode
}


type NavItem = { view: View; label: string; icon: LucideIcon }

/** Agrupado pelo trabalho, não pela entidade: o que fazer hoje → onde vender → como está indo. */
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { view: "tarefas", label: "Tarefas", icon: ListChecks },
      { view: "inbox", label: "Conversas", icon: MessagesSquare },
    ],
  },
  {
    label: "Comercial",
    items: [
      { view: "pipeline", label: "Pipeline", icon: Columns3 },
      { view: "empresas", label: "Empresas", icon: Building2 },
    ],
  },
  {
    label: "Análise",
    items: [{ view: "relatorios", label: "Relatórios", icon: ChartColumn }],
  },
  {
    label: "Administração",
    items: [
      { view: "usuarios", label: "Usuários", icon: UserCog },
      { view: "cargos", label: "Cargos", icon: ShieldCheck },
    ],
  },
]

/** Só o que o cargo libera; grupo sem item some junto. O servidor recusa de novo o que não for permitido. */
function visibleNavGroups(session: Session) {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(session.user, viewPermission[item.view])) }))
    .filter((group) => group.items.length > 0)
}

const COLLAPSE_KEY = "metup.sidebar-collapsed"

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

export function AppShell({ session, onLogout, view, onNavigate, navigation, children }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0")
    } catch {
      /* preferência de conveniência — sem storage, só não persiste */
    }
  }, [collapsed])

  function navigate(next: View) {
    setMobileOpen(false)
    onNavigate(next)
  }

  return (
    <div
      className="min-h-svh bg-bg"
      style={{ ["--sidebar" as string]: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
    >
      <a
        href="#main"
        className="label-mono sr-only z-70 bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      {/* Desktop: sidebar fixa, colapsável para um trilho de ícones. */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar) flex-col border-r border-line-soft bg-sunken transition-[width] duration-200 ease-out lg:flex"
        aria-label="Navegação"
      >
        <SidebarContent
          session={session}
          view={view}
          collapsed={collapsed}
          onNavigate={navigate}
          onLogout={onLogout}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile/tablet: barra superior + gaveta com a mesma navegação. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line-soft bg-sunken/95 px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xs text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:focus-ring"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <BrandLockup />
        <span className="ml-auto">
          <Monogram name={session.user.name} size="xs" />
        </span>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" size="sm" className="max-w-[18rem] bg-sunken" hideClose>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent
            session={session}
            view={view}
            collapsed={false}
            onNavigate={navigate}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>

      <ShellActions userId={session.user.userId} navigation={navigation} />

      <main id="main" className="min-w-0 transition-[padding] duration-200 ease-out lg:pl-(--sidebar)">
        {children}
      </main>
    </div>
  )
}

function SidebarContent({
  session,
  view,
  collapsed,
  onNavigate,
  onLogout,
  onToggleCollapsed,
}: {
  session: Session
  view: View
  collapsed: boolean
  onNavigate: (view: View) => void
  onLogout: () => void
  onToggleCollapsed?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-line-soft", collapsed ? "justify-center px-2" : "px-5")}>
        <BrandLockup compact={collapsed} />
      </div>

      <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {visibleNavGroups(session).map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {collapsed ? (
              <span aria-hidden="true" className="mx-auto mb-1 h-px w-5 bg-line-soft" />
            ) : (
              <p className="label-mono px-3 pb-1.5 text-faint">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.view}>
                  <NavButton item={item} isActive={item.view === view} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-line-soft p-3">
        <div className={cn("flex items-center gap-3 rounded-xs px-2 py-2", collapsed && "justify-center px-0")}>
          <Monogram name={session.user.name} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-fg">{session.user.name}</p>
              <p className="label-mono truncate text-muted">
                {session.user.roleName} · {brand.name}
              </p>
            </div>
          )}
          {!collapsed && (
            <SidebarIconButton label="Sair" onClick={onLogout}>
              <LogOut aria-hidden="true" />
            </SidebarIconButton>
          )}
        </div>

        {collapsed && (
          <SidebarIconButton label="Sair" onClick={onLogout} className="mx-auto">
            <LogOut aria-hidden="true" />
          </SidebarIconButton>
        )}

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "label-mono flex h-8 cursor-pointer items-center gap-3 rounded-xs px-3 text-faint transition-colors hover:bg-surface-2 hover:text-fg-muted focus-visible:focus-ring",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden="true" />
                Recolher
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function NavButton({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate: (view: View) => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      onClick={() => onNavigate(item.view)}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-9 w-full cursor-pointer items-center gap-3 rounded-xs px-3 text-left text-base transition-colors focus-visible:focus-ring",
        collapsed && "justify-center px-0",
        isActive ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface/80 hover:text-fg"
      )}
    >
      {/* O indicador ativo da LP: um filete dourado, não um bloco colorido. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 bottom-2 -left-3 w-0.5 bg-accent transition-opacity",
          isActive ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn("size-4 shrink-0 transition-colors", isActive ? "text-accent" : "text-muted group-hover:text-fg-muted")}
        aria-hidden="true"
      />
      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
    </button>
  )
}

function SidebarIconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:focus-ring [&_svg]:size-4",
        className
      )}
    >
      {children}
    </button>
  )
}
