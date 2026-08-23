import { Suspense } from 'react';
import { dashFontVars, dashTextFont } from '@/lib/dashTypeFonts';
import HqClientLayout from './HqClientLayout';

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dashFontVars} ${dashTextFont} hq-theme min-h-screen text-slate-800 antialiased`}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-4 text-center text-sm text-slate-500">
            Loading headquarters…
          </div>
        }
      >
        <HqClientLayout>{children}</HqClientLayout>
      </Suspense>
    </div>
  );
}
