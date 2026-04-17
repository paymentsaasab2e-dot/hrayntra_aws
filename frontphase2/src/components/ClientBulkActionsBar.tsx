import React from 'react';
import { UserPlus, Tag, Mail, Download, Archive, X } from 'lucide-react';

interface ClientBulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
}

export function ClientBulkActionsBar({ selectedCount, onClear }: ClientBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-8 border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 border-r border-white/20 pr-8">
        <span className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full text-xs font-bold">
          {selectedCount}
        </span>
        <span className="text-sm font-medium">Clients Selected</span>
        <button 
          onClick={onClear}
          className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-6">
        <button className="flex flex-col items-center gap-1 group transition-all">
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/20 transition-all">
            <UserPlus className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/70">Assign Owner</span>
        </button>

        <button className="flex flex-col items-center gap-1 group transition-all">
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/20 transition-all">
            <Tag className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/70">Change Status</span>
        </button>

        <button className="flex flex-col items-center gap-1 group transition-all">
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/20 transition-all">
            <Mail className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/70">Send Email</span>
        </button>

        <button className="flex flex-col items-center gap-1 group transition-all">
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/20 transition-all">
            <Download className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/70">Export</span>
        </button>

        <button className="flex flex-col items-center gap-1 group transition-all">
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-rose-500/30 transition-all text-rose-400">
            <Archive className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-rose-400">Archive</span>
        </button>
      </div>
    </div>
  );
}
