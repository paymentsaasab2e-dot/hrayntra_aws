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
  blue: 'bg-blue-50 text-[#2563EB]',
  orange: 'bg-orange-50 text-[#F59E0B]',
  purple: 'bg-purple-50 text-purple-600',
  green: 'bg-green-50 text-[#16A34A]',
};

interface InterviewKPICardsProps {
  items: InterviewKpi[];
}

export function InterviewKPICards({ items }: InterviewKPICardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const accentClass = accentMap[item.accent as keyof typeof accentMap] || accentMap.blue;

        return (
          <div key={item.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#6B7280]">{item.title}</p>
                <p className="mt-2 text-3xl font-bold text-[#111827]">{item.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${accentClass}`}>
                <Icon className="size-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="rounded-md bg-green-50 px-2 py-1 font-semibold text-[#16A34A]">+12%</span>
              <span className="text-[#6B7280]">vs last month</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
