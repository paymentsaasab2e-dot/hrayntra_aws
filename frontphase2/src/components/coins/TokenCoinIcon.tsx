'use client';

import { BrandPngIcon } from './BrandPngIcon';

type TokenCoinIconProps = {
  className?: string;
  alt?: string;
};

/** Brand coin PNG from public/icons/icons. */
export function TokenCoinIcon({ className = 'h-4 w-4', alt = '' }: TokenCoinIconProps) {
  return <BrandPngIcon name="coin" className={className} alt={alt} />;
}
