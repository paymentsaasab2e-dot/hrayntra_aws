import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import {
  HQ_DEFAULT_ROLES,
  HQ_MODULE_ORDER,
  listHqPermissions,
  normalizePermissionIds,
  permissionsByModule,
} from './hq-rbac.catalog.js';

const HQ_CRM_ROLES_COLLECTION = 'hq_crm_roles';

let cachedClient = null;
let indexesEnsured = false;
let defaultsSeeded = false;

async function getDb() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  return cachedClient.db();
}

async function getCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_CRM_ROLES_COLLECTION);
  if (!indexesEnsured) {
    try {
      await collection.createIndex({ roleName: 1 }, { unique: true });
      await collection.createIndex({ createdAt: -1 });
      indexesEnsured = true;
    } catch {
      // best effort
    }
  }
  return collection;
}

function toRoleRow(doc) {
  return {
    id: doc._id.toString(),
    roleName: doc.roleName || '',
    description: doc.description || '',
    color: doc.color || '#6366F1',
    permissionIds: Array.isArray(doc.permissionIds) ? doc.permissionIds : [],
    isSystem: Boolean(doc.isSystem),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

async function ensureDefaultRoles() {
  if (defaultsSeeded) return;
  const collection = await getCollection();
  const count = await collection.countDocuments({});
  if (count === 0) {
    const now = new Date();
    await collection.insertMany(
      HQ_DEFAULT_ROLES.map((role) => ({
        ...role,
        permissionIds: normalizePermissionIds(role.permissionIds),
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  defaultsSeeded = true;
  await syncSystemRolesWithCatalog();
}

/**
 * Keep seeded HQ Admin / Manager / Viewer permission sets aligned with the
 * current HQ sidebar catalog (Events, Subscriptions, CRM dashboard, etc.).
 */
async function syncSystemRolesWithCatalog() {
  const collection = await getCollection();
  const now = new Date();
  for (const def of HQ_DEFAULT_ROLES) {
    const existing = await collection.findOne({
      roleName: def.roleName,
      isSystem: true,
    });
    if (!existing) continue;
    const next = normalizePermissionIds(def.permissionIds);
    const prev = normalizePermissionIds(existing.permissionIds);
    const prevSet = new Set(prev);
    const same =
      next.length === prev.length && next.every((id) => prevSet.has(id));
    if (same && String(existing.description || '') === String(def.description || '')) continue;
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          permissionIds: next,
          description: def.description,
          updatedAt: now,
          syncedFromCatalogAt: now,
        },
      },
    );
  }
}

export const hqRolesService = {
  listPermissions() {
    return {
      permissions: listHqPermissions(),
      permissionsByModule: permissionsByModule(),
      moduleOrder: HQ_MODULE_ORDER,
    };
  },

  async listRoles() {
    await ensureDefaultRoles();
    const collection = await getCollection();
    const docs = await collection.find({}).sort({ roleName: 1 }).toArray();
    return { roles: docs.map(toRoleRow) };
  },

  async getRoleById(id) {
    await ensureDefaultRoles();
    if (!ObjectId.isValid(id)) throw new Error('Invalid role id');
    const collection = await getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    if (!doc) throw new Error('Role not found');
    return { role: toRoleRow(doc) };
  },

  async createRole(data, reqUser) {
    await ensureDefaultRoles();
    const roleName = String(data?.roleName || '').trim();
    if (!roleName) throw new Error('Role name is required');
    const permissionIds = normalizePermissionIds(data?.permissionIds);
    const collection = await getCollection();
    const existing = await collection.findOne({
      roleName: { $regex: `^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (existing) throw new Error('A role with this name already exists');

    const now = new Date();
    const doc = {
      roleName,
      description: String(data?.description || '').trim(),
      color: String(data?.color || '#6366F1').trim() || '#6366F1',
      permissionIds,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
      createdByEmail: reqUser?.email || null,
    };
    const { insertedId } = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: insertedId });
    return { role: toRoleRow(inserted) };
  },

  async updateRole(id, data, reqUser) {
    await ensureDefaultRoles();
    if (!ObjectId.isValid(id)) throw new Error('Invalid role id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Role not found');

    const roleName = String(data?.roleName ?? existing.roleName).trim();
    if (!roleName) throw new Error('Role name is required');
    const permissionIds =
      data?.permissionIds !== undefined
        ? normalizePermissionIds(data.permissionIds)
        : normalizePermissionIds(existing.permissionIds);

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          roleName,
          description: String(data?.description ?? existing.description ?? '').trim(),
          color: String(data?.color ?? existing.color ?? '#6366F1').trim() || '#6366F1',
          permissionIds,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );
    const updated = await collection.findOne({ _id: objectId });
    return { role: toRoleRow(updated) };
  },

  async deleteRole(id) {
    await ensureDefaultRoles();
    if (!ObjectId.isValid(id)) throw new Error('Invalid role id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Role not found');
    if (existing.isSystem) throw new Error('System roles cannot be deleted');
    await collection.deleteOne({ _id: objectId });
    return { deleted: true, id };
  },
};
