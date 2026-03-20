'use client';

import React from 'react';
import { CheckSquare, Clock, TrendingUp, UserCheck } from 'lucide-react';

export type TaskAnalyticsCardId = 'completed_today' | 'overdue' | 'avg_completion' | 'productivity';

export interface TaskAnalyticsData {
  completedToday: number;
  overdueCount: number;
  avgCompletionTimeDays: number;
  productivityPercent: number;
  /** e.g. "+8% vs yesterday" */
  trendCompletedToday?: string;
  /** e.g. "2 tasks need attention" */
  helperOverdue?: string;
  /** e.g. "Based on current week performance" */
  helperAvgTime?: string;
  /** e.g. "Based on current week" */
  helperProductivity?: string;
}

export interface TaskAnalyticsCardsProps {
  data: TaskAnalyticsData;
  onCardClick?: (cardId: TaskAnalyticsCardId) => void;
  className?: string;
}

function getProductivityMetricClass(percent: number): string {
  if (percent >= 80) return 'text-emerald-600';
  if (percent >= 60) return 'text-amber-600';
  return 'text-red-600';
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
const CARD_CONFIG: Record<
  TaskAnalyticsCardId,
  { title: string; icon: IconComponent; iconBg: string }
> = {
  completed_today: {
    title: 'Tasks Completed Today',
    icon: CheckSquare as IconComponent,
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  overdue: {
    title: 'Overdue Tasks',
    icon: Clock as IconComponent,
    iconBg: 'bg-red-100 text-red-600',
  },
  avg_completion: {
    title: 'Average Completion Time',
    icon: TrendingUp as IconComponent,
    iconBg: 'bg-blue-100 text-blue-600',
  },
  productivity: {
    title: 'Recruiter Productivity',
    icon: UserCheck as IconComponent,
    iconBg: 'bg-violet-100 text-violet-600',
  },
};

export function TaskAnalyticsCards({ data, onCardClick, className = '' }: TaskAnalyticsCardsProps) {
  const cards: { id: TaskAnalyticsCardId; metric: string; helper?: string }[] = [
    {
      id: 'completed_today',
      metric: String(data.completedToday),
      helper: data.trendCompletedToday,
    },
    {
      id: 'overdue',
      metric: String(data.overdueCount),
      helper: data.helperOverdue ?? (data.overdueCount > 0 ? `${data.overdueCount} task${data.overdueCount === 1 ? '' : 's'} need attention` : undefined),
    },
    {
      id: 'avg_completion',
      metric: `${data.avgCompletionTimeDays.toFixed(1)} days`,
      helper: data.helperAvgTime ?? 'Based on current week performance',
    },
    {
      id: 'productivity',
      metric: `${data.productivityPercent}%`,
      helper: data.helperProductivity ?? 'Based on current week',
    },
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {cards.map(({ id, metric, helper }) => {
        const config = CARD_CONFIG[id];
        const Icon = config.icon;
        const isProductivity = id === 'productivity';
        const productivityClass = isProductivity ? getProductivityMetricClass(data.productivityPercent) : '';

        return (
          <button
            key={id}
            type="button"
            onClick={() => onCardClick?.(id)}
            className={`bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left w-full ${onCardClick ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-2xl font-bold text-slate-900 ${isProductivity ? productivityClass : ''}`}>
                {metric}
              </div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                {config.title}
              </div>
              {helper && (
                <p className="text-[11px] text-slate-400 mt-1.5">{helper}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
