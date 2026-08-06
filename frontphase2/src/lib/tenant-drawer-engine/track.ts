import { trackTenantUiAction } from '@/lib/tenant-behavior-engine';
import { hasDrawerIssues } from './analyze';
import type { DrawerAnalysisResult } from './types';

/** Record drawer-engine outcomes into the behavior engine for HQ insights. */
export function trackDrawerIntelligenceEvent(input: {
  result: DrawerAnalysisResult;
  action: 'alert_shown' | 'fill_now' | 'dismissed' | 'completed';
}) {
  const { result, action } = input;
  const category = result.entityKind === 'lead' ? 'leads' : 'clients';
  trackTenantUiAction({
    actionType: action === 'completed' || action === 'fill_now' ? 'update' : 'other',
    category,
    entityType: result.entityKind,
    entityId: result.entityId,
    entityLabel: result.entityName,
    meta: {
      engine: 'tenant-drawer',
      intelligenceAction: action,
      missingCount: result.missingFields.length,
      overdueCount: result.overdueMeetings.length,
      missingFields: result.missingFields.map((f) => f.field),
      hasIssues: hasDrawerIssues(result),
    },
  });
}
