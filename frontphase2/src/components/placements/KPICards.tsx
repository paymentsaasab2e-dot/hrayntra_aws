'use client';

import React from 'react';
import { CalendarDays, CheckCircle2, DollarSign, Users, UserRoundCheck } from 'lucide-react';
import type { PlacementStats } from '../../types/placement';
import { formatCurrency } from '../../utils/placements';

interface KPICardsProps {
  stats: PlacementStats;
}

const cards = [
  { key: 'totalPlacements', label: 'Total Placements', icon: Users, color: 'bg-[#3B82F6]' },
  { key: 'placementsThisMonth', label: 'Placements This Month', icon: CalendarDays, color: 'bg-[#6366F1]' },
  { key: 'joiningPending', label: 'Joining Pending', icon: UserRoundCheck, color: 'bg-[#F59E0B]' },
  { key: 'joined', label: 'Joined', icon: CheckCircle2, color: 'bg-[#10B981]' },
  { key: 'revenueGenerated', label: 'Revenue Generated', icon: DollarSign, color: 'bg-[#8B5CF6]' },
] as const;

export function KPICards({ stats }: KPICardsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {cards.map((card) => {
        const value =
          card.key === 'revenueGenerated'
            ? formatCurrency(stats.revenueGenerated)
            : stats[card.key as keyof PlacementStats];

        return (
          <div
            key={card.key}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.color}`}>
              <card.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
