import { dashFontVars, dashTextFont } from '@/lib/dashTypeFonts';
import HqClientLayout from './HqClientLayout';

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dashFontVars} ${dashTextFont} hq-theme min-h-screen text-slate-800 antialiased`}>
      <HqClientLayout>{children}</HqClientLayout>
    </div>
  );
}
