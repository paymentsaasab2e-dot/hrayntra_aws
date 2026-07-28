'use client';

import { HqStatCard } from '../hqUi';

export type HqAnalyticsKpi = {
  label: string;
  value: string | number;
  delta?: string;
  active?: boolean;
};

export function HqAnalyticsKpiGrid({ items }: { items: HqAnalyticsKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <HqStatCard
          key={item.label}
          label={item.label}
          value={item.value}
          delta={item.delta}
          active={item.active}
        />
      ))}
    </div>
  );
}
