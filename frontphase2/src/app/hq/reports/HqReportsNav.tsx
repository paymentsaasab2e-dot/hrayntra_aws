'use client';

import React from 'react';
import { HqDashCategoryTabs } from '@/components/hq/analytics/HqDashCategoryTabs';
import { HQ_REPORT_NAV, type HqReportPageId } from './hqReportsCatalog';

export function HqReportsDashNav({
  pageId,
  onPageChange,
}: {
  pageId: HqReportPageId;
  onPageChange: (id: HqReportPageId) => void;
}) {
  const group = HQ_REPORT_NAV.find((item) => item.pages.some((page) => page.id === pageId)) || HQ_REPORT_NAV[0];

  return (
    <div className="space-y-1">
      <HqDashCategoryTabs
        instanceId="reports-pillar"
        tabs={HQ_REPORT_NAV.map((item) => ({
          id: item.pillar,
          label: item.label,
          blurb:
            item.pillar === 'employees'
              ? 'Portal candidates, KYC, courses, jobs, events, tokens and help tickets'
              : item.pillar === 'employers'
                ? 'Tenants, companies, plans, entrepreneur tickets and recycle bin'
                : item.pillar === 'crm'
                  ? 'HQ leads, clients, demos and trial conversion'
                  : item.pillar === 'ops'
                    ? 'HQ team and billing ledger'
                    : 'Build, save and reopen grouped HQ reports',
        }))}
        value={group.pillar}
        onChange={(pillar) => {
          const next = HQ_REPORT_NAV.find((item) => item.pillar === pillar);
          if (next?.pages[0]) onPageChange(next.pages[0].id);
        }}
      />
      <HqDashCategoryTabs
        instanceId="reports-page"
        tabs={group.pages.map((page) => ({ id: page.id, label: page.label }))}
        value={pageId}
        onChange={(id) => onPageChange(id as HqReportPageId)}
      />
    </div>
  );
}
