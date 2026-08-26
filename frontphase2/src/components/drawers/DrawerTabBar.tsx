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
            ? 'bg-white/20 text-white ring-1 ring-white/30'
            : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
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
            ? 'bg-white/20 text-white ring-1 ring-white/30'
            : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
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
      className={`flex gap-1 overflow-x-auto rounded-2xl border border-indigo-100/60 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-violet-50/30 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${trackClassName}`}
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
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-slate-600 hover:bg-white/90 hover:text-indigo-800 hover:shadow-sm'
            }`}
          >
            {Icon ? (
              <Icon
                size={15}
                className={
                  active
                    ? 'h-[15px] w-[15px] shrink-0 text-white'
                    : 'h-[15px] w-[15px] shrink-0 text-indigo-400'
                }
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
    <div
      className={`shrink-0 border-b border-indigo-100/50 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-6 ${className}`}
    >
      {track}
    </div>
  );
}
