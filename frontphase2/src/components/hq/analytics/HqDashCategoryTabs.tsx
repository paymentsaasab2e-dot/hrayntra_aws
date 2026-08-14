'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

export type HqDashCategoryTab = {
  id: string;
  label: string;
  blurb?: string;
};

type Props = {
  tabs: HqDashCategoryTab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Unique layout id so multiple dashboards on one page don't share the pill. */
  instanceId?: string;
};

/** Horizontal category tabs — gradient active pill with spring slide on change. */
export function HqDashCategoryTabs({
  tabs,
  value,
  onChange,
  className = '',
  instanceId,
}: Props) {
  const active = tabs.find((t) => t.id === value) || tabs[0];
  const autoId = useId();
  const layoutKey = `hq-dash-tab-pill-${instanceId || autoId}`;
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ x: 0, y: 0, w: 0, h: 0, ready: false });

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const btn = btnRefs.current[value];
      if (!track || !btn) return;
      const t = track.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      setPill({
        x: b.left - t.left,
        y: b.top - t.top,
        w: b.width,
        h: b.height,
        ready: true,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, tabs]);

  return (
    <div className={`mb-4 ${className}`}>
      <div
        ref={trackRef}
        className="relative flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1.5 shadow-inner"
      >
        {pill.ready ? (
          <motion.div
            layoutId={layoutKey}
            className="pointer-events-none absolute z-0 rounded-xl shadow-[0_12px_28px_-14px_rgba(15,23,42,0.55)]"
            style={{
              backgroundImage: 'linear-gradient(115deg, #0F172A 0%, #1E293B 42%, #1E3A8A 100%)',
            }}
            initial={false}
            animate={{
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
          />
        ) : null}

        {tabs.map((tab) => {
          const on = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              ref={(el) => {
                btnRefs.current[tab.id] = el;
              }}
              onClick={() => onChange(tab.id)}
              className={`relative z-10 rounded-xl px-3.5 py-2 text-left text-[12px] font-semibold transition sm:px-4 ${
                on
                  ? 'text-white'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active?.blurb ? (
        <p className="mt-2 text-[11px] text-slate-500">{active.blurb}</p>
      ) : null}
    </div>
  );
}
