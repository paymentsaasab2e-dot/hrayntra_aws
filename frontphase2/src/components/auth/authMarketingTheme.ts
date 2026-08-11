import type { CSSProperties } from 'react';

export const AUTH_PANEL_BG = '#FFFFFF';
export const BRAND_ORANGE = '#FC9620';
export const BRAND_ORANGE_DEEP = '#E8770E';
export const BRAND_BLUE = '#28A8E1';
export const BRAND_BLUE_DEEP = '#08428C';

export const authPageBackgroundStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  backgroundImage: `
    radial-gradient(ellipse 70% 55% at 12% 18%, ${BRAND_ORANGE}33 0%, transparent 58%),
    radial-gradient(ellipse 65% 50% at 88% 82%, ${BRAND_BLUE}2e 0%, transparent 55%),
    radial-gradient(ellipse 45% 40% at 78% 12%, ${BRAND_BLUE_DEEP}18 0%, transparent 50%),
    radial-gradient(ellipse 40% 35% at 20% 88%, ${BRAND_ORANGE_DEEP}22 0%, transparent 50%),
    linear-gradient(135deg, #FFFFFF 0%, #F7FBFE 48%, #FFF8F0 100%)
  `,
};

export const authPrimaryButtonStyle: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, ${BRAND_ORANGE_DEEP} 0%, ${BRAND_ORANGE} 100%)`,
};

export const authInputClassName =
  'w-full rounded-full border border-transparent bg-white px-4 py-2.5 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#28A8E1]/35';

export const authInputWithIconClassName =
  'w-full rounded-full border border-transparent bg-white px-4 py-2.5 pr-11 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-[#28A8E1]/35';
