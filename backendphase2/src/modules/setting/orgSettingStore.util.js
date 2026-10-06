import { prisma } from '../../config/prisma.js';

export const ORG_SETTING_SCOPE = 'ORG';

/**
 * Some tenant DBs still have a leftover unique index `settings_candidateId_key`
 * from an older schema. Setting has no candidateId — creating a second ORG row
 * then fails with "Unique constraint failed on … settings_candidateId_key"
 * because Mongo treats missing candidateId as colliding nulls.
 */
let staleCandidateIdIndexDropAttempted = false;

async function dropStaleSettingsCandidateIdIndex() {
  if (staleCandidateIdIndexDropAttempted) return;
  staleCandidateIdIndexDropAttempted = true;
  if (typeof prisma.$runCommandRaw !== 'function') return;
  try {
    await prisma.$runCommandRaw({
      dropIndexes: 'settings',
      index: 'settings_candidateId_key',
    });
    console.info('[orgSettingStore] dropped stale settings_candidateId_key index');
  } catch (err) {
    const msg = String(err?.message || err || '');
    // Index already gone — fine.
    if (/index not found|can't find index|ns not found/i.test(msg)) return;
    console.warn('[orgSettingStore] could not drop settings_candidateId_key:', msg);
  }
}

export async function findOrgSettingRow(key) {
  return prisma.setting.findFirst({
    where: { key: String(key), scope: ORG_SETTING_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Prisma Mongo rejects `userId: null` on compound upsert for ORG rows.
 * Use findFirst + update/create, and heal the stale candidateId unique index.
 */
export async function upsertOrgSettingJson(key, value) {
  const settingKey = String(key || '').trim();
  if (!settingKey) throw new Error('Setting key is required');

  const existing = await findOrgSettingRow(settingKey);
  if (existing?.id) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value },
    });
    return existing.id;
  }

  // Drop stale index before first create so watermark/logo upload does not 500 once.
  await dropStaleSettingsCandidateIdIndex();

  try {
    const created = await prisma.setting.create({
      data: { key: settingKey, scope: ORG_SETTING_SCOPE, value },
    });
    return created.id;
  } catch (err) {
    const code = err?.code || err?.meta?.code;
    const msg = String(err?.message || '');
    const isUnique =
      code === 'P2002' || /Unique constraint failed/i.test(msg);

    if (!isUnique) throw err;

    // Heal again in case drop raced or index name differed.
    if (/candidateId/i.test(msg) || /settings_candidateId_key/i.test(msg)) {
      staleCandidateIdIndexDropAttempted = false;
      await dropStaleSettingsCandidateIdIndex();
    }

    const raced = await findOrgSettingRow(settingKey);
    if (raced?.id) {
      await prisma.setting.update({
        where: { id: raced.id },
        data: { value },
      });
      return raced.id;
    }

    try {
      const created = await prisma.setting.create({
        data: { key: settingKey, scope: ORG_SETTING_SCOPE, value },
      });
      return created.id;
    } catch (retryErr) {
      // Last resort: if any row exists for this key under odd filters, update it.
      const anyKey = await prisma.setting.findFirst({
        where: { key: settingKey },
        orderBy: { updatedAt: 'desc' },
      });
      if (anyKey?.id) {
        await prisma.setting.update({
          where: { id: anyKey.id },
          data: { value, scope: ORG_SETTING_SCOPE },
        });
        return anyKey.id;
      }
      throw retryErr;
    }
  }
}
