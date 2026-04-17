import React from 'react';
import { 
  Briefcase, 
  RefreshCcw, 
  Mail, 
  Tag, 
  User, 
  Download, 
  Star, 
  Trash2,
  X,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CandidateBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
}

export const CandidateBulkActions: React.FC<CandidateBulkActionsProps> = ({ selectedCount, onClearSelection }) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700"
        >
          <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Candidates Selected</span>
            <button 
              onClick={onClearSelection}
              className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <ActionButton icon={Briefcase} label="Assign Job" />
            <ActionButton icon={RefreshCcw} label="Change Stage" />
            <ActionButton icon={Mail} label="Send Email" />
            <ActionButton icon={MessageCircle} label="WhatsApp" />
            <ActionButton icon={Tag} label="Add Tags" />
            <ActionButton icon={User} label="Assign Owner" />
            <ActionButton icon={Download} label="Export" />
            <ActionButton icon={Star} label="Hotlist" />
            <ActionButton icon={Trash2} label="Reject" color="text-rose-400 hover:bg-rose-500/10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ActionButton = ({ icon: Icon, label, color = "text-slate-300 hover:bg-slate-800" }: { icon: any, label: string, color?: string }) => (
  <button className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all group ${color}`}>
    <Icon size={18} />
    <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-800 px-2 py-1 rounded pointer-events-none whitespace-nowrap shadow-xl">
      {label}
    </span>
  </button>
);
