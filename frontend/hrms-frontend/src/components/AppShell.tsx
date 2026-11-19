"use client"
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { StoreProvider, useStore, UserRole } from '../store/StoreProvider'
import {
  LayoutDashboard, Users, CheckSquare, Clock, CalendarDays, CalendarRange, Target, CheckCircle2,
  Boxes, FileText, BarChart3, Settings, Search, Sparkles, LogOut, Shield, MapPin, Building2, Globe2,
  ScrollText, DoorOpen, UserMinus, Menu, Navigation, CreditCard, Megaphone, Network,
  ShieldCheck, GraduationCap, Coins, Award, Briefcase, Bell, UserCheck,
} from 'lucide-react'
import { NotificationDropdown } from '@/modules/notifications/components/NotificationDropdown'
import { WebClockInHeaderWidget } from '@/modules/attendance/components/WebClockInHeaderWidget'
import { TermsAcceptanceModal } from '@/modules/compliance/components/TermsAcceptanceModal'
import { Button, Input } from '@hryantra/ui'
import { LoginScreen } from '@/modules/auth/components/LoginScreen'
import { TabKey } from '@/shared/permissions'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppShellInner>{children}</AppShellInner>
    </StoreProvider>
  )
}

interface NavItem {
  tab?: TabKey
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const PLATFORM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/superadmin/tenants', icon: Building2 },
  { label: 'Leads', href: '/superadmin/leads', icon: Megaphone },
  { label: 'Subscriptions', href: '/superadmin/subscriptions', icon: CreditCard },
]

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Core HR',
    items: [
      { tab: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { tab: 'employees', label: 'Employees', href: '/employees', icon: Users },
      { label: 'Org Chart', href: '/org-chart', icon: Network },
      { tab: 'orgStructure', label: 'Org Structure', href: '/org-structure', icon: Building2 },
      { tab: 'onboarding', label: 'Onboarding & Preboarding', href: '/onboarding', icon: Sparkles },
    ],
  },
  {
    title: 'Time & Attendance',
    items: [
      { tab: 'attendance', label: 'Attendance', href: '/attendance', icon: Clock },
      { tab: 'attendance', label: 'Roster & Shifts', href: '/roster', icon: CalendarRange },
      { tab: 'leave', label: 'Leave Requests', href: '/leave', icon: CalendarDays },
      { tab: 'timeOff', label: 'Holidays', href: '/time-off', icon: CalendarRange },
      { tab: 'fieldVisits', label: 'Field Tracking', href: '/field-visits', icon: Navigation },
      { tab: 'tasks', label: 'Tasks', href: '/tasks', icon: CheckSquare },
    ],
  },
  {
    title: 'Talent & Compensation',
    items: [
      { tab: 'performance', label: 'Performance', href: '/performance', icon: Target },
      { label: 'Talent & 9-Box', href: '/talent-succession', icon: Award, roles: ['HR', 'Superadmin', 'Manager'] },
      { label: 'Comp Planning', href: '/compensation-planning', icon: Coins, roles: ['HR', 'Superadmin', 'Manager'] },
      { label: 'Workforce Planning', href: '/workforce-planning', icon: Briefcase, roles: ['HR', 'Superadmin', 'Manager'] },
      { label: 'Training (POSH)', href: '/training', icon: GraduationCap },
      { label: 'My Exit', href: '/my-exit', icon: DoorOpen },
      { label: 'Separations', href: '/separations', icon: UserMinus, roles: ['HR', 'Superadmin', 'Manager'] },
    ],
  },
  {
    title: 'Operations & Governance',
    items: [
      { tab: 'approvals', label: 'Approvals', href: '/approvals', icon: CheckCircle2 },
      { tab: 'assets', label: 'Assets', href: '/assets', icon: Boxes },
      { tab: 'documents', label: 'Documents', href: '/documents', icon: FileText },
      { label: 'Compliance & Terms', href: '/compliance', icon: ShieldCheck, roles: ['HR', 'Superadmin', 'Manager'] },
      { label: 'Policy Center', href: '/policies', icon: ScrollText, roles: ['HR', 'Superadmin'] },
      { tab: 'reports', label: 'Reports', href: '/reports', icon: BarChart3 },
      { tab: 'settings', label: 'Settings', href: '/settings', icon: Settings },
      { tab: 'userManagement', label: 'Users', href: '/users', icon: Shield },
      { tab: 'locations', label: 'Locations', href: '/locations', icon: MapPin },
    ],
  },
]

/** Extra routes that are role-gated in EXTRA_NAV — do not require a matching TabKey. */
const EXTRA_ROUTE_PREFIXES = [
  '/org-chart', '/my-exit', '/policies', '/separations', '/roster',
  '/compliance', '/training', '/compensation-planning', '/talent-succession', '/workforce-planning',
]

const PATH_TAB: { prefix: string; tab: TabKey }[] = [
  { prefix: '/org-chart', tab: 'employees' },
  { prefix: '/my-exit', tab: 'dashboard' },
  { prefix: '/policies', tab: 'settings' },
  { prefix: '/separations', tab: 'approvals' },
  { prefix: '/superadmin', tab: 'platformConsole' },
  { prefix: '/platform', tab: 'platformConsole' },
  { prefix: '/headquarters/org-structure', tab: 'orgStructure' },
  { prefix: '/headquarters/approvals', tab: 'approvals' },
  { prefix: '/headquarters', tab: 'dashboard' },
  { prefix: '/org-structure', tab: 'orgStructure' },
  { prefix: '/users', tab: 'userManagement' },
  { prefix: '/settings', tab: 'settings' },
  { prefix: '/locations', tab: 'locations' },
  { prefix: '/field-visits', tab: 'fieldVisits' },
  { prefix: '/reports', tab: 'reports' },
  { prefix: '/documents', tab: 'documents' },
  { prefix: '/approvals', tab: 'approvals' },
  { prefix: '/performance', tab: 'performance' },
  { prefix: '/assets', tab: 'assets' },
  { prefix: '/time-off', tab: 'timeOff' },
  { prefix: '/leave', tab: 'leave' },
  { prefix: '/roster', tab: 'attendance' },
  { prefix: '/attendance', tab: 'attendance' },
  { prefix: '/tasks', tab: 'tasks' },
  { prefix: '/onboarding', tab: 'onboarding' },
  { prefix: '/employees', tab: 'employees' },
]

const PAGE_TITLES: Record<string, string> = {
  '/': 'Executive Dashboard',
  '/roster': 'Roster & Shift Schedules',
  '/leave': 'Leave & Balance',
  '/attendance': 'Attendance & Time Logs',
  '/approvals': 'Workflow Approvals',
  '/org-structure': 'Organization Structure',
  '/org-chart': 'Visual Org Chart & Celebrations',
  '/onboarding': 'Employee Onboarding',
  '/time-off': 'Holidays & Calendar',
  '/field-visits': 'Field Tracking & Geo Visits',
  '/compliance': 'Compliance & Governance',
  '/training': 'Mandatory Training & Certs',
  '/compensation-planning': 'Compensation & Merit Cycles',
  '/talent-succession': 'Talent Succession & 9-Box',
  '/workforce-planning': 'Workforce Planning & Headcount',
  '/employees': 'Employee Directory',
  '/reports': 'Strategic Analytics & Reports',
  '/settings': 'System Settings & Templates',
  '/tasks': 'Task & Workflow Center',
  '/assets': 'Company Assets & Inventory',
  '/documents': 'Document Center & Templates',
  '/performance': 'Performance & OKRs',
  '/policies': 'Company Policies & Handbooks',
  '/separations': 'Exit & Separation Management',
  '/users': 'User Management & Roles',
  '/my-exit': 'My Resignation & Exit',
  '/notifications': 'Notification Center',
  '/superadmin/dashboard': 'Platform Operations',
  '/superadmin/tenants': 'Tenant Clients',
  '/superadmin/leads': 'Prospect Leads',
  '/superadmin/subscriptions': 'SaaS Subscriptions',
  '/superadmin': 'Platform Console',
}

function roleLabel(role: UserRole) {
  if (role === 'Superadmin') return 'Tenant Admin'
  if (role === 'PlatformOwner') return 'Platform Owner'
  if (role === 'HR') return 'HR Leader'
  if (role === 'Manager') return 'Team Manager'
  return 'Employee'
}

function tabForPath(pathname: string): TabKey {
  if (pathname === '/') return 'dashboard'
  const match = PATH_TAB.find(entry => pathname.startsWith(entry.prefix))
  return match?.tab || 'dashboard'
}

function pageTitleForPath(pathname: string): string {
  const exact = PAGE_TITLES[pathname]
  if (exact) return exact
  if (pathname.startsWith('/superadmin')) return 'Platform Console'
  const match = Object.entries(PAGE_TITLES).find(([prefix]) => prefix !== '/' && pathname.startsWith(prefix))
  return match?.[1] || 'Headquarters'
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    currentUserRole, activeEmployeeId, isAuthenticated, sessionReady,
    currentUserName, logout, employees, hasTab,
  } = useStore()

  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const currentUser = React.useMemo(
    () => employees.find(employee => employee.id === activeEmployeeId) || employees[0],
    [activeEmployeeId, employees]
  )

  const navSections = React.useMemo(() => {
    if (currentUserRole === 'PlatformOwner') {
      return [
        {
          title: 'Platform Administration',
          items: PLATFORM_NAV,
        },
      ]
    }

    return NAV_SECTIONS.map((section) => ({
      title: section.title,
      items: section.items.filter((item) => {
        if (item.tab && !hasTab(item.tab)) return false
        if (item.roles && !item.roles.includes(currentUserRole)) return false
        return true
      }),
    })).filter((section) => section.items.length > 0)
  }, [currentUserRole, hasTab])

  const routeTab = tabForPath(pathname)
  const pageTitle = pageTitleForPath(pathname)
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  React.useEffect(() => {
    if (!isAuthenticated || !sessionReady) return
    if (currentUserRole === 'PlatformOwner') {
      if (
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/platform' ||
        pathname === '/superadmin/login' ||
        pathname === '/superadmin'
      ) {
        router.replace('/superadmin/dashboard')
        return
      }
      if (!pathname.startsWith('/superadmin') && pathname !== '/platform') {
        router.replace('/superadmin/dashboard')
        return
      }
      return
    }
    if (pathname === '/login' || pathname.startsWith('/superadmin/login')) {
      router.replace('/')
      return
    }
    if (pathname === '/') return
    const isExtraRoute = EXTRA_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    if (isExtraRoute) return
    if (!hasTab(routeTab)) {
      router.replace('/')
    }
  }, [currentUserRole, hasTab, isAuthenticated, pathname, routeTab, router, sessionReady])

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center app-content-bg text-slate-600 text-sm">
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading workspace session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const platformLogin = pathname.startsWith('/superadmin')
    return <LoginScreen mode={platformLogin ? 'platform' : 'tenant'} />
  }

  if (
    pathname !== '/' &&
    !pathname.startsWith('/superadmin') &&
    pathname !== '/login' &&
    !hasTab(routeTab)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center app-content-bg text-slate-600 text-sm">
        Redirecting...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden app-content-bg">
      {/* ─── Premium Obsidian-Indigo Sidebar ───────────────────────────── */}
      <aside className="glass-sidebar flex w-[260px] shrink-0 flex-col">
        {/* Brand Emblem */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-tight text-white">FRAMEWORK</div>
              <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {currentUserRole === 'PlatformOwner' ? 'Platform Console' : 'Enterprise HRMS'}
              </div>
            </div>
          </div>
        </div>

        {/* Sectioned Navigation */}
        <div className="sidebar-nav-scroll flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-4">
            {navSections.map((section, sIdx) => (
              <div key={section.title || sIdx} className="flex flex-col gap-1">
                {section.title && (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400/80">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const isPreboardingNav = item.href.includes('tab=preboarding')
                  const active = isPreboardingNav
                    ? pathname === '/onboarding' && (typeof window !== 'undefined' && window.location.search.includes('tab=preboarding'))
                    : item.href === '/onboarding'
                    ? pathname === '/onboarding' && (typeof window === 'undefined' || !window.location.search.includes('tab=preboarding'))
                    : pathname === item.href ||
                      (item.href !== '/' && item.href !== '/superadmin' && pathname.startsWith(`${item.href}/`)) ||
                      (item.href === '/superadmin/dashboard' && (pathname === '/superadmin' || pathname === '/superadmin/dashboard'))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all shrink-0 ${
                        active
                          ? 'glass-nav-item-active text-white font-semibold'
                          : 'glass-nav-item text-slate-400 hover:text-white'
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                      )}
                      <item.icon
                        className={`size-4 shrink-0 transition-transform group-hover:scale-105 ${
                          active ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom User Pill */}
        <div className="shrink-0 p-3 border-t border-white/[0.08]">
          <div className="glass-profile-card flex items-center justify-between gap-2.5 rounded-xl p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 text-xs font-bold text-white shadow-sm">
                {(currentUser?.name || currentUserName || 'User').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">{currentUser?.name || currentUserName || 'User'}</div>
                <div className="truncate text-[10px] text-slate-400 font-medium">
                  {roleLabel(currentUserRole)}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Canvas ───────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Frosted Executive Top Bar */}
        <header className="glass-header z-40 flex h-16 shrink-0 items-center justify-between px-5">
          {/* Left Title Slot - Fixed width container prevents horizontal jumping on tab switch */}
          <div className="flex w-[290px] max-w-[290px] shrink-0 items-center gap-2.5 min-w-0">
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Menu className="size-4" />
            </button>
            <div className="min-w-0 flex items-center gap-2 overflow-hidden">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-slate-900" title={pageTitle}>
                {pageTitle}
              </h1>
              <span className="shrink-0 hidden sm:inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                {currentUserRole === 'PlatformOwner' ? 'Platform Console' : 'HQ Portal'}
              </span>
            </div>
          </div>

          {/* Center Search Slot - Fixed width position, replaces Mac shortcut symbol with standard Ctrl K */}
          <div className="hidden shrink-0 items-center md:flex w-[280px] lg:w-[320px]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search employees, tasks, docs..."
                className="h-9 w-full rounded-xl border-slate-200 bg-slate-50/80 pl-8 pr-14 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 shadow-2xs">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Right Action Slot - Stationary pinned right controls */}
          <div className="shrink-0 flex items-center justify-end gap-2.5 ml-auto">
            {currentUserRole !== 'PlatformOwner' && <WebClockInHeaderWidget />}

            <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 text-xs font-medium text-slate-600 xl:flex">
              <span>{dateLabel}</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-800">{timeLabel}</span>
            </div>

            <NotificationDropdown />

            <div className="hidden h-6 w-px bg-slate-200 sm:block" />

            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white shadow-2xs">
                {(currentUser?.name || 'User').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left max-w-[120px]">
                <div className="truncate text-xs font-semibold text-slate-900 leading-tight">{currentUser?.name || currentUserName || 'User'}</div>
                <div className="truncate text-[10px] text-slate-500 font-medium">{roleLabel(currentUserRole)}</div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* Scrollable Viewport Canvas */}
        <div className="app-content-bg min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <TermsAcceptanceModal />
          {children}
        </div>
      </main>
    </div>
  )
}
