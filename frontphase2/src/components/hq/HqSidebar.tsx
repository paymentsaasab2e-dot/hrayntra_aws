'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Building,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
  Ticket,
  Trash2,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { HqBrandLogo } from './HqBrandLogo';
import {
  applyHqSessionAccess,
  canAccessHqNav,
  HQ_PERMISSIONS_STORAGE_KEY,
  resolveHqNavAccess,
  type HqNavAccess,
  writeHqPermissionIds,
} from '@/lib/hqNavPermissions';
import { apiHqGetSessionAccess, apiLogout } from '@/lib/api';
import { HQ_DISPLAY_CURRENCY_KEY } from '@/lib/hqCurrency';
import { HQ_FX_CACHE_KEY } from '@/lib/hqFxRates';

export type HqNavTab = 'dashboard' | 'tenants' | 'plans' | 'bootstrap';

export const HQ_SIDEBAR_W = 220;

type HqNavAccent = 'sky' | 'rose' | 'blue' | 'amber' | 'violet' | 'emerald' | 'indigo' | 'slate' | 'pink';

export type HqNavId =
  | HqNavTab
  | 'employerDashboard'
  | 'candidates'
  | 'kycVerified'
  | 'courses'
  | 'subscriptions'
  | 'leads'
  | 'clients'
  | 'crmDashboard'
  | 'team'
  | 'reports'
  | 'billing'
  | 'company'
  | 'employeeTickets'
  | 'employerTickets'
  | 'recycleBin'
  | 'portal'
  | 'events'
  | 'settings';

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
    id: 'kycVerified',
    label: 'KYC verified',
    href: '/hq/kyc-verified',
    icon: ShieldCheck,
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
  {
    id: 'employeeTickets',
    label: 'Tickets',
    href: '/hq/tickets?audience=employee',
    icon: Ticket,
    accent: 'rose',
    group: 'employees',
  },
  // Entrepreneurs = Phase 2
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
    id: 'tenants',
    label: 'Users',
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
  {
    id: 'employerTickets',
    label: 'Tickets',
    href: '/hq/tickets?audience=employer',
    icon: Ticket,
    accent: 'rose',
    group: 'employers',
  },
  {
    id: 'recycleBin',
    label: 'Recycle Bin',
    href: '/hq/recycle-bin',
    icon: Trash2,
    accent: 'slate',
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
    href: '/hq/billing',
    icon: CreditCard,
    accent: 'amber',
    group: 'ops',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/hq/settings',
    icon: Settings,
    accent: 'slate',
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
  audience: string | null,
  item: (typeof HQ_NAV_ITEMS)[number],
) {
  if (item.id === 'leads') return pathname === '/hq/leads' || pathname.startsWith('/hq/leads/');
  if (item.id === 'clients') return pathname === '/hq/clients' || pathname.startsWith('/hq/clients/');
  if (item.id === 'crmDashboard') {
    return pathname === '/hq/crm-dashboard' || pathname.startsWith('/hq/crm-dashboard/');
  }
  if (item.id === 'team') return pathname === '/hq/team' || pathname.startsWith('/hq/team/');
  if (item.id === 'reports') return pathname === '/hq/reports' || pathname.startsWith('/hq/reports/');
  if (item.id === 'settings') return pathname === '/hq/settings' || pathname.startsWith('/hq/settings/');
  if (item.id === 'company') return pathname === '/hq/company' || pathname.startsWith('/hq/company/');
  if (item.id === 'employeeTickets') {
    return (
      (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) && audience !== 'employer'
    );
  }
  if (item.id === 'employerTickets') {
    return (
      (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) && audience === 'employer'
    );
  }
  if (item.id === 'recycleBin') {
    return pathname === '/hq/recycle-bin' || pathname.startsWith('/hq/recycle-bin/');
  }
  if (item.id === 'candidates') {
    return pathname === '/hq/candidates' || pathname.startsWith('/hq/candidates/');
  }
  if (item.id === 'kycVerified') {
    return pathname === '/hq/kyc-verified' || pathname.startsWith('/hq/kyc-verified/');
  }
  if (item.id === 'courses') {
    return pathname === '/hq/courses' || pathname.startsWith('/hq/courses/');
  }
  if (item.id === 'subscriptions') {
    return pathname === '/hq/subscriptions' || pathname.startsWith('/hq/subscriptions/');
  }
  if (item.id === 'billing') return pathname === '/hq/billing' || pathname.startsWith('/hq/billing/');
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

function isEmployeesSectionActive(
  pathname: string,
  tab: string | null,
  view: string | null,
  audience: string | null,
) {
  if (pathname === '/hq/candidates' || pathname.startsWith('/hq/candidates/')) return true;
  if (pathname === '/hq/kyc-verified' || pathname.startsWith('/hq/kyc-verified/')) return true;
  if (pathname === '/hq/courses' || pathname.startsWith('/hq/courses/')) return true;
  if (pathname === '/hq/portal' || pathname.startsWith('/hq/portal/')) return true;
  if (pathname === '/hq/events' || pathname.startsWith('/hq/events/')) return true;
  if (pathname === '/hq/subscriptions' || pathname.startsWith('/hq/subscriptions/')) return true;
  if (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) {
    return audience !== 'employer';
  }
  if (pathname !== '/hq') return false;
  if (tab && tab !== 'dashboard') return false;
  return view !== 'employer' && view !== 'platform';
}

function isEmployersSectionActive(
  pathname: string,
  tab: string | null,
  view: string | null,
  audience: string | null,
) {
  if (pathname === '/hq/company' || pathname.startsWith('/hq/company/')) return true;
  if (pathname === '/hq/recycle-bin' || pathname.startsWith('/hq/recycle-bin/')) return true;
  if (pathname === '/hq/tickets' || pathname.startsWith('/hq/tickets/')) {
    return audience === 'employer';
  }
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const view = searchParams.get('view');
  const audience = searchParams.get('audience');
  const [navAccess, setNavAccess] = useState<HqNavAccess>(() =>
    typeof window === 'undefined'
      ? { mode: 'full', permissionIds: [], isHqTeamMember: false }
      : resolveHqNavAccess(),
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncAccess = async () => {
      const localAccess = resolveHqNavAccess();
      if (!localAccess.isHqTeamMember) {
        if (!cancelled) setNavAccess(localAccess);
        return;
      }

      try {
        const response = await apiHqGetSessionAccess();
        const data = response.data;
        if (data?.isHqTeamMember) {
          applyHqSessionAccess({
            isHqTeamMember: true,
            hqTeamMemberId: data.hqTeamMemberId,
            hqPermissionIds: data.hqPermissionIds || [],
            loginId: data.loginId,
            email: data.email,
          });
        }
      } catch {
        /* keep local session permissions */
      }

      if (!cancelled) setNavAccess(resolveHqNavAccess());
    };

    void syncAccess();

    const onStorage = (event: StorageEvent) => {
      if (event.key === HQ_PERMISSIONS_STORAGE_KEY || event.key === 'currentUser') {
        setNavAccess(resolveHqNavAccess());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const visibleItems = HQ_NAV_ITEMS.filter((item) => canAccessHqNav(item.id, navAccess));
  const employeeItems = visibleItems.filter((item) => item.group === 'employees');
  const employerItems = visibleItems.filter((item) => item.group === 'employers');
  const platformItems = visibleItems.filter((item) => item.group === 'platform');
  const crmItems = visibleItems.filter((item) => item.group === 'crm');
  const opsItems = visibleItems.filter((item) => item.group === 'ops');

  const employeesActive = isEmployeesSectionActive(pathname, tab, view, audience);
  const employersActive = isEmployersSectionActive(pathname, tab, view, audience);
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

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiLogout();
      writeHqPermissionIds(null);
      try {
        localStorage.removeItem(HQ_DISPLAY_CURRENCY_KEY);
        localStorage.removeItem(HQ_FX_CACHE_KEY);
      } catch {
        /* ignore */
      }
    } finally {
      window.location.assign('/hq/login');
    }
  };

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
              Portal + entrepreneur console
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
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, audience, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {employerItems.length > 0 ? (
          <CollapsibleNavGroup
            label="Entrepreneurs"
            icon={Briefcase}
            accentActiveClass="ring-indigo-400/30"
            open={employersOpen}
            onToggle={() => setEmployersOpen((open) => !open)}
            active={employersActive}
          >
            {employerItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, audience, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {platformItems.length > 0 ? (
          <ul className="mb-4 flex flex-col">
            {platformItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, audience, item)} />
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
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, audience, item)} nested />
              </li>
            ))}
          </CollapsibleNavGroup>
        ) : null}

        {opsItems.length > 0 ? (
          <ul className="mt-2 flex flex-col">
            {opsItems.map((item) => (
              <li key={item.id}>
                <HqNavItem item={item} active={isNavActive(pathname, tab, view, audience, item)} />
              </li>
            ))}
          </ul>
        ) : null}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] font-semibold text-[#c4d0db] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-60"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
          )}
          {loggingOut ? 'Signing out…' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}
