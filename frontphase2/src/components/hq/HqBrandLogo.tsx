'use client';

/**
 * Brand mark for HQ / chrome. Uses plain <img> (not next/image) so wide PNG
 * logos never hit the image optimizer "received null" failure.
 */
export function HqBrandLogo({
  className = 'h-8 w-auto object-contain',
  alt = 'HRYANTRA',
  variant = 'full',
}: {
  className?: string;
  alt?: string;
  variant?: 'full' | 'mark';
}) {
  const src = variant === 'mark' ? '/hryantra-logo.png' : '/hryantra-logo.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={variant === 'mark' ? 40 : 160}
      height={variant === 'mark' ? 40 : 40}
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === '1') return;
        el.dataset.fallback = '1';
        el.src = '/saasa-logo.png';
      }}
    />
  );
}

export function getPhase1PortalUrl(): string {
  const env =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_PHASE1_FRONTEND_URL || process.env.NEXT_PUBLIC_JOB_PORTAL_URL)) ||
    '';
  if (env.trim()) return env.trim().replace(/\/$/, '');
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }
  if (hostname.endsWith('.hryantra.com')) return `${protocol}//hryantra.com`;
  return `${protocol}//${hostname}`;
}
