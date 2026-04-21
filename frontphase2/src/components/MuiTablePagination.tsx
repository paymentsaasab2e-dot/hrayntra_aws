'use client';

import React from 'react';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';

interface MuiTablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export function MuiTablePagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className = '',
}: MuiTablePaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  return (
    <Stack spacing={2} className={className}>
      <Pagination
        count={safeTotalPages}
        page={safeCurrentPage}
        variant="outlined"
        color="primary"
        disabled={disabled || totalPages <= 1}
        onChange={(_, page) => onPageChange(page)}
        sx={{
          '& .MuiPaginationItem-root': {
            color: '#2563eb',
            borderColor: '#93c5fd',
            fontWeight: 600,
            backgroundColor: '#ffffff',
          },
          '& .MuiPaginationItem-root:hover': {
            backgroundColor: '#eff6ff',
            borderColor: '#2563eb',
          },
          '& .MuiPaginationItem-root.Mui-selected': {
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderColor: '#2563eb',
          },
          '& .MuiPaginationItem-root.Mui-selected:hover': {
            backgroundColor: '#1d4ed8',
            borderColor: '#1d4ed8',
          },
        }}
      />
    </Stack>
  );
}
