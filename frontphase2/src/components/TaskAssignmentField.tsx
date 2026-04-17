'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Loader2, User } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { TaskAssignee } from '../app/Task&Activites/types';

export type AssignmentAuditEvent = {
  previousAssigneeId?: string;
  newAssigneeId: string;
  timestamp?: string;
};

export interface TaskAssignmentFieldProps {
  /** Single assignee id (supports multi in future via assigneeIds[]) */
  value: string;
  onChange: (assigneeId: string) => void;
  /** List of users that can be assigned */
  assignees: TaskAssignee[];
  /** Disable the field */
  disabled?: boolean;
  /** Show permission message and disable */
  noPermission?: boolean;
  /** Show "Notify assignee" checkbox below the field */
  showNotifyCheckbox?: boolean;
  notifyAssignee?: boolean;
  onNotifyChange?: (value: boolean) => void;
  /** Called when assignee is changed (for audit); previousAssigneeId set on reassign */
  onAssignmentChange?: (event: AssignmentAuditEvent) => void;
  /** Future: allow multiple assignees */
  multiple?: boolean;
  /** Loading state for search (e.g. async user fetch) */
  searchLoading?: boolean;
  placeholder?: string;
  required?: boolean;
  /** Label override */
  label?: string;
}

export function TaskAssignmentField({
  value,
  onChange,
  assignees,
  disabled = false,
  noPermission = false,
  showNotifyCheckbox = false,
  notifyAssignee = true,
  onNotifyChange,
  onAssignmentChange,
  multiple = false,
  searchLoading = false,
  placeholder = 'Search or select user',
  required = true,
  label = 'Assign To',
}: TaskAssignmentFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const isDisabled = disabled || noPermission;
  const selectedAssignee = useMemo(() => assignees.find((a) => a.id === value), [assignees, value]);

  const filteredAssignees = useMemo(() => {
    if (!search.trim()) return assignees;
    const q = search.trim().toLowerCase();
    return assignees.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.role && a.role.toLowerCase().includes(q))
    );
  }, [assignees, search]);

  const handleSelect = (assignee: TaskAssignee) => {
    const previousId = value || undefined;
    onChange(assignee.id);
    setOpen(false);
    setSearch('');
    if (previousId !== assignee.id && onAssignmentChange) {
      onAssignmentChange({
        previousAssigneeId: previousId,
        newAssigneeId: assignee.id,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const previousId = value || undefined;
    onChange('');
    if (previousId && onAssignmentChange) {
      onAssignmentChange({
        previousAssigneeId: previousId,
        newAssigneeId: '',
        timestamp: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {noPermission && (
        <p className="text-xs text-amber-600 font-medium mb-2">
          You do not have permission to reassign this task.
        </p>
      )}

      <button
        type="button"
        onClick={() => !isDisabled && setOpen((v) => !v)}
        disabled={isDisabled}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedAssignee ? (
            <>
              {selectedAssignee.avatar ? (
                <ImageWithFallback
                  src={selectedAssignee.avatar}
                  alt=""
                  className="w-6 h-6 rounded-full shrink-0 border border-slate-200"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User size={12} className="text-slate-500" />
                </div>
              )}
              <div className="min-w-0 text-left">
                <span className="font-medium text-slate-900 truncate block">{selectedAssignee.name}</span>
                {selectedAssignee.role && (
                  <span className="text-xs text-slate-500 truncate block">{selectedAssignee.role}</span>
                )}
              </div>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedAssignee && !multiple && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(e); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClear(); } }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Clear assignee"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or role..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {searchLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : filteredAssignees.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No users found.
              </div>
            ) : (
              filteredAssignees.map((assignee) => {
                const isSelected = value === assignee.id;
                return (
                  <button
                    key={assignee.id}
                    type="button"
                    onClick={() => handleSelect(assignee)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {assignee.avatar ? (
                      <ImageWithFallback
                        src={assignee.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <User size={14} className="text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{assignee.name}</div>
                      {assignee.role && (
                        <div className="text-xs text-slate-500 truncate">{assignee.role}</div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-blue-600 shrink-0 text-xs font-semibold">Selected</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {showNotifyCheckbox && (
        <label className="flex items-center gap-3 cursor-pointer mt-3">
          <input
            type="checkbox"
            checked={notifyAssignee}
            onChange={(e) => onNotifyChange?.(e.target.checked)}
            disabled={isDisabled}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
          />
          <span className="text-sm font-medium text-slate-700">Notify assignee</span>
        </label>
      )}
    </div>
  );
}
