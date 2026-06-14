'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Building,
  Building2,
  Database,
  Globe,
  LayoutDashboard,
  Server,
  Shield,
  Tag,
  Target,
  Terminal,
  Users,
} from 'lucide-react';

export type HqNavTab = 'dashboard' | 'tenants' | 'provision' | 'plans' | 'bootstrap';

export const HQ_NAV_ITEMS: {
  id: HqNavTab | 'leads' | 'company' | 'portal';
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/hq', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', href: '/hq?tab=tenants', icon: Users },
  { id: 'provision', label: 'Create tenant', href: '/hq?tab=provision', icon: Building2 },
  { id: 'plans', label: 'Plans', href: '/hq?tab=plans', icon: Tag },
  { id: 'bootstrap', label: 'Local bootstrap', href: '/hq?tab=bootstrap', icon: Terminal },
  { id: 'leads', label: 'CRM Leads', href: '/hq/leads', icon: Target },
  { id: 'company', label: 'Companies', href: '/hq/company', icon: Building },
  { id: 'portal', label: 'Portal', href: '/hq/portal', icon: Globe },
];

function isNavActive(pathname: string, tab: string | null, item: (typeof HQ_NAV_ITEMS)[number]) {
  if (item.id === 'leads') return pathname === '/hq/leads';
  if (item.id === 'company') return pathname === '/hq/company';
  if (item.id === 'portal') return pathname === '/hq/portal';
  if (pathname !== '/hq') return false;
  if (item.id === 'dashboard') return !tab || tab === 'dashboard';
  return tab === item.id;
}

export function HqSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');

  return (
    <aside className="flex w-[17.5rem] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 shadow-sm">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Headquarters</h1>
        <p className="mt-1 text-xs leading-snug text-slate-500">Platform console</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="HQ sections">
        <ul className="flex flex-col gap-1">
          {HQ_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, tab, item);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-slate-100 p-4">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
