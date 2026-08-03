import { Manrope, Space_Grotesk } from 'next/font/google';
import HqClientLayout from './HqClientLayout';

const hqSans = Manrope({
  subsets: ['latin'],
  variable: '--font-hq-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const hqDisplay = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-hq-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${hqSans.variable} ${hqDisplay.variable} hq-theme min-h-screen text-slate-900 antialiased`}
    >
      <HqClientLayout>{children}</HqClientLayout>
    </div>
  );
}
