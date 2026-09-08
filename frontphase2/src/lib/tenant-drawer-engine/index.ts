import { requestCornerAlert, requestCornerConfirm, flushAppDialogs } from '@/lib/appDialog';
import { getTenantDbName } from '@/lib/api';
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

function currentTenantKey() {
  return String(getTenantDbName() || '').trim();
}

function stillSameTenant(expected: string) {
  return Boolean(expected) && currentTenantKey() === expected;
}

/**
 * Show each drawer issue as its own corner popup, one by one.
 * Feeds the Phase 2 behavior engine.
 * Aborts if the active tenant changes mid-sequence (prevents cross-tenant leaks).
 */
export async function alertDrawerAnalysis(
  result: DrawerAnalysisResult | null | undefined,
  options?: { force?: boolean },
): Promise<DrawerAlertAction> {
  if (!hasDrawerIssues(result) || !result) {
    return { action: 'later', focus: null };
  }

  const tenantAtStart = currentTenantKey();
  if (!tenantAtStart) {
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

  for (const field of result.missingFields) {
    if (!stillSameTenant(tenantAtStart)) {
      flushAppDialogs();
      return { action: 'later', focus };
    }
    await requestCornerAlert(`${result.entityName}: ${field.message}`, {
      tone: 'warning',
      title: `Missing · ${field.label}`,
      confirmLabel: 'OK',
      autoCloseMs: 5500,
    });
  }

  for (const meeting of result.overdueMeetings) {
    if (!stillSameTenant(tenantAtStart)) {
      flushAppDialogs();
      return { action: 'later', focus };
    }
    await requestCornerAlert(`${meeting.title}\nDue ${formatWhen(meeting.at)}`, {
      tone: 'error',
      title: meeting.kind === 'meeting' ? 'Overdue meeting' : 'Overdue follow-up',
      confirmLabel: 'OK',
      autoCloseMs: 6000,
    });
  }

  if (!stillSameTenant(tenantAtStart)) {
    flushAppDialogs();
    return { action: 'later', focus };
  }

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

  if (!stillSameTenant(tenantAtStart)) {
    flushAppDialogs();
    return { action: 'later', focus };
  }

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
  const expectedTenant = String(tenantKey || currentTenantKey() || '').trim();
  if (!expectedTenant || !stillSameTenant(expectedTenant)) return false;

  const scope = tenantOverdueAlertScope(expectedTenant);
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
    if (!stillSameTenant(expectedTenant)) {
      flushAppDialogs();
      return false;
    }
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

  if (!stillSameTenant(expectedTenant)) {
    flushAppDialogs();
    return false;
  }

  const confirmed = await requestCornerConfirm('Open records to complete these now?', {
    tone: 'warning',
    title: 'Review overdue items',
    confirmLabel: 'Review now',
    cancelLabel: 'Dismiss today',
  });

  if (!stillSameTenant(expectedTenant)) {
    flushAppDialogs();
    return false;
  }

  dismissDrawerAlert(scope);
  return confirmed;
}

export async function alertMissingFieldsOnly(messages: string[]) {
  if (!messages.length) return;
  const tenantAtStart = currentTenantKey();
  if (!tenantAtStart) return;
  for (const message of messages) {
    if (!stillSameTenant(tenantAtStart)) {
      flushAppDialogs();
      return;
    }
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
