import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import type { InterviewPanelMember } from '../../types/interview.types';

interface PanelAssignmentModalProps {
  isOpen: boolean;
  interviewers: InterviewPanelMember[];
  initialSelectedIds: string[];
  onClose: () => void;
  onSave: (panelIds: string[]) => Promise<void>;
}

export function PanelAssignmentModal({
  isOpen,
  interviewers,
  initialSelectedIds,
  onClose,
  onSave,
}: PanelAssignmentModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(
    () =>
      interviewers.filter(
        (interviewer) =>
          interviewer.name.toLowerCase().includes(search.toLowerCase()) ||
          interviewer.email.toLowerCase().includes(search.toLowerCase())
      ),
    [interviewers, search]
  );

  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      setSearch('');
    }
  }, [initialSelectedIds, isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[130]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="absolute right-0 top-0 z-10 flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[560px]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Panel Assignment</h3>
                <p className="text-sm text-[#6B7280]">Search and assign interviewers to this round.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6]">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search interviewer by name or email"
                  className="w-full rounded-xl border border-[#E5E7EB] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-2">
                {filtered.map((interviewer) => {
                  const selected = selectedIds.includes(interviewer.id);
                  return (
                    <label
                      key={interviewer.id}
                      className={`flex items-center justify-between rounded-xl border p-4 ${
                        selected ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E5E7EB]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(interviewer.id)
                                ? current.filter((id) => id !== interviewer.id)
                                : [...current, interviewer.id]
                            )
                          }
                          className="size-4 rounded border-[#D1D5DB] text-[#2563EB]"
                        />
                        <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-[#2563EB]">
                          {interviewer.avatar}
                        </div>
                        <div>
                          <div className="font-semibold text-[#111827]">{interviewer.name}</div>
                          <div className="text-sm text-[#6B7280]">{interviewer.email}</div>
                        </div>
                      </div>
                      <div className="text-sm text-[#4B5563]">{interviewer.role}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#111827]">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await onSave(selectedIds);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Panel'}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
