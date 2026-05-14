'use client';

import React, { useState } from 'react';
import { initialsFromDisplayName } from '../ImageWithFallback';

export type TableBrandAvatarProps = {
  /** Company logo / brand image URL */
  src?: string | null;
  /** Used for alt text and initials when `src` is missing or fails */
  name: string;
  /** Optional explicit alt (defaults to company name) */
  alt?: string;
  /** Outer size: `xs` = recruiter column (24px); `sm` = leads row; `md` = client logo */
  size?: 'xs' | 'sm' | 'md';
  /** Small blue badge overlapping bottom-right (e.g. active account) */
  showStatusDot?: boolean;
  /** Tooltip / accessible name for the status dot */
  statusDotTitle?: string;
  className?: string;
};

const sizeClasses: Record<NonNullable<TableBrandAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
};

/**
 * Table cell avatar: photo when available, otherwise emerald circle + white initials
 * (matches PH2 company row pattern). Optional blue status dot with white ring.
 */
export function TableBrandAvatar({
  src,
  name,
  alt,
  size = 'md',
  showStatusDot = true,
  statusDotTitle = 'Active account',
  className = '',
}: TableBrandAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const trimmed = src && String(src).trim() !== '' ? String(src).trim() : '';
  const showImage = Boolean(trimmed) && !imgError;
  const initials = initialsFromDisplayName(name, 2) || '?';
  const label = alt ?? name;
  const dim = sizeClasses[size];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${dim} ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <span
        className={`flex h-full w-full overflow-hidden rounded-full ring-1 ring-slate-200/90 ${
          showImage ? 'bg-slate-100' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
        }`}
      >
        {showImage ? (
          <img
            src={trimmed}
            alt={label}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-bold leading-none tracking-tight text-white">
            {initials}
          </span>
        )}
      </span>
      {showStatusDot ? (
        <span
          className="pointer-events-none absolute bottom-0 right-0 z-[1] h-2.5 w-2.5 translate-x-px translate-y-px rounded-full bg-blue-500 ring-2 ring-white"
          aria-hidden
          title={statusDotTitle}
        />
      ) : null}
    </span>
  );
}
