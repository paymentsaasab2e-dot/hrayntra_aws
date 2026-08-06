'use client';

import { Suspense } from 'react';
import { TenantBehaviorTrackerHost } from '../tenant-behavior/TenantBehaviorTrackerHost';
import { TenantDrawerAnalysisHost } from '../tenant-drawer-engine/TenantDrawerAnalysisHost';

/**
 * Unified Phase 2 intelligence mount:
 * - Behavior engine → usage, journeys, HQ insights
 * - Drawer engine → mandatory fields + overdue meetings
 * Both share phase2-intelligence cache/CRM snapshot bridge.
 */
export function TenantIntelligenceHost() {
  return (
    <>
      <Suspense fallback={null}>
        <TenantBehaviorTrackerHost />
      </Suspense>
      <TenantDrawerAnalysisHost />
    </>
  );
}
