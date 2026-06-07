'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

export interface CatalogOptionDropdownProps {
  value: string;
  options: string[];
  defaultOptions?: readonly string[];
  deleting?: boolean;
  placeholder?: string;
  onSelect: (value: string) => void;
  onDelete?: (value: string) => void;
  className?: string;
  buttonClassName?: string;
}

function isDefaultCatalogOption(
  value: string,
  defaultOptions: readonly string[] | undefined,
) {
  if (!defaultOptions?.length) return false;
  const normalized = String(value || '').trim().toLowerCase();
  return defaultOptions.some((option) => option.toLowerCase() === normalized);
}

export function CatalogOptionDropdown({
  value,
  options,
  defaultOptions = [],
  deleting = false,
  placeholder = 'Select…',
  onSelect,
  onDelete,
  className = '',
  buttonClassName = '',
}: CatalogOptionDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${buttonClassName}`}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={16} className="text-slate-500" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map((option) => {
            const isDefault = isDefaultCatalogOption(option, defaultOptions);
            const isActive = String(value || '') === String(option || '');
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>{option}</span>
                {!isDefault && onDelete ? (
                  <span
                    role="button"
                    aria-label={`Delete ${option}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(option);
                    }}
                    className={`inline-flex items-center rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600 ${
                      deleting ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function mergeCatalogOptions(
  defaults: readonly string[],
  savedOptions: string[] | null | undefined,
  currentValues?: string | Array<string | null | undefined> | null,
) {
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (value: string | null | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.includes(',')) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  };
  const pushMany = (values: string | Array<string | null | undefined> | null | undefined) => {
    if (values == null) return;
    if (Array.isArray(values)) {
      values.forEach(push);
      return;
    }
    push(values);
  };

  defaults.forEach(push);
  (savedOptions || []).forEach(push);
  pushMany(currentValues);

  return merged;
}
