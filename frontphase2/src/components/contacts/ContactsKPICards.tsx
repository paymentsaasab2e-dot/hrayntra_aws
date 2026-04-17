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
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'candidates',
      label: 'Candidates',
      value: stats.candidates,
      icon: UserCheck,
      color: 'bg-green-100 text-green-600',
    },
    {
      id: 'clientContacts',
      label: 'Client Contacts',
      value: stats.clientContacts,
      icon: Building2,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      id: 'hiringManagers',
      label: 'Hiring Managers',
      value: stats.hiringManagers,
      icon: Briefcase,
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center`}>
                <Icon size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-0.5">
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
