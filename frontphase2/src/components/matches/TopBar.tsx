import React from 'react';
import { Bell } from 'lucide-react';
import type { ActiveView } from './types';

interface TopBarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
}

export default function TopBar({ activeView, onChangeView }: TopBarProps) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-6 py-5 sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900">Matches</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Smart candidate job matching powered by Recruity AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-[#E5E7EB] bg-white p-1">
            <button
              type="button"
              onClick={() => onChangeView('internal')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeView === 'internal'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Internal View
            </button>
            <button
              type="button"
              onClick={() => onChangeView('client')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeView === 'client'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Client Preview
            </button>
          </div>

          <button
            type="button"
            className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-rose-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
