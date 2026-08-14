'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type DrawerTabIcon = LucideIcon | React.ComponentType<{ className?: string; size?: number }>;

export type DrawerTabBarItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: DrawerTabIcon;
  badge?: React.ReactNode | number | string | null;
};

type DrawerTabBarProps<T extends string> = {
  tabs: ReadonlyArray<DrawerTabBarItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  /** `bar` wraps tabs in drawer chrome; `embedded` is just the pill track. */
  variant?: 'bar' | 'embedded';
  className?: string;
  trackClassName?: string;
};

function badgeNode(badge: DrawerTabBarItem['badge'], active: boolean) {
  if (badge == null || badge === false || badge === '') return null;
  if (typeof badge === 'number') {
    if (badge <= 0) return null;
    return (
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
          active
            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
            : 'bg-white text-slate-600 ring-1 ring-slate-200/90'
        }`}
      >
        {badge}
      </span>
    );
  }
  if (typeof badge === 'string') {
    return (
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          active
            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
            : 'bg-white text-slate-600 ring-1 ring-slate-200/90'
        }`}
      >
        {badge}
      </span>
    );
  }
  return badge;
}

export function DrawerTabBar<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel = 'Drawer sections',
  variant = 'bar',
  className = '',
  trackClassName = '',
}: DrawerTabBarProps<T>) {
  const track = (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/95 p-1.5 ring-1 ring-slate-200/80 [scrollbar-width:thin] ${trackClassName}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-indigo-700 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-100'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900'
            }`}
          >
            {Icon ? (
              <Icon
                size={15}
                className={active ? 'h-[15px] w-[15px] shrink-0 text-indigo-600' : 'h-[15px] w-[15px] shrink-0 text-slate-500'}
              />
            ) : null}
            {tab.label}
            {badgeNode(tab.badge, active)}
          </button>
        );
      })}
    </div>
  );

  if (variant === 'embedded') {
    return <div className={className}>{track}</div>;
  }

  return (
    <div className={`shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6 ${className}`}>
      {track}
    </div>
  );
}
