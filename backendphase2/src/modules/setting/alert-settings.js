import { prisma } from '../../config/prisma.js';
import {
  ALERT_CATALOG,
  buildDefaultAlertChannels,
  getAlertCatalogGrouped,
  getAlertDefinition,
  getAlertByEmailTriggerId,
} from './alert-catalog.js';
import { enrichCatalogWithExamples } from './alert-catalog-examples.js';

export const ALERT_MANAGEMENT_SETTINGS_KEY = 'alert_management_v1';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function findSettingsRecord(userId) {
  const orgScoped = await prisma.setting.findFirst({
    where: {
      key: ALERT_MANAGEMENT_SETTINGS_KEY,
      scope: 'ORG',
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (orgScoped) return orgScoped;

  if (userId) {
    return prisma.setting.findUnique({
      where: {
        userId_key_scope: {
          userId: String(userId),
          key: ALERT_MANAGEMENT_SETTINGS_KEY,
          scope: 'USER',
        },
      },
    });
  }
  return null;
}

function normalizeChannels(raw) {
  const defaults = buildDefaultAlertChannels();
  if (!isObject(raw)) return defaults;
  const out = { ...defaults };
  for (const alert of ALERT_CATALOG) {
    const stored = raw[alert.id];
    if (!isObject(stored)) continue;
    out[alert.id] = {
      email:
        typeof stored.email === 'boolean' ? stored.email : defaults[alert.id].email,
      portal:
        typeof stored.portal === 'boolean' ? stored.portal : defaults[alert.id].portal,
    };
  }
  return out;
}

export async function getAlertManagementSettings(userId = null) {
  try {
    const record = await findSettingsRecord(userId);
    const raw = isObject(record?.value?.channels) ? record.value.channels : {};
    const channels = normalizeChannels(raw);
    return {
      channels,
      scope: record?.scope || 'ORG',
      updatedAt: record?.updatedAt || null,
    };
  } catch (error) {
    console.error('[alert-settings] load failed, using defaults:', error?.message || error);
    return { channels: buildDefaultAlertChannels(), scope: 'ORG', updatedAt: null };
  }
}

export async function saveAlertManagementSettings(userId, channels, scope = 'ORG') {
  const normalized = normalizeChannels(channels);
  const existing = await findSettingsRecord(userId);

  if (existing) {
    return prisma.setting.update({
      where: { id: existing.id },
      data: {
        value: { channels: normalized },
        scope,
        userId: scope === 'ORG' ? null : userId,
      },
    });
  }

  return prisma.setting.create({
    data: {
      key: ALERT_MANAGEMENT_SETTINGS_KEY,
      scope,
      userId: scope === 'ORG' ? null : userId,
      value: { channels: normalized },
    },
  });
}

export async function isAlertEmailEnabled(alertId, userId = null) {
  const def = getAlertDefinition(alertId);
  if (!def) return true;
  const { channels } = await getAlertManagementSettings(userId);
  return channels[alertId]?.email ?? def.defaultEmail ?? true;
}

export async function isAlertPortalEnabled(alertId, userId = null) {
  const def = getAlertDefinition(alertId);
  if (!def) return true;
  const { channels } = await getAlertManagementSettings(userId);
  return channels[alertId]?.portal ?? def.defaultPortal ?? true;
}

export async function getAlertManagementPayload(userId = null) {
  const { channels, scope, updatedAt } = await getAlertManagementSettings(userId);
  return {
    catalog: enrichCatalogWithExamples(getAlertCatalogGrouped()),
    channels,
    scope,
    updatedAt,
  };
}

export { getAlertDefinition, getAlertByEmailTriggerId };
