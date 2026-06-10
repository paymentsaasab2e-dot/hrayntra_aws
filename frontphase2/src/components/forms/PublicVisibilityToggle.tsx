'use client';

import { Eye, EyeOff } from 'lucide-react';

export function PublicVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
        visible
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
      }`}
      title={
        visible
          ? 'Visible on public job view, Phase 1 portal, and social posts'
          : 'Hidden from public job view, Phase 1 portal, and social posts'
      }
    >
      {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      {visible ? 'Visible to public' : 'Hidden from public'}
    </button>
  );
}
