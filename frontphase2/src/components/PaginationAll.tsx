'use client';

import { useEffect, useMemo, useState } from 'react';

interface PaginationProps {
  totalPages?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  pageSize?: number;
  /** When set with `onPageSizeChange`, shows a “rows per page” control next to the range text. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
}

export default function PaginationAll({
  totalPages = 6,
  initialPage = 1,
  onPageChange,
  totalCount,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  itemLabel = 'results',
}: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const hasCount = typeof totalCount === 'number' && totalCount >= 0;
  const safePageSize = Math.max(pageSize || 1, 1);
  const start = hasCount ? Math.min((currentPage - 1) * safePageSize + 1, totalCount || 0) : 0;
  const end = hasCount ? Math.min(currentPage * safePageSize, totalCount || 0) : 0;
  const showPageSizeSelect =
    Array.isArray(pageSizeOptions) &&
    pageSizeOptions.length > 0 &&
    typeof onPageSizeChange === 'function';
  const pageItems = useMemo((): Array<number | '...'> => {
    const safeTotalPages = Math.max(totalPages, 1);
    const windowSize = 5;
    const start = Math.min(Math.max(currentPage, 1), Math.max(1, safeTotalPages - windowSize + 1));
    const end = Math.min(safeTotalPages, start + windowSize - 1);
    const pages: Array<number | '...'> = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < safeTotalPages) {
      pages.push('...', safeTotalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <nav
      aria-label="Pagination"
      style={{ color: '#000000' }}
      className="flex w-full flex-wrap items-center justify-between gap-3 sm:gap-4 select-none text-sm font-medium"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {hasCount ? (
          <p className="shrink-0 text-sm text-[#6B7280] whitespace-nowrap">
            Showing <span className="font-semibold text-[#111827]">{totalCount === 0 ? 0 : start}</span>-
            <span className="font-semibold text-[#111827]">{end}</span> of{' '}
            <span className="font-semibold text-[#111827]">{totalCount}</span> {itemLabel}
          </p>
        ) : null}
        {showPageSizeSelect ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-[#6B7280] whitespace-nowrap">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={safePageSize}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(next)) onPageSizeChange(next);
              }}
              aria-label="Rows per page"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-[#111827] shadow-sm outline-none transition-colors hover:border-gray-400 focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-1"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap">
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{ color: '#000000' }}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors duration-150 hover:text-black disabled:cursor-not-allowed disabled:hover:text-black"
          aria-label="Previous page"
        >
          <span aria-hidden="true" className="text-black">
            ←
          </span>
          <span className="hidden sm:inline">prev</span>
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
              onClick={() => handlePageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={currentPage === item ? 'page' : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ${
                currentPage === item
                  ? 'bg-rose-400 font-semibold text-white shadow-sm'
                  : 'text-black hover:bg-gray-100 hover:text-black'
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ color: '#000000' }}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors duration-150 hover:text-black disabled:cursor-not-allowed disabled:hover:text-black"
          aria-label="Next page"
        >
          <span className="hidden text-black sm:inline">next</span>
          <span aria-hidden="true" className="text-black">
            →
          </span>
        </button>
      </div>
    </nav>
  );
}
