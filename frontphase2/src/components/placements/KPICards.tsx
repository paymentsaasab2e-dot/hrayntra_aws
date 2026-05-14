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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      {cards.map((card) => {
        const value =
          card.key === 'revenueGenerated'
            ? formatCurrency(stats.revenueGenerated)
            : stats[card.key as keyof PlacementStats];

        return (
          <div
            key={card.key}
            className="flex items-center gap-3 rounded-xl border border-indigo-100/60 bg-white/70 p-4 shadow-[0_8px_28px_-14px_rgba(59,130,246,0.14)] backdrop-blur-sm transition-shadow hover:shadow-[0_12px_36px_-12px_rgba(79,70,229,0.14)]"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.color}`}>
              <card.icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="truncate text-lg font-bold text-slate-900">{value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
