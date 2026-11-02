'use client';

type Props = {
  used: number;
  limit: number;
  tier?: string;
  onUpgrade?: () => void;
  loading?: boolean;
};

export function JobPostingQuotaMeter({ used, limit, tier, onUpgrade, loading }: Props) {
  const full = used >= limit && limit > 0;
  const label = loading
    ? 'Job posts…'
    : `Job posts this month: ${used} / ${limit}${tier === 'premium' ? ' · Premium' : ''}`;

  return (
    <div
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${
        full
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-white text-slate-700'
      }`}
      title={label}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">
        {loading ? '…' : `${used}/${limit}`}
      </span>
      {full && onUpgrade ? (
        <button
          type="button"
          onClick={onUpgrade}
          className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
        >
          Upgrade
        </button>
      ) : null}
    </div>
  );
}
