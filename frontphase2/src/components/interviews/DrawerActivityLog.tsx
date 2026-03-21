import React from 'react';
import type { InterviewActivity } from '../../types/interview.types';

const colorMap = {
  blue: 'bg-[#2563EB]',
  green: 'bg-[#16A34A]',
  orange: 'bg-[#F59E0B]',
  red: 'bg-[#DC2626]',
  slate: 'bg-[#6B7280]',
};

interface DrawerActivityLogProps {
  items: InterviewActivity[];
}

export function DrawerActivityLog({ items }: DrawerActivityLogProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <div className={`size-3 rounded-full ${colorMap[item.color]}`} />
            <div className="mt-2 h-full w-px bg-[#E5E7EB]" />
          </div>
          <div className="pb-5">
            <div className="text-sm font-semibold text-[#111827]">{item.action}</div>
            <div className="text-sm text-[#4B5563]">{item.user}</div>
            <div className="text-xs text-[#9CA3AF]">{item.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
