import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

export const dashNumSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-crm-num',
});

export const dashTextSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-crm-text',
});

export const dashFontVars = `${dashNumSans.variable} ${dashTextSans.variable}`;
export const dashNumFont = dashNumSans.className;
export const dashTextFont = dashTextSans.className;
