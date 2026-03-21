import React from 'react';
import { Sparkles, Users } from 'lucide-react';
import type { MatchMode } from './types';

interface AIManualToggleProps {
  activeTab: MatchMode;
  onChange: (mode: MatchMode) => void;
}

export default function AIManualToggle({ activeTab, onChange }: AIManualToggleProps) {
  return (
    <div className="inline-flex rounded-2xl border border-[#E5E7EB] bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('ai')}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'ai'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Sparkles size={16} />
        AI Matches
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'manual'
            ? 'bg-[#2563EB] text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Users size={16} />
        Manual Matches
      </button>
    </div>
  );
}
