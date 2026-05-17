'use client';

import { Plus, Trash2 } from 'lucide-react';
import { ensureMinContactRows } from '../../lib/contact-channels';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

type MultiContactFieldsProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  type?: 'email' | 'tel' | 'text';
  placeholder?: string;
  required?: boolean;
  error?: string;
  addLabel?: string;
};

export function MultiContactFields({
  label,
  values,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
  addLabel,
}: MultiContactFieldsProps) {
  const rows = ensureMinContactRows(values, 1);

  const updateRow = (index: number, value: string) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };

  const addRow = () => onChange([...rows, '']);

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
          {required ? ' *' : ''}
        </label>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
          aria-label={addLabel || `Add ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <input
              type={type}
              value={value}
              onChange={(event) => updateRow(index, event.target.value)}
              className={INPUT_CLASS}
              placeholder={placeholder}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500"
                aria-label={`Remove ${label} ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}