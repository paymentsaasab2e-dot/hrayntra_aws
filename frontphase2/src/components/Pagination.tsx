'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className = '',
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  const pageItems = useMemo(() => {
    const pages: Array<number | '...'> = [];
    const windowSize = 5;
    const start = Math.min(Math.max(safeCurrentPage, 1), Math.max(1, safeTotalPages - windowSize + 1));
    const end = Math.min(safeTotalPages, start + windowSize - 1);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < safeTotalPages) {
      pages.push('...', safeTotalPages);
    }

    return pages;
  }, [safeCurrentPage, safeTotalPages]);

  return (
    <nav
      aria-label="Pagination"
      style={{ color: '#000000' }}
      className={`flex flex-wrap items-center justify-center gap-1 select-none font-medium text-sm ${className} ${
        safeTotalPages <= 1 ? 'opacity-70' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => !disabled && safeCurrentPage > 1 && onPageChange(safeCurrentPage - 1)}
        disabled={disabled || safeCurrentPage === 1 || safeTotalPages <= 1}
        style={{ color: '#000000' }}
        className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors duration-150 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-500"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} color="#000000" />
        <span className="hidden sm:inline" style={{ color: '#000000' }}>prev</span>
      </button>

      {pageItems.map((item, index) =>
        item === '...' ? (
          <span key={`ellipsis-${index}`} className="px-1 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => !disabled && onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={safeCurrentPage === item ? 'page' : undefined}
            disabled={disabled || safeTotalPages <= 1}
            style={safeCurrentPage === item ? { color: '#ffffff' } : { color: '#000000' }}
            className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-xs transition-colors duration-150 sm:text-sm ${
              safeCurrentPage === item
                ? 'bg-rose-400 font-semibold text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => !disabled && safeCurrentPage < safeTotalPages && onPageChange(safeCurrentPage + 1)}
        disabled={disabled || safeCurrentPage === safeTotalPages || safeTotalPages <= 1}
        style={{ color: '#000000' }}
        className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors duration-150 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-500"
        aria-label="Next page"
      >
        <span className="hidden sm:inline" style={{ color: '#000000' }}>next</span>
        <ChevronRight size={16} color="#000000" />
      </button>
    </nav>
  );
}
