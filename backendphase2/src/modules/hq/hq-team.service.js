import crypto from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { hqRolesService } from './hq-roles.service.js';
import { normalizePermissionIds } from './hq-rbac.catalog.js';

const HQ_CRM_TEAM_MEMBERS_COLLECTION = 'hq_crm_team_members';
const VALID_STATUSES = ['active', 'inactive'];

let cachedClient = null;
let indexesEnsured = false;

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

function normalizeStatus(status) {
  const normalized = String(status || 'active').trim().toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : 'active';
}

function randomTempPassword() {
  return `Hq${crypto.randomBytes(4).toString('hex')}!`;
}

function deriveLoginId(email, firstName, lastName, customLoginId) {
  const custom = String(customLoginId || '').trim();
  if (custom) return custom;
  const emailLocal = String(email || '').split('@')[0] || '';
  const fromName = [firstName, lastName]
    .map((part) => String(part || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('.');
  return fromName || emailLocal || `hq.user.${Date.now()}`;
}

function toMemberRow(doc, roleById = new Map()) {
  const roleId = doc.roleId ? String(doc.roleId) : '';
  const roleDoc = roleId ? roleById.get(roleId) : null;
  const permissionIds = Array.isArray(doc.permissionIds)
    ? doc.permissionIds
    : roleDoc?.permissionIds || [];

  return {
    id: doc._id.toString(),
    name: doc.name || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || '',
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    email: doc.email || '',
    phone: doc.phone || '',
    designation: doc.designation || '',
    department: doc.department || '',
    status: normalizeStatus(doc.status),
    role: roleDoc?.roleName || doc.role || 'Member',
    roleId,
    roleColor: roleDoc?.color || '',
    permissionIds,
    loginId: doc.loginId || '',
    hasCredentials: Boolean(doc.loginId && doc.password),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

function computeStats(members) {
  const active = members.filter((m) => m.status === 'active').length;
  const inactive = members.filter((m) => m.status === 'inactive').length;
  return { total: members.length, active, inactive };
}

async function getCollection() {
  const db = await getDb();
  const collection = db.collection(HQ_CRM_TEAM_MEMBERS_COLLECTION);
  if (!indexesEnsured) {
    try {
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ status: 1 });
      await collection.createIndex({ email: 1 }, { unique: true });
      await collection.createIndex({ roleId: 1 });
      indexesEnsured = true;
    } catch {
      // Best-effort index creation.
    }
  }
  return collection;
}

function getStorageInfo() {
  const url = env.HEADQUARTERS_DATABASE_URL || '';
  let databaseName = 'headquarters';
  try {
    if (url) databaseName = new URL(url).pathname.replace(/^\//, '') || databaseName;
  } catch {
    // Keep default.
  }
  return {
    engine: 'MongoDB',
    database: databaseName,
    collection: HQ_CRM_TEAM_MEMBERS_COLLECTION,
  };
}

async function loadRoleMap() {
  const { roles } = await hqRolesService.listRoles();
  return new Map(roles.map((role) => [role.id, role]));
}

async function resolveRole(roleId, fallbackRoleName) {
  if (!roleId) {
    return {
      roleId: '',
      roleName: String(fallbackRoleName || 'Member').trim() || 'Member',
      permissionIds: [],
    };
  }
  if (!ObjectId.isValid(roleId)) throw new Error('Invalid role id');
  const { role } = await hqRolesService.getRoleById(roleId);
  return {
    roleId: role.id,
    roleName: role.roleName,
    permissionIds: normalizePermissionIds(role.permissionIds),
  };
}

function parseMemberInput(data) {
  const firstName = String(data?.firstName || '').trim();
  const lastName = String(data?.lastName || '').trim();
  const name =
    String(data?.name || '').trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const phone = String(data?.phone || '').trim();
  const designation = String(data?.designation || '').trim();
  const department = String(data?.department || '').trim();
  const status = normalizeStatus(data?.status);
  const roleId = String(data?.roleId || '').trim();
  const roleLabel = String(data?.role || '').trim();
  const hasExplicitPermissions = Array.isArray(data?.permissionIds);
  const permissionIds = hasExplicitPermissions
    ? normalizePermissionIds(data.permissionIds)
    : null;

  if (!name || !email) {
    throw new Error('Name and email are required');
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid member status');
  }

  return {
    firstName: firstName || name.split(/\s+/)[0] || '',
    lastName: lastName || name.split(/\s+/).slice(1).join(' ') || '',
    name,
    email,
    phone,
    designation,
    department,
    status,
    roleId,
    roleLabel,
    permissionIds,
  };
}

export const hqTeamService = {
  getStorageInfo,

  async listMembers() {
    const collection = await getCollection();
    const roleById = await loadRoleMap();
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
    const members = docs.map((doc) => toMemberRow(doc, roleById));
    return {
      members,
      stats: computeStats(members),
      storage: getStorageInfo(),
    };
  },

  async createMember(data, reqUser) {
    const parsed = parseMemberInput({ ...data, status: data?.status || 'active' });
    const resolvedRole = await resolveRole(parsed.roleId, parsed.roleLabel);
    if (!resolvedRole.roleId) {
      throw new Error('Select a role with permissions for this HQ team member');
    }

    const permissionIds =
      parsed.permissionIds != null ? parsed.permissionIds : resolvedRole.permissionIds;
    if (!permissionIds.length) {
      throw new Error('Select at least one HQ permission for this team member');
    }

    const generateCredentials = data?.generateCredentials !== false;
    const sendInvite = Boolean(data?.sendInvite);
    const loginId = generateCredentials
      ? deriveLoginId(
          parsed.email,
          parsed.firstName,
          parsed.lastName,
          data?.customLoginId || data?.loginId,
        )
      : '';
    const tempPassword = generateCredentials
      ? String(data?.tempPassword || '').trim() || randomTempPassword()
      : '';

    const collection = await getCollection();
    const existingEmail = await collection.findOne({ email: parsed.email });
    if (existingEmail) throw new Error('A team member with this email already exists');

    const doc = {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      designation: parsed.designation,
      department: parsed.department,
      status: parsed.status,
      role: resolvedRole.roleName,
      roleId: resolvedRole.roleId,
      permissionIds,
      loginId: loginId || null,
      password: tempPassword || null,
      credentialsGeneratedAt: generateCredentials ? new Date() : null,
      invitePending: Boolean(generateCredentials && sendInvite),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByEmail: reqUser?.email || null,
    };

    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    const roleById = await loadRoleMap();

    return {
      member: toMemberRow(inserted, roleById),
      credentials: generateCredentials
        ? {
            loginId,
            tempPassword,
            email: parsed.email,
            sendInvite,
          }
        : null,
      storage: getStorageInfo(),
    };
  },

  async updateMember(id, data, reqUser) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid member id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Member not found');

    const parsed = parseMemberInput({
      name: data?.name ?? existing.name,
      firstName: data?.firstName ?? existing.firstName,
      lastName: data?.lastName ?? existing.lastName,
      email: data?.email ?? existing.email,
      phone: data?.phone ?? existing.phone ?? '',
      designation: data?.designation ?? existing.designation ?? '',
      department: data?.department ?? existing.department ?? '',
      status: data?.status ?? existing.status ?? 'active',
      roleId: data?.roleId ?? existing.roleId ?? '',
      role: data?.role ?? existing.role ?? 'Member',
      ...(Array.isArray(data?.permissionIds) ? { permissionIds: data.permissionIds } : {}),
    });

    const resolvedRole = await resolveRole(
      parsed.roleId || existing.roleId || '',
      parsed.roleLabel || existing.role,
    );
    if (!resolvedRole.roleId) {
      throw new Error('Select a role with permissions for this HQ team member');
    }

    const permissionIds =
      parsed.permissionIds != null ? parsed.permissionIds : resolvedRole.permissionIds;
    if (!permissionIds.length) {
      throw new Error('Select at least one HQ permission for this team member');
    }

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          designation: parsed.designation,
          department: parsed.department,
          status: parsed.status,
          role: resolvedRole.roleName,
          roleId: resolvedRole.roleId,
          permissionIds,
          updatedAt: new Date(),
          updatedByEmail: reqUser?.email || null,
        },
      },
    );
    const updated = await collection.findOne({ _id: objectId });
    const roleById = await loadRoleMap();
    return { member: toMemberRow(updated, roleById), storage: getStorageInfo() };
  },

  async deleteMember(id) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid member id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const result = await collection.deleteOne({ _id: objectId });
    if (!result.deletedCount) {
      throw new Error('Member not found');
    }
    return {
      deleted: true,
      id,
      storage: getStorageInfo(),
    };
  },
};
