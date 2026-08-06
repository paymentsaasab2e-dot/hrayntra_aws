import { requestCornerAlert, requestCornerConfirm } from '@/lib/appDialog';
import { hasDrawerIssues } from './analyze';
import {
  dismissDrawerAlert,
  drawerAlertScope,
  tenantOverdueAlertScope,
  wasDrawerAlertDismissed,
} from './session';
import { trackDrawerIntelligenceEvent } from './track';
import type { DrawerAnalysisResult, TenantOverdueScanResult } from './types';

export type DrawerAlertAction = {
  /** User chose to fill / complete now */
  action: 'fill' | 'later';
  focus: 'missing' | 'overdue' | 'both' | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Show each drawer issue as its own corner popup, one by one.
 * Feeds the Phase 2 behavior engine.
 */
export async function alertDrawerAnalysis(
  result: DrawerAnalysisResult | null | undefined,
  options?: { force?: boolean },
): Promise<DrawerAlertAction> {
  if (!hasDrawerIssues(result) || !result) {
    return { action: 'later', focus: null };
  }

  const focus: DrawerAlertAction['focus'] =
    result.missingFields.length && result.overdueMeetings.length
      ? 'both'
      : result.missingFields.length
        ? 'missing'
        : 'overdue';

  const scope = drawerAlertScope(result.entityKind, result.entityId, 'all');
  if (!options?.force && wasDrawerAlertDismissed(scope)) {
    return { action: 'later', focus };
  }

  trackDrawerIntelligenceEvent({ result, action: 'alert_shown' });

  // 1) Each missing mandatory field — corner, one by one
  for (const field of result.missingFields) {
    await requestCornerAlert(`${result.entityName}: ${field.message}`, {
      tone: 'warning',
      title: `Missing · ${field.label}`,
      confirmLabel: 'OK',
      autoCloseMs: 5500,
    });
  }

  // 2) Each overdue meeting/follow-up — corner, one by one
  for (const meeting of result.overdueMeetings) {
    await requestCornerAlert(`${meeting.title}\nDue ${formatWhen(meeting.at)}`, {
      tone: 'error',
      title: meeting.kind === 'meeting' ? 'Overdue meeting' : 'Overdue follow-up',
      confirmLabel: 'OK',
      autoCloseMs: 6000,
    });
  }

  // 3) Final action prompt in the corner
  const hasOverdue = result.overdueMeetings.length > 0;
  const confirmed = await requestCornerConfirm(
    hasOverdue
      ? `Complete overdue items for ${result.entityName} now?`
      : `Fill missing mandatory fields for ${result.entityName} now?`,
    {
      tone: 'warning',
      title: hasOverdue ? 'Complete now?' : 'Fill data?',
      confirmLabel: hasOverdue ? 'Complete now' : 'Fill data',
      cancelLabel: 'Later',
    },
  );

  if (!confirmed) {
    dismissDrawerAlert(scope);
    trackDrawerIntelligenceEvent({ result, action: 'dismissed' });
    return { action: 'later', focus };
  }

  trackDrawerIntelligenceEvent({ result, action: 'fill_now' });
  return { action: 'fill', focus };
}

/** Tenant-wide overdue items — each shown as a corner popup, one by one. */
export async function alertTenantOverdueScan(
  scan: TenantOverdueScanResult,
  tenantKey: string,
): Promise<boolean> {
  if (!scan.overdueMeetings.length) return false;
  const scope = tenantOverdueAlertScope(tenantKey);
  if (wasDrawerAlertDismissed(scope)) return false;

  await requestCornerAlert(
    `You have ${scan.overdueMeetings.length} overdue meeting/follow-up${
      scan.overdueMeetings.length === 1 ? '' : 's'
    }. Showing them one by one.`,
    {
      tone: 'warning',
      title: 'Overdue meetings',
      confirmLabel: 'OK',
      autoCloseMs: 4500,
    },
  );

  for (const meeting of scan.overdueMeetings.slice(0, 12)) {
    await requestCornerAlert(
      `[${meeting.entityKind}] ${meeting.title}\nDue ${formatWhen(meeting.at)}`,
      {
        tone: 'error',
        title: meeting.kind === 'meeting' ? 'Overdue meeting' : 'Overdue follow-up',
        confirmLabel: 'Next',
        autoCloseMs: 5500,
      },
    );
  }

  const confirmed = await requestCornerConfirm('Open records to complete these now?', {
    tone: 'warning',
    title: 'Review overdue items',
    confirmLabel: 'Review now',
    cancelLabel: 'Dismiss today',
  });

  dismissDrawerAlert(scope);
  return confirmed;
}

export async function alertMissingFieldsOnly(messages: string[]) {
  if (!messages.length) return;
  for (const message of messages) {
    await requestCornerAlert(message, {
      tone: 'warning',
      title: 'Missing mandatory field',
      confirmLabel: 'OK',
      autoCloseMs: 5000,
    });
  }
}

export {
  analyzeLeadDrawer,
  analyzeClientDrawer,
  hasDrawerIssues,
  buildDrawerAlertMessage,
  buildTenantOverdueAlertMessage,
  scanTenantOverdueFromLists,
  isDateOverdue,
} from './analyze';
export { trackDrawerIntelligenceEvent } from './track';
export * from './types';
export * from './session';
