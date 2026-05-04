'use client';

import React from 'react';
import { Users, UserCheck, Building2, Briefcase } from 'lucide-react';
import type { ContactStats } from '../../lib/api';

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`rounded-xl border p-5 shadow-ph2-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ph2-card-hover ${card.panel} ${card.ring}`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconWrap}`}>
                <Icon size={22} strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <div className={`text-2xl font-bold tabular-nums ${card.text}`}>{card.value}</div>
                <div className={`text-xs font-semibold uppercase tracking-wider mt-0.5 opacity-80 ${card.text}`}>
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
