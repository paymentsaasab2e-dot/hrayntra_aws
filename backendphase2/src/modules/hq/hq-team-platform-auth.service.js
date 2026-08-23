import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { prisma, runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';

const HQ_TEAM_MEMBER_PRISMA_ROLE = 'VIEWER';
const HQ_CRM_TEAM_MEMBERS_COLLECTION = 'hq_crm_team_members';

let cachedClient = null;

async function getCollection() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  return cachedClient.db().collection(HQ_CRM_TEAM_MEMBERS_COLLECTION);
}

function normalizeLookup(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeLookup(value).toLowerCase();
}

function mapMemberDoc(doc) {
  if (!doc) return null;
  const rawId = doc._id ?? doc.id;
  const id =
    rawId == null
      ? ''
      : typeof rawId === 'string'
        ? rawId
        : typeof rawId.toString === 'function'
          ? rawId.toString()
          : String(rawId);
  return {
    id,
    name: doc.name || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || doc.email || '',
    firstName: doc.firstName || '',
    lastName: doc.lastName || '',
    email: normalizeEmail(doc.email),
    loginId: normalizeLookup(doc.loginId),
    password: normalizeLookup(doc.password),
    role: doc.role || 'Member',
    roleId: doc.roleId ? String(doc.roleId) : '',
    permissionIds: Array.isArray(doc.permissionIds) ? doc.permissionIds.map(String) : [],
    status: String(doc.status || 'active').trim().toLowerCase(),
  };
}

export async function resolvePlatformTenantDbName() {
  const allow = String(env.HRAYNTRA_PLATFORM_PROVISION_EMAILS || 'admin@gmail.com').trim();
  const firstEmail = allow.split(',')[0]?.trim().toLowerCase();
  if (!firstEmail) {
    throw new Error('HRAYNTRA_PLATFORM_PROVISION_EMAILS is not configured');
  }
  const tenantDbName = await headquartersAuthService.findTenantDbNameForUser(firstEmail);
  if (!tenantDbName) {
    throw new Error(`Platform tenant not found for ${firstEmail}`);
  }
  return tenantDbName;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeLookup(value));
}

export async function findHqTeamMemberByCredentials(loginIdOrEmail, password) {
  const collection = await getCollection();
  const identifier = normalizeLookup(loginIdOrEmail);
  const email = looksLikeEmail(loginIdOrEmail) ? normalizeEmail(loginIdOrEmail) : '';
  const plainPassword = normalizeLookup(password);
  if (!identifier || !plainPassword) return null;

  const orFilters = [];
  if (email) orFilters.push({ email });
  if (identifier) {
    orFilters.push({ loginId: identifier });
    orFilters.push({
      loginId: {
        $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      },
    });
  }

  const doc = await collection.findOne({
    status: 'active',
    password: plainPassword,
    $or: orFilters.length ? orFilters : [{ email: '' }],
  });

  const member = mapMemberDoc(doc);
  if (!member?.email || !member.loginId) return null;
  return member;
}

export async function findActiveHqTeamMemberByIdentity(loginIdOrEmail) {
  const collection = await getCollection();
  const identifier = normalizeLookup(loginIdOrEmail);
  const email = looksLikeEmail(loginIdOrEmail) ? normalizeEmail(loginIdOrEmail) : '';
  if (!identifier && !email) return null;

  const orFilters = [];
  if (email) orFilters.push({ email });
  if (identifier) {
    orFilters.push({ loginId: identifier });
    orFilters.push({
      loginId: {
        $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      },
    });
  }

  const doc = await collection.findOne({
    status: 'active',
    $or: orFilters.length ? orFilters : [{ email: '' }],
  });

  return mapMemberDoc(doc);
}

export function buildHqTeamMemberAuthPayload(member) {
  const hqPermissionIds = Array.isArray(member?.permissionIds)
    ? member.permissionIds.map(String)
    : [];
  return {
    hqPermissionIds,
    hqTeamMemberId: member?.id || null,
    isHqTeamMember: true,
    roleName: member?.role || 'HQ Team Member',
    loginId: member?.loginId || '',
    email: member?.email || '',
  };
}

async function ensureHqTeamMemberRoleAndDepartment() {
  let department = await prisma.department.findFirst({
    where: { name: 'Administration' },
    select: { id: true },
  });
  if (!department) {
    department = await prisma.department.create({
      data: {
        name: 'Administration',
        description: 'Administrative department',
      },
      select: { id: true },
    });
  }

  let role = await prisma.systemRole.findFirst({
    where: { roleName: 'HQ Team Member' },
    select: { id: true, roleName: true, color: true },
  });
  if (!role) {
    role = await prisma.systemRole.create({
      data: {
        roleName: 'HQ Team Member',
        description: 'Headquarters console team member',
        color: 'teal',
      },
      select: { id: true, roleName: true, color: true },
    });
  }

  return { role, department };
}

export async function ensureLocalUserFromHqTeamMember(member) {
  const { role, department } = await ensureHqTeamMemberRoleAndDepartment();
  const existing = await prisma.user.findUnique({
    where: { email: member.email },
  });

  const fallbackName = member.name || existing?.name || member.email;
  const firstName = member.firstName || existing?.firstName || fallbackName.split(/\s+/)[0] || 'HQ';
  const lastName =
    member.lastName || existing?.lastName || fallbackName.split(/\s+/).slice(1).join(' ') || 'Member';

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: fallbackName,
        firstName,
        lastName,
        role: HQ_TEAM_MEMBER_PRISMA_ROLE,
        roleId: role.id,
        departmentId: existing.departmentId || department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });
  } else {
    const placeholderHash = await bcrypt.hash(`hq-team:${member.id}:${Date.now()}`, 10);
    user = await prisma.user.create({
      data: {
        name: fallbackName,
        firstName,
        lastName,
        email: member.email,
        passwordHash: placeholderHash,
        role: HQ_TEAM_MEMBER_PRISMA_ROLE,
        roleId: role.id,
        departmentId: department.id,
        isActive: true,
        status: 'ACTIVE',
      },
    });
  }

  if (member.loginId && member.password) {
    const hashedPassword = await bcrypt.hash(String(member.password), 10);
    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: {
        loginId: member.loginId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
      create: {
        userId: user.id,
        loginId: member.loginId,
        hashedPassword,
        tempPasswordFlag: false,
        isLocked: false,
        failedAttempts: 0,
      },
    });
  }

  return { user, role };
}

export async function provisionHqTeamMemberPlatformAccount(memberInput) {
  const member = mapMemberDoc(memberInput) || memberInput;
  if (!member?.email || !member?.loginId || !member?.password) {
    throw new Error('HQ team member credentials are required for platform provisioning');
  }

  const tenantDbName = await resolvePlatformTenantDbName();
  await runWithTenantContext(tenantDbName, async () => {
    await ensureLocalUserFromHqTeamMember(member);
    await headquartersAuthService.upsertTenantUserDirectoryEntry({
      email: member.email,
      loginId: member.loginId,
      tenantDbName,
    });
  });

  return tenantDbName;
}

export async function getHqTeamMemberById(id) {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return mapMemberDoc(doc);
}
