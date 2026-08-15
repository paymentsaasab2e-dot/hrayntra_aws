'use client';

export const BRAND_PNG_ICONS = {
  coin: '/icons/icons/coin.png',
  send: '/icons/icons/send.png',
  chat: '/icons/icons/chat.png',
  email: '/icons/icons/email.png',
  edit: '/icons/icons/edit.png',
  correct: '/icons/icons/correct.png',
  control: '/icons/icons/control.png',
  waveform: '/icons/icons/waveform-path.png',
  image: '/icons/icons/image-.png',
} as const;

export type BrandPngName = keyof typeof BRAND_PNG_ICONS;

export function BrandPngIcon({
  name,
  className = 'h-4 w-4',
  alt = '',
}: {
  name: BrandPngName;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_PNG_ICONS[name]}
      alt={alt}
      className={`inline-block object-contain ${className}`}
      aria-hidden={alt ? undefined : true}
    />
  );
}
