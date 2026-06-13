import { prisma } from '../../config/prisma.js';
import { getAlertByEmailTriggerId, isAlertEmailEnabled } from './alert-settings.js';

export const NOTIFICATION_TRIGGER_SETTINGS_KEY = 'notification_email_trigger_points_v1';

const DEFAULT_ACTIVE_TRIGGER_STATE = {
  'auth.welcome_email': true,
  'auth.otp_verification': true,
  'team.invite_email': true,
  'lead.assignment_email': true,
  'lead.followup_email': true,
  'client.assignment_email': true,
  'job.assignment_email': true,
  'candidate.assignment_email': true,
  'interview.candidate_scheduled': true,
  'interview.panel_scheduled': true,
  'match.submission_email': true,
  'placement.confirmed_email': true,
  'placement.joining_scheduled_candidate': true,
  'placement.joining_scheduled_reporting': true,
  'billing.invoice_email': true,
};

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function findSettingsRecord(userId) {
  if (userId) {
    const userScoped = await prisma.setting.findUnique({
      where: {
        userId_key_scope: {
          userId,
          key: NOTIFICATION_TRIGGER_SETTINGS_KEY,
          scope: 'USER',
        },
      },
    });
    if (userScoped) return userScoped;
  }

  return prisma.setting.findFirst({
    where: {
      key: NOTIFICATION_TRIGGER_SETTINGS_KEY,
      OR: [{ userId: null }, { scope: 'ORG' }],
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
}

export async function getNotificationTriggerSettings(userId) {
  try {
    const record = await findSettingsRecord(userId || null);
    const rawValue = record?.value;
    const value = isObject(rawValue) ? rawValue : {};
    const active = isObject(value.active)
      ? {
          ...DEFAULT_ACTIVE_TRIGGER_STATE,
          ...value.active,
        }
      : { ...DEFAULT_ACTIVE_TRIGGER_STATE };
    const additional = Array.isArray(value.additional)
      ? value.additional
          .map((item) => ({
            id: String(item?.id || '').trim(),
            label: String(item?.label || '').trim(),
            enabled: Boolean(item?.enabled),
          }))
          .filter((item) => item.id || item.label)
      : [];

    return { active, additional };
  } catch (error) {
    console.error('Failed to load notification trigger settings. Falling back to defaults.', error);
    return {
      active: { ...DEFAULT_ACTIVE_TRIGGER_STATE },
      additional: [],
    };
  }
}

export async function isNotificationTriggerEnabled(triggerId, options = {}) {
  const { userId = null, aliases = [] } = options;
  const key = String(triggerId || '').trim();
  const normalizedAliases = Array.isArray(aliases)
    ? aliases.map((item) => normalizeLabel(item)).filter(Boolean)
    : [];

  const mappedAlert = getAlertByEmailTriggerId(key);
  if (mappedAlert) {
    return isAlertEmailEnabled(mappedAlert.id, userId);
  }

  const settings = await getNotificationTriggerSettings(userId);
  if (key && typeof settings.active[key] === 'boolean') {
    return settings.active[key];
  }

  if (!normalizedAliases.length) return true;

  const enabledAdditionalLabels = new Set(
    settings.additional
      .filter((item) => item.enabled)
      .flatMap((item) => [normalizeLabel(item.id), normalizeLabel(item.label)])
      .filter(Boolean),
  );

  return normalizedAliases.some((alias) => enabledAdditionalLabels.has(alias));
}
