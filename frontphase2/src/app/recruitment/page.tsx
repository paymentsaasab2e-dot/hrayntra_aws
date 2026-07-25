'use client';

import React from 'react';
import Link from 'next/link';
import {
  Award,
  Briefcase,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  UserRound,
} from 'lucide-react';

const MODULES = [
  {
    href: '/job',
    label: 'Jobs',
    description: 'Manage open roles, requisitions, and hiring needs.',
    icon: Briefcase,
    accent: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    href: '/candidate',
    label: 'Candidates',
    description: 'Browse talent profiles and track applicant progress.',
    icon: UserRound,
    accent: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    href: '/interviews',
    label: 'Interviews',
    description: 'Schedule rounds and review interview outcomes.',
    icon: Calendar,
    accent: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  },
  {
    href: '/placement',
    label: 'Placements',
    description: 'Track offers, joinings, and closed placements.',
    icon: Award,
    accent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
] as const;

export default function RecruitmentDashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <LayoutDashboard className="text-indigo-600" size={26} />
          Recruitment Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Jump into jobs, candidates, interviews, and placements from one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ href, label, description, icon: Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className={`group flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${accent}`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-inherit">
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">{label}</h2>
                <ChevronRight
                  size={16}
                  className="text-slate-400 transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
