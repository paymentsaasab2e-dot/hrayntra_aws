import React, { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  ArrowRightLeft,
  ChevronDown,
  Download,
  Mail,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkActionsProps {
  selectedIds: string[];
  onMoveStage: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
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
  onMoveStage,
  onDelete,
  onAssignRecruiter,
  onSendEmail,
  onAddTag,
  onExport,
  onReject,
  onDeselect,
}) => {
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { key: 'move-stage', label: 'Move Stage', icon: ArrowRightLeft, onClick: onMoveStage },
    { key: 'assign', label: 'Assign Recruiter', icon: User, onClick: onAssignRecruiter },
    { key: 'email', label: 'Send Email', icon: Mail, onClick: onSendEmail },
    { key: 'tag', label: 'Add Tag', icon: Tag, onClick: onAddTag },
    { key: 'export', label: 'Export', icon: Download, onClick: onExport },
    { key: 'reject', label: 'Reject', icon: Trash2, onClick: onReject, destructive: true },
    { key: 'delete', label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true },
  ];

  return (
    <AnimatePresence initial={false}>
      {selectedIds.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-5 left-[14.5rem] right-10 z-40 rounded-xl border border-slate-800 bg-slate-950/95 px-3 py-2.5 text-white shadow-2xl shadow-slate-950/40 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                <BadgeCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'} selected
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  Use bulk actions to manage the selected candidates.
                </p>
              </div>
            </div>

            <div className="hidden flex-shrink-0 items-center gap-1.5 xl:flex">
              {actions.map((action) => (
                <ActionButton
                  key={action.key}
                  label={action.label}
                  icon={action.icon}
                  destructive={action.destructive}
                  onClick={() => action.onClick(selectedIds)}
                />
              ))}
              <button
                type="button"
                onClick={onDeselect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              >
                <X size={14} />
                Clear
              </button>
            </div>

            <div className="relative xl:hidden" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 shadow-sm"
              >
                Actions
                <ChevronDown size={16} className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {mobileMenuOpen ? (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-xl">
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
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-slate-100 hover:bg-slate-800'
                      }`}
                    >
                      <action.icon size={16} />
                      {action.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      onDeselect();
                      setMobileMenuOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
                  >
                    <X size={16} />
                    Clear
                  </button>
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
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
        destructive
          ? 'border-red-500/30 bg-red-600 text-white hover:bg-red-700'
          : 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
