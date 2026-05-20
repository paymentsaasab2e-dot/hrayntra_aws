'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Loader2, Plus, RotateCcw, X } from 'lucide-react';

export interface ExportPreviewColumn<T> {
  id: string;
  label: string;
  accessor: (row: T) => unknown;
}

export interface ExportColumnsModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  rowCount: number;
  rowLabelSingular?: string;
  rowLabelPlural?: string;
  columns: ExportPreviewColumn<T>[];
  rows: T[];
  getRowKey?: (row: T, index: number) => string;
  maxPreviewRows?: number;
  isLoading?: boolean;
  onExport: (selectedColumnIds: string[]) => void;
}

function formatPreviewCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v ?? '').trim()).filter(Boolean);
    return items.length ? items.join('; ') : '—';
  }
  const text = String(value).trim();
  return text || '—';
}

export function ExportColumnsModal<T>({
  isOpen,
  onClose,
  title = 'Export to CSV',
  description = 'Preview export data below. Click X on a column header to remove it from the file.',
  rowCount,
  rowLabelSingular = 'row',
  rowLabelPlural = 'rows',
  columns,
  rows,
  getRowKey,
  maxPreviewRows,
  isLoading = false,
  onExport,
}: ExportColumnsModalProps<T>) {
  const allIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allIds);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) setSelectedIds(allIds);
  }, [isOpen, allIds]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const activeColumns = columns.filter((c) => selectedSet.has(c.id));
  const removedColumns = columns.filter((c) => !selectedSet.has(c.id));
  const previewRows =
    maxPreviewRows != null && maxPreviewRows > 0 ? rows.slice(0, maxPreviewRows) : rows;
  const rowWord = rowCount === 1 ? rowLabelSingular : rowLabelPlural;

  const removeColumn = (id: string) => {
    setSelectedIds((prev) => prev.filter((colId) => colId !== id));
  };

  const addColumn = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev;
      const order = allIds.filter((colId) => prev.includes(colId) || colId === id);
      return order;
    });
  };

  const resetColumns = () => setSelectedIds(allIds);

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    onExport(selectedIds);
    onClose();
  };

  if (!mounted) return null;

  const scrollStyles = `
    .export-preview-table-scroll {
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 #e2e8f0;
    }
    .export-preview-table-scroll::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .export-preview-table-scroll::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 8px;
    }
    .export-preview-table-scroll::-webkit-scrollbar-thumb {
      background: #94a3b8;
      border-radius: 8px;
      border: 2px solid #f1f5f9;
    }
    .export-preview-table-scroll::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }
    .export-preview-table-scroll::-webkit-scrollbar-corner {
      background: #f1f5f9;
    }
  `;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollStyles }} />
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-columns-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative z-[1] flex max-h-[min(92vh,44rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-indigo-100/90 bg-white shadow-2xl shadow-indigo-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 id="export-columns-title" className="text-lg font-bold text-slate-900">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
                <p className="mt-2 text-xs font-medium text-indigo-700">
                  {rowCount} {rowWord} · {activeColumns.length} column
                  {activeColumns.length === 1 ? '' : 's'} selected
                  {` · showing all ${previewRows.length} in table`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
              {isLoading ? (
                <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-slate-600">Loading all leads for export…</p>
                </div>
              ) : activeColumns.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Add at least one column to export, or click Reset columns.
                </p>
              ) : (
                <div className="export-preview-table-scroll min-h-0 flex-1 overflow-x-scroll overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
                  <table className="w-max min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm">
                      <tr>
                        <th className="whitespace-nowrap border-b border-r border-indigo-100/80 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          #
                        </th>
                        {activeColumns.map((col) => (
                          <th
                            key={col.id}
                            className="min-w-[9.5rem] border-b border-r border-indigo-100/80 px-2 py-2 last:border-r-0"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 leading-tight">
                                {col.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeColumn(col.id)}
                                className="shrink-0 rounded p-0.5 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                                aria-label={`Remove ${col.label} column`}
                                title={`Remove ${col.label}`}
                              >
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={activeColumns.length + 1}
                            className="px-4 py-8 text-center text-sm text-slate-500"
                          >
                            No rows to preview.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, rowIndex) => (
                          <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2 text-xs font-medium text-slate-400 tabular-nums">
                              {rowIndex + 1}
                            </td>
                            {activeColumns.map((col) => (
                              <td
                                key={col.id}
                                className="min-w-[9.5rem] max-w-[14rem] border-r border-slate-100 px-3 py-2 text-slate-800 last:border-r-0"
                              >
                                <span className="line-clamp-3 break-words" title={formatPreviewCell(col.accessor(row))}>
                                  {formatPreviewCell(col.accessor(row))}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {removedColumns.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Removed:
                  </span>
                  {removedColumns.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => addColumn(col.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-800"
                    >
                      <Plus size={12} />
                      {col.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={resetColumns}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                <RotateCcw size={16} />
                Reset columns
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isLoading || selectedIds.length === 0 || rowCount === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
    </>,
    document.body,
  );
}
