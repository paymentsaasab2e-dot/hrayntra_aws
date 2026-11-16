'use client';

import React from 'react';
import {
  Ph2ModulePageLayout,
  PH2_HEADER_PILL,
  PH2_HEADER_PILL_PRIMARY,
  PH2_TABLE_CARD_CLASS,
} from '../../../components/layout/Ph2ModulePageLayout';

export function PeopleBanner({ text }: { text: string }) {
  return (
    <div className="mb-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950">
      {text}
    </div>
  );
}

export function PeopleCard({ children }: { children: React.ReactNode }) {
  return <div className={`${PH2_TABLE_CARD_CLASS} p-4`}>{children}</div>;
}

export function PeopleFormRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-end gap-2">{children}</div>;
}

export const fieldClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800';

export { Ph2ModulePageLayout, PH2_HEADER_PILL, PH2_HEADER_PILL_PRIMARY };
