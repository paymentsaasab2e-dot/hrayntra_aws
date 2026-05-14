'use client';

import React, { useState } from 'react';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

/** Up to `max` uppercase letters from the first words of a display name (e.g. "Himanshu Ghode" → "HG"). */
export function initialsFromDisplayName(name?: string | null, max = 2): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) {
    return parts[0].slice(0, max).toUpperCase();
  }
  return parts
    .slice(0, max)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** When `src` is missing/blank or the image fails to load, show these initials instead of the generic icon. */
  fallbackInitials?: string;
}

export function ImageWithFallback(props: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);

  const handleError = () => {
    setDidError(true);
  };

  const { src, alt, style, className, fallbackInitials, ...rest } = props;

  const imageSrc = src && String(src).trim() !== '' ? String(src).trim() : null;
  const initials = String(fallbackInitials ?? '').trim().slice(0, 3);

  if ((!imageSrc || didError) && initials) {
    return (
      <div
        className={`inline-flex select-none items-center justify-center bg-blue-100 font-bold text-blue-700 ${className ?? ''}`}
        style={style}
        role="img"
        aria-label={alt || initials}
      >
        <span className="leading-none tracking-tight">{initials}</span>
      </div>
    );
  }

  if (!imageSrc || didError) {
    return (
      <div
        className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
        style={style}
      >
        <div className="flex items-center justify-center w-full h-full">
          <img src={ERROR_IMG_SRC} alt={alt || 'Error loading image'} {...rest} data-original-url={src} />
        </div>
      </div>
    );
  }

  return (
    <img src={imageSrc} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  );
}
