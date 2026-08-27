'use client';

import React from 'react';
import { CalendarDays, CheckCircle2, DollarSign, Users, UserRoundCheck } from 'lucide-react';
import type { PlacementStats } from '../../types/placement';
import { formatCurrency } from '../../utils/placements';
import { SummaryCard, type SummaryCardColor } from '../ui/SummaryCard';

interface KPICardsProps {
  stats: PlacementStats;
}

const cards: Array<{
  key: keyof PlacementStats;
  label: string;
  icon: React.ReactNode;
  color: SummaryCardColor;
  format?: 'currency';
}> = [
  {
    key: 'totalPlacements',
    label: 'Total Placements',
    icon: <Users className="h-4 w-4" strokeWidth={2.25} />,
    color: 'blue',
  },
  {
    key: 'placementsThisMonth',
    label: 'Placements This Month',
    icon: <CalendarDays className="h-4 w-4" strokeWidth={2.25} />,
    color: 'indigo',
  },
  {
    key: 'joiningPending',
    label: 'Joining Pending',
    icon: <UserRoundCheck className="h-4 w-4" strokeWidth={2.25} />,
    color: 'orange',
  },
  {
    key: 'joined',
    label: 'Joined',
    icon: <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />,
    color: 'green',
  },
  {
    key: 'revenueGenerated',
    label: 'Revenue Generated',
    icon: <DollarSign className="h-4 w-4" strokeWidth={2.25} />,
    color: 'purple',
    format: 'currency',
  },
];

export function KPICards({ stats }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      {cards.map((card) => {
        const raw = stats[card.key];
        const count =
          card.format === 'currency' ? formatCurrency(Number(raw) || 0) : Number(raw) || 0;

        return (
          <SummaryCard
            key={card.key}
            label={card.label}
            count={count}
            color={card.color}
            icon={card.icon}
          />
        );
      })}
    </div>
  );
}
