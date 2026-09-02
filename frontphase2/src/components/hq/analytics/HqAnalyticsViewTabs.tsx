'use client';

import Link from 'next/link';
import { Briefcase, LayoutDashboard, Users } from 'lucide-react';

export type HqAnalyticsView = 'employee' | 'employer' | 'platform';

const VIEWS: {
  id: HqAnalyticsView;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
}[] = [
  {
    id: 'employee',
    label: 'Employee',
    href: '/hq?view=employee',
    icon: Users,
    blurb: 'Phase 1 job-seekers',
  },
  {
    id: 'employer',
    label: 'Entrepreneur',
    href: '/hq?view=employer',
    icon: Briefcase,
    blurb: 'Phase 2 hiring orgs',
  },
  {
    id: 'platform',
    label: 'Platform',
    href: '/hq?view=platform',
    icon: LayoutDashboard,
    blurb: 'Tenants & plans',
  },
];

export function HqAnalyticsViewTabs({ active }: { active: HqAnalyticsView }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = active === view.id;
        return (
          <Link
            key={view.id}
            href={view.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-w-[9.5rem] flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm font-semibold leading-tight">{view.label}</span>
              <span
                className={`block text-[10px] leading-tight ${
                  isActive ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {view.blurb}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
