'use client';

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
};

/** Horizontal category tabs shown under the always-visible KPI row. */
export function HqDashCategoryTabs({ tabs, value, onChange, className = '' }: Props) {
  const active = tabs.find((t) => t.id === value) || tabs[0];

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5">
        {tabs.map((tab) => {
          const on = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-left text-[12px] font-semibold transition sm:px-4 ${
                on
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
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
