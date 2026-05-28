import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ currentPage, totalPages, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const getPaginationItems = (): Array<number | '...'> => {
    const pages: Array<number | '...'> = [];
    const windowSize = 5;
    const start = Math.min(Math.max(safeCurrentPage, 1), Math.max(1, totalPages - windowSize + 1));
    const end = Math.min(totalPages, start + windowSize - 1);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < totalPages) {
      pages.push('...', totalPages);
    }

    return pages;
  };

  const goPrev = () => {
    if (safeCurrentPage > 1) onPageChange(safeCurrentPage - 1);
  };

  const goNext = () => {
    if (safeCurrentPage < totalPages) onPageChange(safeCurrentPage + 1);
  };

  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={goPrev}
        disabled={safeCurrentPage === 1}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowLeft className="h-4 w-4" />
        prev
      </button>

      <div className="flex items-center gap-1">
        {getPaginationItems().map((item, index) => (
          item === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`h-10 w-10 rounded-full text-sm font-semibold transition-colors ${
                safeCurrentPage === item
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          )
        ))}
      </div>

      <button
        type="button"
        onClick={goNext}
        disabled={safeCurrentPage === totalPages}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        next
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
