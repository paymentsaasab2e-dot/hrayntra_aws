'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  UserPlus, 
  Briefcase, 
  Building2, 
  CalendarPlus, 
  CheckSquare, 
  Zap,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const actions = [
  { icon: FileUp, label: 'Import Resume', color: 'bg-blue-50 text-blue-600' },
  { icon: UserPlus, label: 'Add Candidate', color: 'bg-green-50 text-green-600' },
  { icon: Briefcase, label: 'Add Job', color: 'bg-purple-50 text-purple-600' },
  { icon: Building2, label: 'Add Client', color: 'bg-orange-50 text-orange-600' },
  { icon: CalendarPlus, label: 'Schedule Interview', color: 'bg-pink-50 text-pink-600' },
  { icon: CheckSquare, label: 'Add Task / Activity', color: 'bg-indigo-50 text-indigo-600' },
  { icon: Zap, label: 'Add Lead', color: 'bg-yellow-50 text-yellow-600' },
];

export function QuickActionPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-md group ${
          isOpen ? 'bg-teal-400 scale-110' : 'bg-teal-500 hover:bg-teal-400'
        }`}
        title="Quick Create"
      >
        <Plus className={`w-6 h-6 text-white transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 z-50 overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-slate-50 transition-colors group text-center"
                >
                  <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
