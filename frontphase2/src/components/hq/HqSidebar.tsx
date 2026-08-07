'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Building,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Database,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Server,
  Target,
  Ticket,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { HqBrandLogo } from './HqBrandLogo';
import {
  canAccessHqNav,
  HQ_PERMISSIONS_STORAGE_KEY,
  readHqPermissionIds,
} from '@/lib/hqNavPermissions';

export type HqNavTab = 'dashboard' | 'tenants' | 'plans' | 'bootstrap';

export const HQ_SIDEBAR_W = 220;

type HqNavAccent = 'sky' | 'rose' | 'blue' | 'amber' | 'violet' | 'emerald' | 'indigo' | 'slate' | 'pink';

export type HqNavId =
  | HqNavTab
  | 'employerDashboard'
  | 'candidates'
  | 'courses'
  | 'subscriptions'
  | 'leads'
  | 'clients'
  | 'crmDashboard'
  | 'team'
  | 'reports'
  | 'billing'
  | 'company'
  | 'tickets'
  | 'portal'
  | 'events';

export const HQ_NAV_ITEMS: {
  id: HqNavId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  accent: HqNavAccent;
  group: 'employees' | 'employers' | 'platform' | 'crm' | 'ops';
}[] = [
  // Employees = Phase 1
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/hq?view=employee',
    icon: LayoutDashboard,
    accent: 'sky',
    group: 'employees',
  },
  {
    id: 'candidates',
    label: 'Candidates',
    href: '/hq/candidates',
    icon: UserRound,
    accent: 'emerald',
    group: 'employees',
  },
  {
    id: 'courses',
    label: 'Courses',
    href: '/hq/courses',
    icon: GraduationCap,
    accent: 'violet',
    group: 'employees',
  },
  {
    id: 'portal',
    label: 'Portal jobs',
    href: '/hq/portal',
    icon: Globe,
    accent: 'emerald',
    group: 'employees',
  },
  {
    id: 'events',
    label: 'Events',
    href: '/hq/events',
    icon: CalendarDays,
    accent: 'sky',
    group: 'employees',
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    href: '/hq/subscriptions',
    icon: CreditCard,
    accent: 'amber',
    group: 'employees',
  },
  // Employers = Phase 2
  {
    id: 'employerDashboard',
    label: 'Dashboard',
    href: '/hq?view=employer',
    icon: LayoutDashboard,
    accent: 'sky',
    group: 'employers',
  },
  {
    id: 'company',
    label: 'Companies',
    href: '/hq/company',
    icon: Building,
    accent: 'indigo',
    group: 'employers',
  },
  {
    id: 'tickets',
    label: 'Tickets',
    href: '/hq/tickets',
    icon: Ticket,
    accent: 'rose',
    group: 'employers',
  },
  {
    id: 'tenants',
    label: 'Tenants',
    href: '/hq?tab=tenants',
    icon: Users,
    accent: 'blue',
    group: 'employers',
  },
  {
    id: 'plans',
    label: 'Subscriptions',
    href: '/hq?tab=plans',
    icon: CreditCard,
    accent: 'amber',
    group: 'employers',
  },
  // CRM dropdown — Dashboard, Leads, Clients
  {
    id: 'crmDashboard',
    label: 'Dashboard',
    href: '/hq/crm-dashboard',
    icon: LayoutDashboard,
    accent: 'sky',
    group: 'crm',
  },
  { id: 'leads', label: 'Leads', href: '/hq/leads', icon: Target, accent: 'rose', group: 'crm' },
  { id: 'clients', label: 'Clients', href: '/hq/clients', icon: Building2, accent: 'blue', group: 'crm' },
  // Ops — Team, Reports, Billing
  { id: 'team', label: 'Team', href: '/hq/team', icon: UsersRound, accent: 'violet', group: 'ops' },
  { id: 'reports', label: 'Reports', href: '/hq/reports', icon: BarChart3, accent: 'pink', group: 'ops' },
  {
    id: 'billing',
    label: 'Billing',
    href: '/hq?tab=plans',
    icon: CreditCard,
    accent: 'amber',
    group: 'ops',
  },
];

const NAV_ICON_ACCENTS: Record<
  HqNavAccent,
  { idle: string; activeWrap: string; activeIcon: string }
> = {
  sky: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-sky-400/30 backdrop-blur',
    activeIcon: 'text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.55)]',
  },
  rose: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-rose-400/30 backdrop-blur',
    activeIcon: 'text-rose-300 drop-shadow-[0_0_6px_rgba(251,113,133,0.55)]',
  },
  blue: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-blue-400/30 backdrop-blur',
    activeIcon: 'text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.55)]',
  },
  amber: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-amber-400/30 backdrop-blur',
    activeIcon: 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]',
  },
  violet: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-violet-400/30 backdrop-blur',
    activeIcon: 'text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.55)]',
  },
  emerald: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-emerald-400/30 backdrop-blur',
    activeIcon: 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]',
  },
  indigo: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-indigo-400/30 backdrop-blur',
    activeIcon: 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.55)]',
  },
  pink: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-pink-400/30 backdrop-blur',
    activeIcon: 'text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.55)]',
  },
  slate: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-slate-300/25 backdrop-blur',
    activeIcon: 'text-slate-100',
  },
};

function isNavActive(
  pathname: string,
  tab: string | null,
  view: string | null,
  item: (typeof HQ_NAV_ITEMS)[number],
) {
  if (item.id === 'leads') return pathname === '/hq/leads' || pathname.startsWith('/hq/leads/');
  if (item.id === 'clients') return pathname === '/hq/clients' || pathname.startsWith('/hq/clients/');
  if (item.id === 'crmDashboard') {
    return pathname === '/hq/crm-dashboard' || pathname.startsWith('/hq/crm-dashboard/');
  }
  if (item.id === 'team') return pathname === '/hq/team' || pathname.startsWith('/hq/team/');
  if (item.id === 'reports') return pathname === '/hq/reports' || pathname.startsWith('/hq/reports/');
  if (item.id === 'company') return pathname === '/hq/company' || pathname.startsWith('/hq/company/');
  if (item.id === 'tickets') return pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/');
  if (item.id === 'candidates') {
    return pathname === '/hq/candidates' || pathname.startsWith('/hq/candidates/');
  }
  if (item.id === 'courses') {
    return pathname === '/hq/courses' || pathname.startsWith('/hq/courses/');
  }
  if (item.id === 'subscriptions') {
    return pathname === '/hq/subscriptions' || pathname.startsWith('/hq/subscriptions/');
  }
  if (item.id === 'billing') return pathname === '/hq' && tab === 'plans';
  if (item.id === 'plans') return pathname === '/hq' && tab === 'plans';
  if (item.id === 'portal') return pathname === '/hq/portal' || pathname.startsWith('/hq/portal/');
  if (item.id === 'events') return pathname === '/hq/events' || pathname.startsWith('/hq/events/');
  if (pathname !== '/hq') return false;
  if (item.id === 'dashboard') {
    return (!tab || tab === 'dashboard') && view !== 'employer' && view !== 'platform';
  }
  if (item.id === 'employerDashboard') {
    return (!tab || tab === 'dashboard') && view === 'employer';
  }
  return tab === item.id;
}

function isEmployeesSectionActive(pathname: string, tab: string | null, view: string | null) {
  if (pathname === '/hq/candidates' || pathname.startsWith('/hq/candidates/')) return true;
  if (pathname === '/hq/courses' || pathname.startsWith('/hq/courses/')) return true;
  if (pathname === '/hq/portal' || pathname.startsWith('/hq/portal/')) return true;
  if (pathname === '/hq/events' || pathname.startsWith('/hq/events/')) return true;
  if (pathname === '/hq/subscriptions' || pathname.startsWith('/hq/subscriptions/')) return true;
  if (pathname !== '/hq') return false;
  if (tab && tab !== 'dashboard') return false;
  return view !== 'employer' && view !== 'platform';
}

function isEmployersSectionActive(pathname: string, tab: string | null, view: string | null) {
  if (pathname === '/hq/company' || pathname.startsWith('/hq/company/')) return true;
  if (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) return true;
  if (pathname !== '/hq') return false;
  if (tab === 'tenants' || tab === 'plans') return true;
  if (tab && tab !== 'dashboard') return false;
  return view === 'employer';
}

function isCrmSectionActive(pathname: string) {
  return (
    pathname === '/hq/crm-dashboard' ||
    pathname.startsWith('/hq/crm-dashboard/') ||
    pathname === '/hq/leads' ||
    pathname.startsWith('/hq/leads/') ||
    pathname === '/hq/clients' ||
    pathname.startsWith('/hq/clients/')
  );
}

function HqNavItem({
  item,
  active,
  nested = false,
}: {
  item: (typeof HQ_NAV_ITEMS)[number];
  active: boolean;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const tone = NAV_ICON_ACCENTS[item.accent];

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={`relative my-0.5 flex h-11 items-center rounded-xl pr-2.5 transition-all duration-150 group ${
        nested ? 'mx-2.5 pl-3' : 'mx-2.5 pl-2.5'
      } ${
        active
          ? 'border border-white/20 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border border-transparent text-[#8899AA] hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {active ? (
        <div className="absolute -left-[3px] top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
      ) : null}
      <div
        className={`mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
          active ? tone.activeWrap : 'border border-white/[0.05] bg-white/[0.02]'
        }`}
      >
        <Icon
          size={nested ? 15 : 17}
          strokeWidth={active ? 2 : 1.6}
          className={active ? tone.activeIcon : `${tone.idle} group-hover:text-white`}
        />
      </div>
      <span className={`truncate text-[13px] ${active ? 'font-semibold text-white' : 'font-medium'}`}>
        {item.label}
      </span>
    </Link>
  );
}

function CollapsibleNavGroup({
  label,
  icon: Icon,
  accentActiveClass,
  open,
  onToggle,
  active,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  accentActiveClass: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`relative mx-2.5 my-0.5 flex h-11 w-[calc(100%-1.25rem)] items-center rounded-xl border pl-2.5 pr-2.5 transition-all duration-150 ${
          active
            ? 'border-white/20 bg-white/[0.08] text-white'
            : 'border-transparent text-[#8899AA] hover:bg-white/[0.04] hover:text-white'
        }`}
      >
        {active ? (
          <div className="absolute -left-[3px] top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
        ) : null}
        <div
          className={`mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            active
              ? `border-white/15 bg-white/5 ring-1 ${accentActiveClass}`
              : 'border-white/[0.05] bg-white/[0.02]'
          }`}
        >
          <Icon
            size={17}
            strokeWidth={active ? 2 : 1.6}
            className={active ? 'text-sky-300' : 'text-slate-400'}
          />
        </div>
        <span
          className={`min-w-0 flex-1 truncate text-left text-[13px] ${
            active ? 'font-semibold text-white' : 'font-medium'
          }`}
        >
          {label}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#6b7f90] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul className="mt-0.5 ml-3 border-l border-white/[0.08] pl-1">{children}</ul>
      ) : null}
    </div>
  );
}

export function HqSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const view = searchParams.get('view');
  const [permissionIds, setPermissionIds] = useState<string[] | null>(null);

  useEffect(() => {
    setPermissionIds(readHqPermissionIds());
    const onStorage = (event: StorageEvent) => {
      if (event.key === HQ_PERMISSIONS_STORAGE_KEY) {
        setPermissionIds(readHqPermissionIds());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const visibleItems = HQ_NAV_ITEMS.filter((item) => canAccessHqNav(item.id, permissionIds));
  const employeeItems = visibleItems.filter((item) => item.group === 'employees');
  const employerItems = visibleItems.filter((item) => item.group === 'employers');
  const platformItems = visibleItems.filter((item) => item.group === 'platform');
  const crmItems = visibleItems.filter((item) => item.group === 'crm');
  const opsItems = visibleItems.filter((item) => item.group === 'ops');

  const employeesActive = isEmployeesSectionActive(pathname, tab, view);
  const employersActive = isEmployersSectionActive(pathname, tab, view);
  const crmActive = isCrmSectionActive(pathname);
  const [employeesOpen, setEmployeesOpen] = useState(employeesActive);
  const [employersOpen, setEmployersOpen] = useState(employersActive);
  const [crmOpen, setCrmOpen] = useState(crmActive);

  useEffect(() => {
    if (employeesActive) setEmployeesOpen(true);
  }, [employeesActive]);

  useEffect(() => {
    if (employersActive) setEmployersOpen(true);
  }, [employersActive]);

  useEffect(() => {
    if (crmActive) setCrmOpen(true);
  }, [crmActive]);

  return (
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#071018] text-white"
      style={{ width: HQ_SIDEBAR_W }}
    >
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-4">
        <Link href="/hq?view=employee" prefetch={false} className="mb-3 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <HqBrandLogo className="h-7 w-7 object-contain" variant="mark" />
          </div>
          <div className="min-w-0">
            <h1 className="hq-display truncate text-[15px] font-semibold tracking-tight text-white">
              Headquarters
            </h1>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#7a92a8]">
              Portal + employer console
            </p>
          </div>
        </Link>
      </div>

      <nav
        className="sidenav-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3"
        aria-label="HQ sections"
      >
        {employeeItems.length > 0 || employerItems.length > 0 || platformItems.length > 0 ? (
          <p className="mb-1.5 px-5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#4A6070]">
            Platform
          </p>
        ) : null}

        {employeeItems.length > 0 ? (
          <CollapsibleNavGroup
            label="Employees"
            icon={Users}
            accentActiveClass="ring-sky-400/30"
            open={employeesOpen}
            onToggle={() => setEmployeesOpen((open) => !open)}
            active={employeesActive}
          >
            {employeeItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {employerItems.length > 0 ? (
          <CollapsibleNavGroup
            label="Employers"
            icon={Briefcase}
            accentActiveClass="ring-indigo-400/30"
            open={employersOpen}
            onToggle={() => setEmployersOpen((open) => !open)}
            active={employersActive}
          >
            {employerItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {platformItems.length > 0 ? (
          <ul className="mb-4 flex flex-col">
            {platformItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, item)} />
              </li>
            ))}
          </ul>
        ) : null}

        {crmItems.length > 0 || opsItems.length > 0 ? (
          <p className="mb-1.5 px-5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#4A6070]">
            Workspace
          </p>
        ) : null}
        {crmItems.length > 0 ? (
          <CollapsibleNavGroup
            label="CRM"
            icon={Target}
            accentActiveClass="ring-rose-400/30"
            open={crmOpen}
            onToggle={() => setCrmOpen((open) => !open)}
            active={crmActive}
          >
            {crmItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {opsItems.length > 0 ? (
          <ul className="mt-2 flex flex-col">
            {opsItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, item)} />
              </li>
            ))}
          </ul>
        ) : null}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
        <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b7f90]">
          <div className="flex items-center gap-2">
            <Server className="h-3 w-3" />
            <span>Auth v2.4</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>MongoDB Atlas</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
