import { Playfair_Display } from 'next/font/google';
import HqClientLayout from './HqClientLayout';

const hqSerifFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-hq-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${hqSerifFont.variable} hq-theme min-h-screen text-slate-900 antialiased`}>
      <HqClientLayout>{children}</HqClientLayout>
    </div>
  );
}
