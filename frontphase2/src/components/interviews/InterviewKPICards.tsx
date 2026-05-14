import React from 'react';
import { Calendar, CheckCircle2, Clock3, MessageSquare } from 'lucide-react';
import type { InterviewKpi } from '../../types/interview.types';

const iconMap = {
  calendar: Calendar,
  clock: Clock3,
  message: MessageSquare,
  check: CheckCircle2,
};

const accentMap = {
  blue: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100',
  orange: 'bg-orange-50 text-orange-600 ring-1 ring-orange-100',
  purple: 'bg-purple-50 text-purple-600 ring-1 ring-purple-100',
  green: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
};

interface InterviewKPICardsProps {
  items: InterviewKpi[];
}

export function InterviewKPICards({ items }: InterviewKPICardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const accentClass = accentMap[item.accent as keyof typeof accentMap] || accentMap.blue;

        return (
          <div
            key={item.title}
            className="rounded-xl border border-indigo-100/60 bg-white/70 p-4 shadow-[0_8px_28px_-14px_rgba(59,130,246,0.14)] backdrop-blur-sm transition-shadow hover:shadow-[0_12px_36px_-12px_rgba(79,70,229,0.14)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{item.title}</p>
                <p className="mt-2 text-lg font-bold leading-7 text-slate-900">{item.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${accentClass}`}>
                <Icon className="size-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">+12%</span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
