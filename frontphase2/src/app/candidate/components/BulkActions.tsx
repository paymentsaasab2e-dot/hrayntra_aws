import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  ArrowRightLeft,
  CalendarPlus,
  ChevronDown,
  Download,
  Mail,
  Send,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkActionsProps {
  selectedIds: string[];
  onMoveStage?: (ids: string[]) => void;
  onDelete?: (ids: string[]) => void;
  onAssignRecruiter?: (ids: string[]) => void;
  onSendEmail?: (ids: string[]) => void;
  onAddTag?: (ids: string[]) => void;
  onExport?: (ids: string[]) => void;
  onReject?: (ids: string[]) => void;
  onScheduleInterview?: (ids: string[]) => void;
  onSubmitToClient?: (ids: string[]) => void;
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
  onScheduleInterview,
  onSubmitToClient,
  onDeselect,
}) => {
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    onMoveStage ? { key: 'move-stage', label: 'Move Stage', icon: ArrowRightLeft, onClick: onMoveStage } : null,
    onScheduleInterview
      ? { key: 'schedule-interview', label: 'Schedule Interview', icon: CalendarPlus, onClick: onScheduleInterview }
      : null,
    onSubmitToClient
      ? { key: 'submit-to-client', label: 'Submit to Client', icon: Send, onClick: onSubmitToClient }
      : null,
    onAssignRecruiter ? { key: 'assign', label: 'Assign Recruiter', icon: User, onClick: onAssignRecruiter } : null,
    onSendEmail ? { key: 'email', label: 'Send Email', icon: Mail, onClick: onSendEmail } : null,
    onAddTag ? { key: 'tag', label: 'Add Tag', icon: Tag, onClick: onAddTag } : null,
    onExport ? { key: 'export', label: 'Export', icon: Download, onClick: onExport } : null,
    onReject ? { key: 'reject', label: 'Reject', icon: Trash2, onClick: onReject, destructive: true } : null,
    onDelete ? { key: 'delete', label: 'Delete', icon: Trash2, onClick: onDelete, destructive: true } : null,
  ].filter(Boolean) as ActionConfig[];

  if (!mounted || selectedIds.length === 0) {
    return null;
  }

  const bar = (
    <AnimatePresence initial={false}>
      <motion.div
        role="toolbar"
        aria-label="Bulk candidate actions"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-auto fixed top-[calc(50%+15rem)] z-[80] -translate-y-1/2 rounded-xl border border-slate-800 bg-slate-950/95 px-4 py-2.5 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-md left-3 right-3 w-auto sm:left-[15.5rem] sm:right-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-shrink-0 items-center gap-2 border-r border-slate-700/80 pr-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 shrink-0">
              <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-white">
                {selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 sm:flex">
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              >
                <X size={13} />
                Clear
              </button>
            </div>

            <div className="relative shrink-0 sm:hidden" ref={mobileMenuRef}>
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
    </AnimatePresence>
  );

  return createPortal(bar, document.body);
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
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
