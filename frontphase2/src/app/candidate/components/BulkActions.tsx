import React, { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  Download,
  Mail,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkActionsProps {
  selectedIds: string[];
  onAddToPipeline: (ids: string[]) => void;
  onAssignRecruiter: (ids: string[]) => void;
  onSendEmail: (ids: string[]) => void;
  onAddTag: (ids: string[]) => void;
  onExport: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  onDeselect: () => void;
}

interface ActionConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: (ids: string[]) => void;
  destructive?: boolean;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  onAddToPipeline,
  onAssignRecruiter,
  onSendEmail,
  onAddTag,
  onExport,
  onReject,
  onDeselect,
}) => {
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectedIds.length > 0;
    }
  }, [selectedIds.length]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handleOutside = (event: MouseEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mobileMenuOpen]);

  const actions: ActionConfig[] = [
    { key: 'pipeline', label: 'Add to Pipeline', icon: Briefcase, onClick: onAddToPipeline },
    { key: 'assign', label: 'Assign Recruiter', icon: User, onClick: onAssignRecruiter },
    { key: 'email', label: 'Send Email', icon: Mail, onClick: onSendEmail },
    { key: 'tag', label: 'Add Tag', icon: Tag, onClick: onAddTag },
    { key: 'export', label: 'Export', icon: Download, onClick: onExport },
    { key: 'reject', label: 'Reject', icon: Trash2, onClick: onReject, destructive: true },
  ];

  return (
    <AnimatePresence initial={false}>
      {selectedIds.length > 0 ? (
        <motion.div
          initial={{ height: 0, opacity: 0, y: -10 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-b border-slate-200 border-t bg-blue-50/80 shadow-sm"
        >
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={checkboxRef}
                type="checkbox"
                checked={false}
                readOnly
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-900">
                {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'} selected
              </span>
              <button
                type="button"
                onClick={onDeselect}
                className="text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Deselect all
              </button>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {actions.map((action) => (
                <ActionButton
                  key={action.key}
                  label={action.label}
                  icon={action.icon}
                  destructive={action.destructive}
                  onClick={() => action.onClick(selectedIds)}
                />
              ))}
            </div>

            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                Actions
                <ChevronDown size={16} className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {mobileMenuOpen ? (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {actions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => {
                        action.onClick(selectedIds);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                        action.destructive
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <action.icon size={16} />
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

function ActionButton({
  label,
  icon: Icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
        destructive
          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
