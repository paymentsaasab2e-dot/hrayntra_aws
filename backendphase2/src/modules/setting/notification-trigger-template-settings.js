import { prisma } from '../../config/prisma.js';
import {
  getDefaultTriggerTemplate,
  interpolateTemplate,
} from './notification-trigger-default-templates.js';

export const NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY =
  'notification_email_trigger_templates_v1';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTemplatesValue(value) {
  // We store a map: { [triggerId]: { subject, bodyHtml, customized } }
  if (!isPlainObject(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const id = String(k || '').trim();
    if (!id) continue;
    if (!isPlainObject(v)) continue;
    const subject = v.subject != null ? String(v.subject) : undefined;
    const bodyHtml = v.bodyHtml != null ? String(v.bodyHtml) : undefined;
    const customized = Boolean(v.customized);
    out[id] = { subject, bodyHtml, customized };
  }
  return out;
}

async function findSettingsRecord(userId) {
  if (userId) {
    const userScoped = await prisma.setting.findUnique({
      where: {
        userId_key_scope: {
          userId: String(userId),
          key: NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY,
          scope: 'USER',
        },
      },
    });
    if (userScoped) return userScoped;
  }

  // Workspace-level fallback: any record stored with scope ORG should apply.
  return prisma.setting.findFirst({
    where: {
      key: NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY,
      scope: 'ORG',
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getNotificationTriggerTemplateOverrides(userId = null) {
  const record = await findSettingsRecord(userId || null);
  return normalizeTemplatesValue(record?.value);
}

export async function getEffectiveNotificationTriggerTemplate(triggerId, userId = null) {
  const id = String(triggerId || '').trim();
  const overrides = await getNotificationTriggerTemplateOverrides(userId);
  const stored = overrides[id];
  const system = getDefaultTriggerTemplate(id);
  const customized = Boolean(stored?.customized);

  let subject = system?.subject || 'Notification from HRYANTRA';
  let bodyHtml =
    system?.bodyHtml || '<p>Hello,</p><p>This is a notification from your HRYANTRA workspace.</p>';

  if (customized) {
    if (stored?.subject?.trim()) subject = String(stored.subject).trim();
    if (stored?.bodyHtml?.trim()) bodyHtml = String(stored.bodyHtml).trim();
  }

  return {
    subject,
    bodyHtml,
    variables: system?.variables || [],
    customized,
  };
}

/** Merge system defaults with ORG overrides for settings UI. */
export async function getWorkspaceEffectiveTriggerTemplates(triggerIds = []) {
  const overrides = await getOrgNotificationTriggerTemplates();
  const out = {};
  for (const rawId of triggerIds) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    const system = getDefaultTriggerTemplate(id);
    const stored = overrides[id];
    const customized = Boolean(stored?.customized);
    let subject = system?.subject || 'Notification from HRYANTRA';
    let bodyHtml =
      system?.bodyHtml ||
      '<p>Hello,</p><p>This is a notification from your HRYANTRA workspace.</p>';
    if (customized) {
      if (stored?.subject?.trim()) subject = String(stored.subject).trim();
      if (stored?.bodyHtml?.trim()) bodyHtml = String(stored.bodyHtml).trim();
    }
    out[id] = {
      subject,
      bodyHtml,
      variables: system?.variables || [],
      customized,
    };
  }
  return out;
}

export async function renderNotificationTriggerEmail(triggerId, userId = null, variables = {}) {
  const effective = await getEffectiveNotificationTriggerTemplate(triggerId, userId);
  const subject = interpolateTemplate(effective.subject, variables);
  const html = interpolateTemplate(effective.bodyHtml, variables);
  return { subject, html, effective };
}

// Used by the UI settings page to load/save workspace defaults (scope ORG).
export async function getOrgNotificationTriggerTemplates() {
  const record = await prisma.setting.findFirst({
    where: {
      key: NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY,
      scope: 'ORG',
    },
    orderBy: { updatedAt: 'desc' },
  });
  return normalizeTemplatesValue(record?.value);
}

export async function upsertOrgNotificationTriggerTemplates(templatesValue) {
  const value = normalizeTemplatesValue(templatesValue);
  return prisma.setting.upsert({
    where: {
      userId_key_scope: {
        userId: null,
        key: NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY,
        scope: 'ORG',
      },
    },
    update: { value },
    create: {
      userId: null,
      key: NOTIFICATION_TRIGGER_TEMPLATES_SETTINGS_KEY,
      value,
      scope: 'ORG',
    },
  });
}

