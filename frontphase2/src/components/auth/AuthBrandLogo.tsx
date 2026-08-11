'use client';

/** Wide brand mark for auth shells — plain img avoids next/image optimizer issues on large PNGs. */
export function AuthBrandLogo({ className = 'h-7 w-auto max-w-[148px] object-contain object-left' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/saasa-logo.png"
      alt="HRYantra"
      className={className}
      width={148}
      height={32}
      decoding="async"
    />
  );
}
