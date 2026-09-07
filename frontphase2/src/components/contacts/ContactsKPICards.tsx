'use client';

import React from 'react';
import { Users, UserCheck, Building2, Briefcase } from 'lucide-react';
import type { ContactStats } from '../../lib/api';
import { PH2_KPI_ROW_CLASS } from '../layout/Ph2ModulePageLayout';

interface ContactsKPICardsProps {
  stats: ContactStats;
}

export function ContactsKPICards({ stats }: ContactsKPICardsProps) {
  const cards = [
    {
      id: 'total',
      label: 'Total Contacts',
      value: stats.total,
      icon: Users,
      panel: 'bg-gradient-to-br from-blue-50 via-white to-indigo-50/80',
      text: 'text-blue-900',
      iconWrap: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-200/80 shadow-inner',
      ring: 'border-blue-200/90',
    },
    {
      id: 'candidates',
      label: 'Candidates',
      value: stats.candidates,
      icon: UserCheck,
      panel: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/70',
      text: 'text-emerald-900',
      iconWrap: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-200/80 shadow-inner',
      ring: 'border-emerald-200/90',
    },
    {
      id: 'clientContacts',
      label: 'Client Contacts',
      value: stats.clientContacts,
      icon: Building2,
      panel: 'bg-gradient-to-br from-violet-50 via-white to-purple-50/75',
      text: 'text-violet-900',
      iconWrap: 'bg-violet-500/15 text-violet-700 ring-1 ring-violet-200/80 shadow-inner',
      ring: 'border-violet-200/90',
    },
    {
      id: 'hiringManagers',
      label: 'Hiring Managers',
      value: stats.hiringManagers,
      icon: Briefcase,
      panel: 'bg-gradient-to-br from-amber-50 via-white to-orange-50/70',
      text: 'text-amber-900',
      iconWrap: 'bg-amber-400/22 text-amber-800 ring-1 ring-amber-200/90 shadow-inner',
      ring: 'border-amber-200/90',
    },
  ];

  return (
    <div className={PH2_KPI_ROW_CLASS}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`min-w-0 overflow-hidden rounded-lg border p-1.5 shadow-ph2-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ph2-card-hover sm:rounded-xl sm:p-3 lg:p-4 ${card.panel} ${card.ring}`}
          >
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${card.iconWrap}`}>
                <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <div className={`break-all text-sm font-bold tabular-nums sm:text-2xl ${card.text}`}>{card.value}</div>
                <div className={`mt-0.5 break-words text-[8px] font-semibold uppercase tracking-wider opacity-80 sm:text-xs ${card.text}`}>
                  {card.label}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
