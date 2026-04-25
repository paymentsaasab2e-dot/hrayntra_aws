'use client';

import { useEffect, useState } from 'react';

interface PaginationProps {
  totalPages?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  pageSize?: number;
  itemLabel?: string;
}

export default function PaginationAll({
  totalPages = 6,
  initialPage = 1,
  onPageChange,
  totalCount,
  pageSize,
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

  return (
    <nav
      aria-label="Pagination"
      style={{ color: '#000000' }}
      className="flex w-full flex-nowrap items-center justify-between gap-4 select-none whitespace-nowrap text-sm font-medium"
    >
      {hasCount ? (
        <p className="shrink-0 text-sm text-[#6B7280]">
          Showing <span className="font-semibold text-[#111827]">{start}</span>-
          <span className="font-semibold text-[#111827]">{end}</span> of{' '}
          <span className="font-semibold text-[#111827]">{totalCount}</span> {itemLabel}
        </p>
      ) : null}

      <div className="flex shrink-0 items-center gap-1">
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
          <span className="text-black">prev</span>
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => handlePageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ${
              currentPage === page
                ? 'bg-rose-400 font-semibold text-white shadow-sm'
                : 'text-black hover:bg-gray-100 hover:text-black'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ color: '#000000' }}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors duration-150 hover:text-black disabled:cursor-not-allowed disabled:hover:text-black"
          aria-label="Next page"
        >
          <span className="text-black">next</span>
          <span aria-hidden="true" className="text-black">
            →
          </span>
        </button>
      </div>
    </nav>
  );
}
