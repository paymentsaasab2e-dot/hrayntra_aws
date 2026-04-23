'use client';

import { useEffect, useState } from 'react';

interface PaginationProps {
  totalPages?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

export default function PaginationAll({
  totalPages = 6,
  initialPage = 1,
  onPageChange,
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

  return (
    <nav
      aria-label="Pagination"
      style={{ color: '#000000' }}
      className="flex items-center gap-1 select-none font-medium text-sm"
    >
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
    </nav>
  );
}
