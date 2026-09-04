import { prisma } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { hasPermission } from '../../utils/permissionScope.js';
import { teamMemberService } from '../team/teamMember.service.js';
import {
  getRoleCompanyAccess,
  resolveOrgSide,
} from '../role/roleCompanyAccess.service.js';

export const HIERARCHY_PURPOSES = ['member', 'company_head', 'site_head'];

const DEFAULT_LEVELS = [
  { code: 'L1', displayName: 'HQ', levelOrder: 1, isLeaf: false },
  { code: 'L2', displayName: 'Company', levelOrder: 2, isLeaf: false },
  { code: 'L3', displayName: 'Site', levelOrder: 3, isLeaf: true },
];

function oid(value) {
  return String(value || '').trim();
}

/** Real Organization Management companies: L2 units under HQ, not the HQ root. */
export const ACTIVE_ORG_COMPANY_WHERE = {
  levelOrder: 2,
  isLeaf: false,
  status: 'active',
  parentId: { not: null },
};

function mapUnit(row, extra = {}) {
  if (!row) return null;
  return {
    id: String(row.id),
    parentId: row.parentId ? String(row.parentId) : null,
    name: row.name,
    levelOrder: row.levelOrder,
    isLeaf: Boolean(row.isLeaf),
    status: row.status || 'active',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

function purposeLabel(purpose) {
  if (purpose === 'company_head') return 'Company admin';
  if (purpose === 'site_head') return 'Branch admin';
  return 'Member';
}

function isSuperAdminRow(user) {
  const role = String(user.role || '').toUpperCase().replace(/\s+/g, '_');
  const roleName = String(user.systemRole?.roleName || '').toUpperCase().replace(/\s+/g, '_');
  return (
    role === 'SUPER_ADMIN' ||
    roleName === 'SUPER_ADMIN' ||
    roleName.replace(/_/g, '') === 'SUPERADMIN'
  );
}

function mapPerson(user) {
  return {
    id: String(user.id),
    name:
      String(user.name || '').trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email,
    email: user.email,
    hierarchyPurpose: user.hierarchyPurpose || 'member',
    purposeLabel: purposeLabel(user.hierarchyPurpose),
    roleName: user.systemRole?.roleName || '',
    roleId: user.systemRole?.id || '',
  };
}

/**
 * People still on the tenant (no company) or sitting on HQ / orphan units.
 * Anyone not already on a real company or branch is eligible (except Super Admin).
 */
async function listWorkspacePeopleToAdopt() {
  const [users, units] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        orgUnitId: true,
        hierarchyPurpose: true,
        systemRole: { select: { id: true, roleName: true } },
      },
    }),
    prisma.orgUnit.findMany({
      select: { id: true, parentId: true, levelOrder: true, isLeaf: true },
    }),
  ]);

  // Real companies/branches = anything under HQ (has a parent).
  const companyOrBranchIds = new Set(
    units.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)),
  );

  return users.filter((user) => {
    if (isSuperAdminRow(user)) return false;
    const unitId = user.orgUnitId ? String(user.orgUnitId) : '';
    // Missing / HQ / deleted-or-orphan unit → still “not in a company”
    return !unitId || !companyOrBranchIds.has(unitId);
  });
}

export async function ensureOrgDefaults() {
  const existingLevels = await prisma.orgLevel.findMany({ orderBy: { levelOrder: 'asc' } });
  if (existingLevels.length < 2) {
    for (const level of DEFAULT_LEVELS) {
      const found = await prisma.orgLevel.findFirst({
        where: { OR: [{ code: level.code }, { levelOrder: level.levelOrder }] },
      });
      if (!found) {
        await prisma.orgLevel.create({ data: level });
      }
    }
  }

  let root = await prisma.orgUnit.findFirst({ where: { parentId: null } });
  if (!root) {
    root = await prisma.orgUnit.create({
      data: {
        name: 'HQ',
        parentId: null,
        levelOrder: 1,
        isLeaf: false,
        status: 'active',
      },
    });
  }
  return { root, levels: await prisma.orgLevel.findMany({ orderBy: { levelOrder: 'asc' } }) };
}

export async function collectDescendantIds(unitId, { includePending = false } = {}) {
  const start = oid(unitId);
  if (!start) return [];
  const units = await prisma.orgUnit.findMany({
    where: includePending ? {} : { status: 'active' },
    select: { id: true, parentId: true, status: true },
  });
  const byParent = new Map();
  for (const unit of units) {
    const pid = unit.parentId ? String(unit.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(String(unit.id));
  }
  const out = [];
  const stack = [start];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    for (const child of byParent.get(current) || []) stack.push(child);
  }
  return out;
}

export async function collectDescendantIdsMany(unitIds, { includePending = false } = {}) {
  const starts = [...new Set((unitIds || []).map(oid).filter(Boolean))];
  if (!starts.length) return [];
  const units = await prisma.orgUnit.findMany({
    where: includePending ? {} : { status: 'active' },
    select: { id: true, parentId: true, status: true },
  });
  const byParent = new Map();
  for (const unit of units) {
    const pid = unit.parentId ? String(unit.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(String(unit.id));
  }
  const out = [];
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    for (const child of byParent.get(current) || []) stack.push(child);
  }
  return out;
}

export async function userIdsInOrgScope(unitId) {
  const ids = await collectDescendantIds(unitId);
  if (!ids.length) return [];
  const users = await prisma.user.findMany({
    where: { orgUnitId: { in: ids } },
    select: { id: true },
  });
  return users.map((u) => String(u.id));
}

/** L2 companies that already have at least one assigned person (or site under them). */
async function populatedCompanyIds() {
  const [companies, allUnits, users] = await Promise.all([
    prisma.orgUnit.findMany({
      where: ACTIVE_ORG_COMPANY_WHERE,
      select: { id: true },
    }),
    prisma.orgUnit.findMany({
      where: { status: 'active' },
      select: { id: true, parentId: true },
    }),
    prisma.user.findMany({
      where: { orgUnitId: { not: null } },
      select: { orgUnitId: true },
    }),
  ]);
  const byParent = new Map();
  for (const unit of allUnits) {
    const pid = unit.parentId ? String(unit.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(String(unit.id));
  }
  const peopleByUnit = new Map();
  for (const user of users) {
    const id = String(user.orgUnitId || '');
    if (!id) continue;
    peopleByUnit.set(id, (peopleByUnit.get(id) || 0) + 1);
  }
  const populated = [];
  for (const company of companies) {
    const start = String(company.id);
    const tree = [];
    const stack = [start];
    const seen = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      tree.push(current);
      for (const child of byParent.get(current) || []) stack.push(child);
    }
    const count = tree.reduce((sum, id) => sum + (peopleByUnit.get(id) || 0), 0);
    if (count > 0) populated.push(start);
  }
  return populated;
}

export async function resolveViewerOrgScope(req) {
  await ensureOrgDefaults();
  const userId = oid(req?.user?.id || req?.user?._id);
  if (req?._orgViewerScope) return req._orgViewerScope;

  const requestedRaw = oid(
    req?.query?.orgUnitId || req?.body?.orgUnitId || req?.headers?.['x-org-unit-id'],
  );
  let viewer = null;
  if (userId) {
    viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        orgUnitId: true,
        hierarchyPurpose: true,
        role: true,
        roleId: true,
        systemRole: { select: { id: true } },
      },
    });
  }

  const purpose = String(viewer?.hierarchyPurpose || 'member');
  const homeId = viewer?.orgUnitId ? String(viewer.orgUnitId) : '';
  const isCompanyScopedHead = purpose === 'company_head' || purpose === 'site_head';
  const isSA = isSuperAdminUser(req);

  let homeOrgUnitName = null;
  let homeIsOrgCompany = false;
  if (homeId) {
    const homeUnit = await prisma.orgUnit.findUnique({
      where: { id: homeId },
      select: { name: true, levelOrder: true, parentId: true },
    });
    homeOrgUnitName = homeUnit?.name || null;
    homeIsOrgCompany = Boolean(homeUnit && Number(homeUnit.levelOrder) >= 2);
  }

  const companies = await prisma.orgUnit.findMany({
    where: ACTIVE_ORG_COMPANY_WHERE,
    orderBy: { name: 'asc' },
  });
  const allCompanyIds = companies.map((c) => String(c.id));
  const orgSide = resolveOrgSide(req);
  const roleId = oid(viewer?.roleId || viewer?.systemRole?.id || req?.user?.roleId);

  const dbSwitchPerm = roleId
    ? Boolean(
        await prisma.rolePermission.findFirst({
          where: { roleId, permission: { permissionName: 'switch_companies' } },
          select: { id: true },
        }),
      )
    : false;

  let access = { crm: [], recruitment: [] };
  if (isSA) {
    access = { crm: [...allCompanyIds], recruitment: [...allCompanyIds] };
  } else if (roleId) {
    access = await getRoleCompanyAccess(roleId, allCompanyIds);
    if (!access.crm.length && !access.recruitment.length && hasPermission(req, 'view_all_companies')) {
      access = { crm: [...allCompanyIds], recruitment: [...allCompanyIds] };
    }
  } else if (hasPermission(req, 'view_all_companies')) {
    access = { crm: [...allCompanyIds], recruitment: [...allCompanyIds] };
  }

  const allowedForSide =
    orgSide === 'crm'
      ? access.crm
      : orgSide === 'recruitment'
        ? access.recruitment
        : [...new Set([...access.crm, ...access.recruitment])];

  const hasSwitchPerm = Boolean(
    isSA || hasPermission(req, 'switch_companies') || dbSwitchPerm,
  );
  const hasGranted = allowedForSide.length > 0;
  const selectedAllForSide = Boolean(
    isSA || (allCompanyIds.length > 0 && allCompanyIds.every((id) => allowedForSide.includes(id))),
  );

  // Company-home users stay in their own org unless Switch companies + selected orgs.
  const pinToHomeCompany = Boolean(
    homeId && homeIsOrgCompany && !isSA && !(hasSwitchPerm && hasGranted),
  );

  const canSwitchCompanies = Boolean(hasSwitchPerm && hasGranted && !pinToHomeCompany);
  const isTenantAdmin =
    canSwitchCompanies ||
    (hasPermission(req, 'org_structure') && !isCompanyScopedHead && !pinToHomeCompany);

  const requested =
    canSwitchCompanies && requestedRaw && allowedForSide.includes(requestedRaw) ? requestedRaw : '';

  const forced =
    pinToHomeCompany || (!canSwitchCompanies && (isCompanyScopedHead || Boolean(homeId)));

  let scopeUnitId = null;
  if (forced && homeId) scopeUnitId = homeId;
  else if (requested) scopeUnitId = requested;

  const isTenantWide = Boolean(
    canSwitchCompanies && selectedAllForSide && !scopeUnitId && !pinToHomeCompany,
  );
  const restrictToSelectedCompanies = Boolean(hasSwitchPerm && !isSA && !isTenantWide);

  let unitIds = [];
  let memberIds = [];
  if (scopeUnitId) {
    unitIds = await collectDescendantIds(scopeUnitId);
    memberIds = await userIdsInOrgScope(scopeUnitId);
    if (forced && userId && !memberIds.includes(userId)) {
      memberIds = [userId, ...memberIds];
    }
  } else if (!isTenantWide && canSwitchCompanies && allowedForSide.length) {
    unitIds = await collectDescendantIdsMany(allowedForSide);
    if (unitIds.length) {
      const users = await prisma.user.findMany({
        where: { orgUnitId: { in: unitIds } },
        select: { id: true },
      });
      memberIds = users.map((u) => String(u.id));
    }
  }

  const mapAllowed = (ids) =>
    companies.filter((c) => ids.includes(String(c.id))).map((c) => mapUnit(c));

  const payload = {
    isTenantAdmin,
    isTenantWide,
    canSwitchCompanies: Boolean(canSwitchCompanies),
    canViewAllCompanies: Boolean(isSA || selectedAllForSide),
    restrictToSelectedCompanies,
    orgSide,
    hierarchyPurpose: purpose,
    orgUnitId: scopeUnitId,
    homeOrgUnitId: homeId || null,
    homeOrgUnitName,
    homeIsOrgCompany,
    unitIds,
    memberIds,
    companies: canSwitchCompanies ? mapAllowed(allowedForSide) : [],
    companiesCrm: hasSwitchPerm ? mapAllowed(access.crm) : [],
    companiesRecruitment: hasSwitchPerm ? mapAllowed(access.recruitment) : [],
    hasCompanies: companies.length > 0,
    companyCount: companies.length,
  };
  if (req) req._orgViewerScope = payload;
  return payload;
}

export async function listOrgStructure(req) {
  const seeded = await ensureOrgDefaults();
  const scope = await resolveViewerOrgScope(req);
  const units = await prisma.orgUnit.findMany({ orderBy: [{ levelOrder: 'asc' }, { name: 'asc' }] });
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      orgUnitId: true,
      hierarchyPurpose: true,
      systemRole: { select: { id: true, roleName: true, color: true } },
    },
  });

  const allowed = scope.isTenantWide ? null : new Set(scope.unitIds);
  const companyOrBranchIds = new Set(
    units.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)),
  );
  const peopleByUnit = new Map();
  const hqPeople = [];
  const unassignedPeople = [];
  for (const user of users) {
    const person = mapPerson(user);
    if (isSuperAdminRow(user)) {
      hqPeople.push({ ...person, purposeLabel: 'HQ' });
      continue;
    }
    const uid = user.orgUnitId ? String(user.orgUnitId) : '';
    if (!uid || !companyOrBranchIds.has(uid)) {
      unassignedPeople.push(person);
      continue;
    }
    if (!peopleByUnit.has(uid)) peopleByUnit.set(uid, []);
    peopleByUnit.get(uid).push(person);
  }

  const mapped = units
    .filter((u) => !allowed || allowed.has(String(u.id)))
    .map((u) => {
      const people = peopleByUnit.get(String(u.id)) || [];
      const combined = !u.parentId
        ? [...hqPeople, ...people, ...unassignedPeople.map((p) => ({ ...p, unassigned: true }))]
        : people;
      return mapUnit(u, {
        levelName: seeded.levels.find((l) => l.levelOrder === u.levelOrder)?.displayName || '',
        peopleCount: combined.length,
        people: combined,
      });
    });

  return {
    levels: seeded.levels,
    root: mapUnit(seeded.root),
    units: mapped,
    scope,
    unassignedCount: unassignedPeople.length,
    unassignedPeople,
  };
}

async function attachExistingPeopleToUnit(unit, body) {
  const ids = [];
  if (Array.isArray(body?.userIds)) {
    for (const raw of body.userIds) {
      const id = oid(raw);
      if (id) ids.push(id);
    }
  }
  if (body?.departmentId) {
    const deptUsers = await prisma.user.findMany({
      where: { departmentId: oid(body.departmentId) },
      select: { id: true, role: true, systemRole: { select: { roleName: true } } },
    });
    for (const row of deptUsers) {
      if (!isSuperAdminRow(row)) ids.push(String(row.id));
    }
  }
  // Fold in leftover workspace people when adopting / stamping.
  if (body?.adoptWorkspace === true || body?.stampAllUntagged === true) {
    const workspace = await listWorkspacePeopleToAdopt();
    ids.push(...workspace.map((row) => String(row.id)));
  }

  // Never move Super Admin onto a company via bulk adopt.
  const candidates = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)].filter(Boolean) } },
    select: { id: true, role: true, systemRole: { select: { roleName: true } } },
  });
  const unique = candidates.filter((u) => !isSuperAdminRow(u)).map((u) => String(u.id));
  if (!unique.length) return { attachedCount: 0, userIds: [] };

  const headId = oid(body?.headUserId);
  const headPurpose = unit.isLeaf ? 'site_head' : unit.levelOrder === 2 ? 'company_head' : 'member';
  const unitId = String(unit.id);

  // Bulk assign first (reliable on Mongo), then set company/site head if requested.
  let attached = 0;
  try {
    const updated = await prisma.user.updateMany({
      where: { id: { in: unique } },
      data: {
        orgUnitId: unitId,
        hierarchyPurpose: 'member',
      },
    });
    attached = Number(updated?.count || 0);
  } catch {
    attached = 0;
  }

  // Fallback: some Prisma/Mongo builds skip relation scalars on updateMany.
  if (attached === 0 && unique.length) {
    for (const id of unique) {
      try {
        await prisma.user.update({
          where: { id },
          data: {
            orgUnitId: unitId,
            hierarchyPurpose: id === headId ? headPurpose : 'member',
          },
        });
        attached += 1;
      } catch {
        // skip bad id
      }
    }
  } else if (headId && unique.includes(headId)) {
    await prisma.user.update({
      where: { id: headId },
      data: { orgUnitId: unitId, hierarchyPurpose: headPurpose },
    });
  }

  return {
    attachedCount: attached,
    userIds: unique,
  };
}

/** Untagged / HQ / orphan jobs·leads·clients·candidates → this company/branch id. */
export async function stampUntaggedRecordsToOrgUnit(orgUnitId) {
  const unitId = oid(orgUnitId);
  if (!unitId) return { jobs: 0, leads: 0, clients: 0, candidates: 0 };

  const units = await prisma.orgUnit.findMany({
    select: { id: true, parentId: true },
  });
  // Anything under HQ (company or branch) already has a real company home.
  const companyBranchIds = new Set(
    units.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)),
  );

  async function stampDelegate(delegate) {
    if (!delegate?.findMany || !delegate?.updateMany) return 0;
    let rows = [];
    try {
      rows = await delegate.findMany({
        select: { id: true, orgUnitId: true },
      });
    } catch {
      return 0;
    }
    const ids = (rows || [])
      .filter((row) => {
        const current = row.orgUnitId ? String(row.orgUnitId) : '';
        // Missing, HQ, or orphan unit → move into this company.
        return !current || !companyBranchIds.has(current);
      })
      .map((row) => String(row.id))
      .filter(Boolean);
    if (!ids.length) return 0;

    let stamped = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      try {
        const res = await delegate.updateMany({
          where: { id: { in: chunk } },
          data: { orgUnitId: unitId },
        });
        stamped += Number(res?.count || 0);
        // If updateMany reports 0 on Mongo, fall back per-id.
        if (!res?.count) {
          for (const id of chunk) {
            try {
              await delegate.update({
                where: { id },
                data: { orgUnitId: unitId },
              });
              stamped += 1;
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        for (const id of chunk) {
          try {
            await delegate.update({
              where: { id },
              data: { orgUnitId: unitId },
            });
            stamped += 1;
          } catch {
            /* skip */
          }
        }
      }
    }
    return stamped;
  }

  const [jobs, leads, clients, candidates] = await Promise.all([
    stampDelegate(prisma.job),
    stampDelegate(prisma.lead),
    stampDelegate(prisma.client),
    stampDelegate(prisma.candidate),
  ]);
  return { jobs, leads, clients, candidates };
}

/** Untagged rows owned by these users → this company/branch id (JS filter; Mongo null queries miss unset fields). */
async function stampUntaggedRecordsOwnedByUsers(orgUnitId, userIds) {
  const unitId = oid(orgUnitId);
  const ownerIds = new Set((userIds || []).map(oid).filter(Boolean));
  if (!unitId || !ownerIds.size) return { jobs: 0, leads: 0, clients: 0, candidates: 0 };

  const units = await prisma.orgUnit.findMany({ select: { id: true, parentId: true } });
  const companyBranchIds = new Set(
    units.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)),
  );

  function needsHome(orgUnitIdValue) {
    const current = orgUnitIdValue ? String(orgUnitIdValue) : '';
    return !current || !companyBranchIds.has(current);
  }

  function ownedBy(row, fields) {
    for (const field of fields) {
      const value = row[field];
      if (!value) continue;
      if (Array.isArray(value)) {
        if (value.some((id) => ownerIds.has(String(id)))) return true;
      } else if (ownerIds.has(String(value))) {
        return true;
      }
    }
    return false;
  }

  async function stampOwned(delegate, ownerFields) {
    if (!delegate?.findMany) return 0;
    let rows = [];
    try {
      const select = { id: true, orgUnitId: true };
      for (const field of ownerFields) select[field] = true;
      rows = await delegate.findMany({ select });
    } catch {
      return 0;
    }
    const ids = (rows || [])
      .filter((row) => needsHome(row.orgUnitId) && ownedBy(row, ownerFields))
      .map((row) => String(row.id))
      .filter(Boolean);
    if (!ids.length) return 0;
    let stamped = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      try {
        const res = await delegate.updateMany({
          where: { id: { in: chunk } },
          data: { orgUnitId: unitId },
        });
        const n = Number(res?.count || 0);
        if (n > 0) {
          stamped += n;
          continue;
        }
      } catch {
        /* fall through */
      }
      for (const id of chunk) {
        try {
          await delegate.update({ where: { id }, data: { orgUnitId: unitId } });
          stamped += 1;
        } catch {
          /* skip */
        }
      }
    }
    return stamped;
  }

  const [jobs, leads, clients, candidates] = await Promise.all([
    stampOwned(prisma.job, ['assignedToId', 'createdById', 'supportingRecruiters']),
    stampOwned(prisma.lead, ['assignedToId', 'createdBy', 'assignedToIds']),
    stampOwned(prisma.client, ['assignedToId', 'createdById']),
    stampOwned(prisma.candidate, ['assignedToId', 'createdById']),
  ]);
  return { jobs, leads, clients, candidates };
}

/**
 * Move existing setup into a company/branch:
 * - users get orgUnitId
 * - CRM/recruitment rows get the same orgUnitId
 * Super Admin stays at HQ (not in adopt list).
 */
async function assignExistingSetupToUnit(unit, body = {}) {
  const people = await attachExistingPeopleToUnit(unit, body);
  const companyCount = await prisma.orgUnit
    .count({
      where: { parentId: { not: null }, levelOrder: 2, status: 'active' },
    })
    .catch(() => 1);

  // Stamp all leftover CRM rows when adopting, or when this is the only company and people moved in.
  const stampAll =
    body.adoptWorkspace === true ||
    body.stampAllUntagged === true ||
    (people.userIds.length > 0 && companyCount <= 1);

  let stamped;
  if (stampAll) {
    stamped = await stampUntaggedRecordsToOrgUnit(String(unit.id));
  } else if (people.userIds.length) {
    stamped = await stampUntaggedRecordsOwnedByUsers(String(unit.id), people.userIds);
  } else {
    stamped = { jobs: 0, leads: 0, clients: 0, candidates: 0 };
  }
  return {
    attachedCount: people.attachedCount,
    userIds: people.userIds,
    stamped,
  };
}

async function createLoginOnUnit(req, unit, newUser, purpose) {
  const email = String(newUser?.email || '').trim().toLowerCase();
  const firstName = String(newUser?.firstName || '').trim();
  const lastName = String(newUser?.lastName || '').trim();
  if (!email || !firstName) {
    throw new Error('Enter first name and email for the new login.');
  }
  const created = await teamMemberService.create(
    {
      firstName,
      lastName: lastName || firstName,
      email,
      roleId: oid(newUser.roleId) || undefined,
      generateCredentials: newUser.generateCredentials !== false,
      sendInvite: Boolean(newUser.sendInvite),
      loginIdOption: newUser.loginIdOption || 'email',
    },
    oid(req?.user?.id || req?.user?._id),
  );
  const userId = oid(created?.id);
  if (!userId) throw new Error('Could not create the new login.');
  await prisma.user.update({
    where: { id: userId },
    data: {
      orgUnitId: unit.id,
      hierarchyPurpose: HIERARCHY_PURPOSES.includes(purpose) ? purpose : 'member',
    },
  });
  return { user: created, credentialData: created.credentialData || null };
}

export async function createOrgUnit(req, body) {
  if (req) delete req._orgViewerScope;
  const seeded = await ensureOrgDefaults();
  const scope = await resolveViewerOrgScope(req);
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('Enter a company or site name.');

  const kind = String(body?.kind || '').toLowerCase();
  const parentId = oid(body?.parentId) || String(seeded.root.id);
  const parent = await prisma.orgUnit.findUnique({ where: { id: parentId } });
  if (!parent) throw new Error('Parent company was not found.');
  if (parent.isLeaf) throw new Error('A site cannot have child companies.');

  let isLeaf;
  if (kind === 'site' || body?.isLeaf === true) isLeaf = true;
  else if (kind === 'company' || body?.isLeaf === false) isLeaf = false;
  else isLeaf = parent.levelOrder !== 1;

  if (!scope.isTenantAdmin) {
    if (!scope.unitIds.includes(String(parent.id))) {
      throw new Error('You can only add sites under your own company.');
    }
    if (!isLeaf) throw new Error('Only HQ can create companies.');
  }

  const levelOrder = isLeaf ? 3 : 2;
  if (!isLeaf && parent.levelOrder !== 1) {
    throw new Error('Companies sit directly under HQ.');
  }
  if (isLeaf && parent.levelOrder === 1 && !scope.isTenantAdmin) {
    throw new Error('Ask HQ to place a site under HQ.');
  }

  const unit = await prisma.orgUnit.create({
    data: {
      name,
      parentId: String(parent.id),
      levelOrder,
      isLeaf,
      status: 'active',
    },
  });

  const setup = await assignExistingSetupToUnit(unit, body || {});
  let createdLogin = null;
  if (body?.newUser && (body.newUser.email || body.newUser.firstName)) {
    const purpose =
      String(body?.newUserPurpose || '').trim() ||
      (isLeaf ? 'site_head' : 'company_head');
    createdLogin = await createLoginOnUnit(req, unit, body.newUser, purpose);
  }

  return {
    ...mapUnit(unit),
    attachedCount: setup.attachedCount,
    stamped: setup.stamped,
    createdUser: createdLogin?.user
      ? { id: String(createdLogin.user.id), email: createdLogin.user.email, name: createdLogin.user.name }
      : null,
    credentialData: createdLogin?.credentialData || null,
  };
}

export async function updateOrgUnit(req, id, body) {
  const scope = await resolveViewerOrgScope(req);
  const unit = await prisma.orgUnit.findUnique({ where: { id: oid(id) } });
  if (!unit) throw new Error('Company or site not found.');
  if (unit.parentId == null && body?.name && String(body.name).trim() === '') {
    throw new Error('HQ needs a name.');
  }
  if (!scope.isTenantAdmin && !scope.unitIds.includes(String(unit.id))) {
    throw new Error('You can only edit your own company.');
  }
  if (unit.parentId == null && !scope.isTenantAdmin) {
    throw new Error('Only HQ can rename the root.');
  }

  const data = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.status && ['active', 'pending_hq_approval', 'rejected'].includes(String(body.status))) {
    data.status = String(body.status);
  }
  return mapUnit(await prisma.orgUnit.update({ where: { id: unit.id }, data }));
}

export async function deleteOrgUnit(req, id) {
  const scope = await resolveViewerOrgScope(req);
  const unit = await prisma.orgUnit.findUnique({ where: { id: oid(id) } });
  if (!unit) throw new Error('Company or site not found.');
  if (!unit.parentId) throw new Error('HQ cannot be deleted.');
  if (!scope.isTenantAdmin) throw new Error('Only HQ can remove companies or sites.');
  const child = await prisma.orgUnit.findFirst({ where: { parentId: unit.id } });
  if (child) throw new Error('Remove child sites first.');
  const people = await prisma.user.count({ where: { orgUnitId: unit.id } });
  if (people > 0) throw new Error('Reassign people before deleting this company or site.');
  await prisma.orgUnit.delete({ where: { id: unit.id } });
  return { deleted: true };
}

export async function adoptWorkspaceIntoUnit(req, id, body = {}) {
  if (req) delete req._orgViewerScope;
  const scope = await resolveViewerOrgScope(req);
  if (!scope.isTenantAdmin) {
    throw new Error('Only HQ can move the current tenant workspace into a company or branch.');
  }
  const unit = await prisma.orgUnit.findUnique({ where: { id: oid(id) } });
  if (!unit || !unit.parentId) {
    throw new Error('Pick a company or branch — not HQ.');
  }
  const setup = await assignExistingSetupToUnit(unit, {
    adoptWorkspace: true,
    stampAllUntagged: true,
    userIds: Array.isArray(body?.userIds) ? body.userIds : undefined,
    headUserId: body?.headUserId,
  });
  return {
    id: String(unit.id),
    name: unit.name,
    attachedCount: setup.attachedCount,
    stamped: setup.stamped,
  };
}

/**
 * Assign leftover users + untagged CRM/recruitment data to this company/branch.
 * Both get the same orgUnitId so switching companies separates people and records.
 */
export async function stampUntaggedRecordsForUnit(req, id, body = {}) {
  if (req) delete req._orgViewerScope;
  const scope = await resolveViewerOrgScope(req);
  if (!scope.isTenantAdmin) {
    throw new Error('Only HQ can assign existing users and data to a company.');
  }
  const unit = await prisma.orgUnit.findUnique({ where: { id: oid(id) } });
  if (!unit || !unit.parentId) {
    throw new Error('Pick a company or branch — not HQ.');
  }
  const setup = await assignExistingSetupToUnit(unit, {
    adoptWorkspace: true,
    stampAllUntagged: true,
    userIds: Array.isArray(body?.userIds) ? body.userIds : undefined,
    headUserId: body?.headUserId,
  });
  return {
    id: String(unit.id),
    name: unit.name,
    attachedCount: setup.attachedCount,
    stamped: setup.stamped,
  };
}

export async function assignOrgMember(req, body) {
  const scope = await resolveViewerOrgScope(req);
  let userId = oid(body?.userId);
  let credentialData = null;
  const orgUnitId = oid(body?.orgUnitId);
  const purpose = String(body?.hierarchyPurpose || 'member').trim();
  if (!HIERARCHY_PURPOSES.includes(purpose)) {
    throw new Error('Choose member, company admin, or site admin.');
  }
  const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId } });
  if (!unit) throw new Error('Pick a company or branch.');
  if (!scope.isTenantAdmin && !scope.unitIds.includes(String(unit.id))) {
    throw new Error('You can only assign people under your company.');
  }
  if (purpose === 'company_head' && (unit.isLeaf || unit.levelOrder !== 2)) {
    throw new Error('Company admin is assigned on a company, not a branch.');
  }
  if (purpose === 'site_head' && !unit.isLeaf) {
    throw new Error('Branch admin is assigned on a branch.');
  }

  if (!userId && body?.newUser) {
    const created = await createLoginOnUnit(req, unit, body.newUser, purpose);
    userId = oid(created?.user?.id);
    credentialData = created?.credentialData || null;
    if (!userId) throw new Error('Could not create the new login.');
    return {
      id: userId,
      orgUnitId: String(unit.id),
      hierarchyPurpose: purpose,
      purposeLabel: purposeLabel(purpose),
      roleName: created?.user?.systemRole?.roleName || created?.user?.role?.roleName || '',
      credentialData,
    };
  }

  if (!userId) throw new Error('Pick a team member or create a new login.');

  const data = {
    orgUnitId: unit.id,
    hierarchyPurpose: purpose,
  };
  if (body?.roleId) data.roleId = oid(body.roleId);

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: { systemRole: { select: { id: true, roleName: true } } },
  });

  // Same company id on that person's untagged jobs/leads/clients/candidates.
  await stampUntaggedRecordsOwnedByUsers(String(unit.id), [userId]);

  return {
    id: String(user.id),
    orgUnitId: String(user.orgUnitId),
    hierarchyPurpose: user.hierarchyPurpose,
    purposeLabel: purposeLabel(user.hierarchyPurpose),
    roleName: user.systemRole?.roleName || '',
    credentialData,
  };
}

/**
 * Data that can be duplicated or moved between companies / branches.
 * CRM/recruitment models carry `orgUnitId`. Team members are move-only (no duplicate logins).
 */
function isRecruitmentClientRow(row) {
  return Boolean(row?.recruitmentEnabled) || Boolean(row?.createdInRecruitment);
}

const TRANSFERABLE = {
  leads: {
    delegate: () => prisma.lead,
    label: 'leads',
    title: (row) => row.companyName || row.contactName || row.email || 'Lead',
    subtitle: (row) => ['CRM', row.status, row.city || row.location].filter(Boolean).join(' · '),
  },
  clients: {
    delegate: () => prisma.client,
    label: 'CRM clients',
    title: (row) => row.companyName || 'Client',
    subtitle: (row) => ['CRM', row.status, row.location].filter(Boolean).join(' · '),
    match: (row) => row?.createdInRecruitment !== true,
  },
  recruitmentClients: {
    delegate: () => prisma.client,
    label: 'recruitment clients',
    title: (row) => row.companyName || 'Client',
    subtitle: (row) => ['Recruitment', row.status, row.location].filter(Boolean).join(' · '),
    match: (row) => isRecruitmentClientRow(row),
  },
  jobs: {
    delegate: () => prisma.job,
    label: 'jobs',
    title: (row) => row.title || 'Job',
    subtitle: (row) => [row.statusLabel || row.status, row.location].filter(Boolean).join(' · '),
  },
  candidates: {
    delegate: () => prisma.candidate,
    label: 'candidates',
    title: (row) =>
      [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || 'Candidate',
    subtitle: (row) => [row.currentTitle, row.location].filter(Boolean).join(' · '),
  },
};

export const TRANSFERABLE_TYPES = [...Object.keys(TRANSFERABLE), 'members'];

/** Fields that must never be carried over to a duplicated row. */
const CLONE_SKIP_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'deletedBy',
  'publicToken',
  'accessToken',
]);

function assertUnitAccess(scope, unitId) {
  if (!unitId) return;
  if (scope.isTenantAdmin) return;
  if (!scope.unitIds.includes(String(unitId))) {
    throw new Error('You can only move data inside your own company.');
  }
}

function memberDisplayName(user) {
  return (
    String(user.name || '').trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'Team member'
  );
}

function purposeForTargetUnit(user, targetUnit) {
  const purpose = String(user?.hierarchyPurpose || 'member');
  if (!targetUnit || !targetUnit.parentId) return 'member';
  if (purpose === 'company_head' && (targetUnit.isLeaf || Number(targetUnit.levelOrder) !== 2)) {
    return 'member';
  }
  if (purpose === 'site_head' && !targetUnit.isLeaf) return 'member';
  return HIERARCHY_PURPOSES.includes(purpose) ? purpose : 'member';
}

async function resolveTransferMatch(orgUnitId) {
  const unitId = oid(orgUnitId);
  const units = await prisma.orgUnit.findMany({
    select: { id: true, parentId: true, levelOrder: true, isLeaf: true },
  });
  const companyOrBranchIds = new Set(units.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)));
  if (!unitId) {
    return { kind: 'unassigned', companyOrBranchIds };
  }
  const unit = units.find((u) => String(u.id) === unitId);
  if (!unit) throw new Error('Company was not found.');
  if (!unit.parentId) {
    return { kind: 'hq', hqId: String(unit.id), companyOrBranchIds };
  }
  return {
    kind: 'unit',
    ids: new Set((await collectDescendantIds(unitId)).map(String)),
    companyOrBranchIds,
  };
}

function homeInTransferMatch(home, match) {
  if (match.kind === 'unassigned') return !home;
  if (match.kind === 'hq') {
    return !home || home === match.hqId || !match.companyOrBranchIds.has(home);
  }
  return match.ids.has(home);
}

function normTransferKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Stable identity so a copied job/client/lead/candidate is not offered or cloned again. */
export function transferIdentityKey(type, row) {
  if (!row) return '';
  if (type === 'jobs') {
    const title = normTransferKey(row.title);
    if (!title) return '';
    return [
      'job',
      title,
      String(row.clientId || ''),
      normTransferKey(row.location || row.city),
      normTransferKey(row.department),
    ].join('|');
  }
  if (type === 'clients' || type === 'recruitmentClients') {
    const name = normTransferKey(row.companyName);
    if (!name) return '';
    return ['client', name, normTransferKey(row.website)].join('|');
  }
  if (type === 'leads') {
    const email = normTransferKey(row.email);
    const company = normTransferKey(row.companyName);
    const contact = normTransferKey(row.contactName || row.contactPerson || row.directorName);
    if (email) return ['lead', email].join('|');
    if (company || contact) return ['lead', company, contact, normTransferKey(row.phone)].join('|');
    return '';
  }
  if (type === 'candidates') {
    const email = normTransferKey(row.email);
    if (email) return ['candidate', email].join('|');
    const name = [normTransferKey(row.firstName), normTransferKey(row.lastName)].filter(Boolean).join(' ');
    const phone = normTransferKey(row.phone);
    if (!name && !phone) return '';
    return ['candidate', name, phone].join('|');
  }
  return '';
}

async function loadTransferableRows(type, orgUnitId) {
  const config = TRANSFERABLE[type];
  if (!config) return [];
  const delegate = config.delegate();
  if (!delegate?.findMany) return [];
  let rows = [];
  try {
    rows = await delegate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
  } catch {
    return [];
  }
  const match = await resolveTransferMatch(oid(orgUnitId));
  return rows.filter((row) => {
    if (row?.isDeleted === true || row?.deletedAt) return false;
    if (typeof config.match === 'function' && !config.match(row)) return false;
    const home = row.orgUnitId ? String(row.orgUnitId) : '';
    return homeInTransferMatch(home, match);
  });
}

async function destinationIdentityKeys(type, toOrgUnitId) {
  const rows = await loadTransferableRows(type, toOrgUnitId);
  const keys = new Set();
  for (const row of rows) {
    const key = transferIdentityKey(type, row);
    if (key) keys.add(key);
  }
  return keys;
}

async function listTransferableMembers(req, { orgUnitId, search = '', limit = 200 } = {}) {
  const scope = await resolveViewerOrgScope(req);
  const unitId = oid(orgUnitId);
  assertUnitAccess(scope, unitId);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    take: 2000,
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      orgUnitId: true,
      hierarchyPurpose: true,
      systemRole: { select: { id: true, roleName: true } },
    },
  });

  const units = await prisma.orgUnit.findMany({
    select: { id: true, parentId: true, name: true },
  });
  const unitNameById = new Map(units.map((u) => [String(u.id), u.name]));
  const match = await resolveTransferMatch(unitId);
  const term = String(search || '').trim().toLowerCase();

  const items = users
    .filter((user) => {
      if (isSuperAdminRow(user)) return false;
      const home = user.orgUnitId ? String(user.orgUnitId) : '';
      return homeInTransferMatch(home, match);
    })
    .map((user) => {
      const home = user.orgUnitId ? String(user.orgUnitId) : '';
      return {
        id: String(user.id),
        title: memberDisplayName(user),
        subtitle: [user.email, purposeLabel(user.hierarchyPurpose), user.systemRole?.roleName, unitNameById.get(home)]
          .filter(Boolean)
          .join(' · '),
        orgUnitId: home || null,
      };
    })
    .filter((item) => !term || `${item.title} ${item.subtitle}`.toLowerCase().includes(term))
    .slice(0, Math.max(1, Math.min(Number(limit) || 200, 500)));

  return { type: 'members', items, alreadyInDestination: 0 };
}

async function moveTeamMembers(ids, fromId, toId, result, historyItems = []) {
  const target = toId
    ? await prisma.orgUnit.findUnique({
        where: { id: toId },
        select: { id: true, isLeaf: true, levelOrder: true, parentId: true },
      })
    : null;
  if (toId && !target) {
    throw new Error('Target company or branch was not found.');
  }

  const match = await resolveTransferMatch(fromId);

  for (const id of ids) {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          orgUnitId: true,
          hierarchyPurpose: true,
          systemRole: { select: { roleName: true } },
        },
      });
      if (!user || isSuperAdminRow(user)) {
        result.skipped.members += 1;
        continue;
      }
      const home = user.orgUnitId ? String(user.orgUnitId) : '';
      const inSource = homeInTransferMatch(home, match);
      if (!inSource) {
        result.skipped.members += 1;
        continue;
      }
      const previousPurpose = user.hierarchyPurpose || 'member';
      await prisma.user.update({
        where: { id },
        data: {
          orgUnitId: toId || null,
          hierarchyPurpose: purposeForTargetUnit(user, target),
        },
      });
      historyItems.push({
        type: 'members',
        sourceId: id,
        destId: id,
        title: memberDisplayName(user),
        previousOrgUnitId: home,
        previousHierarchyPurpose: previousPurpose,
      });
      result.moved.members += 1;
      result.total += 1;
    } catch {
      result.skipped.members += 1;
    }
  }
}

/**
 * Rows currently living in a company / branch (including its branches), for the
 * multi-select copy list. Pass `orgUnitId` empty to list rows with no company yet.
 */
export async function listTransferableData(
  req,
  { orgUnitId, toOrgUnitId, type, search = '', limit = 200 } = {},
) {
  if (String(type || '') === 'members') {
    return listTransferableMembers(req, { orgUnitId, search, limit });
  }
  const scope = await resolveViewerOrgScope(req);
  const kind = String(type || '');
  const config = TRANSFERABLE[kind];
  if (!config) {
    throw new Error('Pick leads, CRM clients, recruitment clients, jobs, candidates, or team members.');
  }

  const unitId = oid(orgUnitId);
  const destId = toOrgUnitId === undefined || toOrgUnitId === null ? null : oid(toOrgUnitId);
  const excludeDest = toOrgUnitId !== undefined && toOrgUnitId !== null && unitId !== destId;
  assertUnitAccess(scope, unitId);
  if (excludeDest) assertUnitAccess(scope, destId);

  const rows = await loadTransferableRows(kind, unitId);
  const destKeys = excludeDest ? await destinationIdentityKeys(kind, destId) : new Set();
  let alreadyInDestination = 0;
  const visibleRows = [];
  for (const row of rows) {
    const key = transferIdentityKey(kind, row);
    if (excludeDest && key && destKeys.has(key)) {
      alreadyInDestination += 1;
      continue;
    }
    visibleRows.push(row);
  }

  const term = String(search || '').trim().toLowerCase();
  const items = visibleRows
    .map((row) => ({
      id: String(row.id),
      title: config.title(row),
      subtitle: config.subtitle(row) || '',
      orgUnitId: row.orgUnitId ? String(row.orgUnitId) : null,
    }))
    .filter((item) => !term || `${item.title} ${item.subtitle}`.toLowerCase().includes(term))
    .slice(0, Math.max(1, Math.min(Number(limit) || 200, 500)));

  return { type, items, alreadyInDestination };
}

async function cloneRow(delegate, id, targetOrgUnitId) {
  const row = await delegate.findUnique({ where: { id } });
  if (!row) return false;
  const data = {};
  for (const [key, value] of Object.entries(row)) {
    if (CLONE_SKIP_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    data[key] = value;
  }
  data.orgUnitId = targetOrgUnitId || null;
  const created = await delegate.create({ data });
  return created;
}

/**
 * Duplicate ("copy") or re-home ("move") selected rows into another company,
 * branch, or HQ. A null / empty `toOrgUnitId` leaves the rows with no company.
 */
export async function transferOrgUnitData(req, body = {}) {
  const scope = await resolveViewerOrgScope(req);
  const mode = String(body?.mode || 'copy').toLowerCase() === 'move' ? 'move' : 'copy';
  const fromId = oid(body?.fromOrgUnitId);
  const toId = oid(body?.toOrgUnitId);

  assertUnitAccess(scope, fromId);
  assertUnitAccess(scope, toId);

  if (fromId && toId && fromId === toId) {
    throw new Error('Pick a different company or branch to send the data to.');
  }

  if (toId) {
    const target = await prisma.orgUnit.findUnique({ where: { id: toId } });
    if (!target) throw new Error('Target company was not found.');
  }

  const selections = body?.items && typeof body.items === 'object' ? body.items : {};
  const result = { mode, copied: {}, moved: {}, skipped: {}, total: 0 };
  const historyItems = [];

  const memberIds = Array.isArray(selections.members)
    ? selections.members.map(oid).filter(Boolean)
    : [];
  result.copied.members = 0;
  result.moved.members = 0;
  result.skipped.members = 0;
  if (memberIds.length) {
    if (mode === 'copy') {
      throw new Error('Team members can only be moved, not duplicated.');
    }
    await moveTeamMembers(memberIds, fromId, toId, result, historyItems);
  }

  const seenClientIds = new Set();
  for (const type of Object.keys(TRANSFERABLE)) {
    let ids = Array.isArray(selections[type]) ? selections[type].map(oid).filter(Boolean) : [];
    result.copied[type] = 0;
    result.moved[type] = 0;
    result.skipped[type] = 0;
    if (type === 'clients' || type === 'recruitmentClients') {
      ids = ids.filter((id) => {
        if (seenClientIds.has(id)) return false;
        seenClientIds.add(id);
        return true;
      });
    }
    if (!ids.length) continue;

    const delegate = TRANSFERABLE[type].delegate();
    if (!delegate?.findUnique) {
      result.skipped[type] = ids.length;
      continue;
    }

    const destKeys = await destinationIdentityKeys(type, toId);
    for (const id of ids) {
      try {
        const source = await delegate.findUnique({ where: { id } });
        const key = transferIdentityKey(type, source);
        if (key && destKeys.has(key)) {
          result.skipped[type] += 1;
          continue;
        }
        if (mode === 'move') {
          await delegate.update({ where: { id }, data: { orgUnitId: toId || null } });
          result.moved[type] += 1;
          historyItems.push({
            type,
            sourceId: id,
            destId: id,
            title: TRANSFERABLE[type].title(source) || id,
            previousOrgUnitId: source?.orgUnitId ? String(source.orgUnitId) : '',
          });
        } else {
          const created = await cloneRow(delegate, id, toId);
          if (!created?.id) {
            result.skipped[type] += 1;
            continue;
          }
          result.copied[type] += 1;
          historyItems.push({
            type,
            sourceId: id,
            destId: String(created.id),
            title: TRANSFERABLE[type].title(source) || String(created.id),
            previousOrgUnitId: source?.orgUnitId ? String(source.orgUnitId) : '',
          });
        }
        if (key) destKeys.add(key);
        result.total += 1;
      } catch {
        result.skipped[type] += 1;
      }
    }
  }

  if (historyItems.length) {
    try {
      const [fromUnit, toUnit] = await Promise.all([
        fromId ? prisma.orgUnit.findUnique({ where: { id: fromId }, select: { name: true, parentId: true } }) : null,
        toId ? prisma.orgUnit.findUnique({ where: { id: toId }, select: { name: true, parentId: true } }) : null,
      ]);
      const labelFor = (id, unit) => {
        if (!id) return 'Unassigned';
        if (!unit) return 'Unknown company';
        return unit.parentId ? unit.name : `${unit.name} (HQ)`;
      };
      const actorName =
        [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ').trim() ||
        req.user?.name ||
        req.user?.email ||
        'User';
      const saved = await prisma.orgDataTransfer.create({
        data: {
          mode,
          fromOrgUnitId: fromId || null,
          fromLabel: labelFor(fromId, fromUnit),
          toOrgUnitId: toId || null,
          toLabel: labelFor(toId, toUnit),
          performedById: req.user?.id || null,
          performedByName: actorName,
          items: historyItems,
          counts: {
            copied: result.copied,
            moved: result.moved,
            skipped: result.skipped,
            total: result.total,
          },
        },
      });
      result.historyId = String(saved.id);
    } catch (error) {
      console.warn('[org.transfer] history not saved:', error?.message || error);
    }
  }

  return result;
}

export async function listOrgDataTransfers(req, { limit = 100 } = {}) {
  await resolveViewerOrgScope(req);
  try {
    if (!prisma.orgDataTransfer?.findMany) return { items: [] };
    const rows = await prisma.orgDataTransfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(Number(limit) || 100, 300)),
    });
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        mode: row.mode,
        fromOrgUnitId: row.fromOrgUnitId || '',
        fromLabel: row.fromLabel || 'Unassigned',
        toOrgUnitId: row.toOrgUnitId || '',
        toLabel: row.toLabel || 'Unassigned',
        performedByName: row.performedByName || 'User',
        items: Array.isArray(row.items) ? row.items : [],
        counts: row.counts && typeof row.counts === 'object' ? row.counts : {},
        total: Array.isArray(row.items) ? row.items.length : Number(row.counts?.total || 0),
        revertedAt: row.revertedAt || null,
        createdAt: row.createdAt,
      })),
    };
  } catch (error) {
    console.warn('[org.transfer] history unavailable:', error?.message || error);
    return { items: [] };
  }
}

const SOFT_DELETE_TRANSFER_TYPES = new Set(['jobs', 'clients', 'recruitmentClients', 'candidates', 'leads']);

function currentHome(row) {
  return row?.orgUnitId ? String(row.orgUnitId) : '';
}

async function revertCopiedRecord(type, destId, expectedDestHome) {
  const config = TRANSFERABLE[type];
  if (!config) return 'skipped';
  const delegate = config.delegate();
  const row = await delegate.findUnique({ where: { id: destId } });
  if (!row) return 'missing';
  if (row.isDeleted === true) return 'already';
  if (currentHome(row) !== String(expectedDestHome || '')) return 'moved-away';
  if (SOFT_DELETE_TRANSFER_TYPES.has(type)) {
    await delegate.update({
      where: { id: destId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return 'reverted';
  }
  await delegate.delete({ where: { id: destId } });
  return 'reverted';
}

async function revertMovedRecord(type, id, previousOrgUnitId, extra = {}) {
  if (type === 'members') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, orgUnitId: true },
    });
    if (!user) return 'missing';
    await prisma.user.update({
      where: { id },
      data: {
        orgUnitId: previousOrgUnitId || null,
        ...(extra.previousHierarchyPurpose
          ? { hierarchyPurpose: extra.previousHierarchyPurpose }
          : {}),
      },
    });
    return 'reverted';
  }
  const config = TRANSFERABLE[type];
  if (!config) return 'skipped';
  const delegate = config.delegate();
  const row = await delegate.findUnique({ where: { id } });
  if (!row) return 'missing';
  if (row.isDeleted === true) return 'already';
  await delegate.update({
    where: { id },
    data: { orgUnitId: previousOrgUnitId || null },
  });
  return 'reverted';
}

export async function revertOrgDataTransfer(req, id) {
  const scope = await resolveViewerOrgScope(req);
  const transferId = oid(id);
  if (!transferId) throw new Error('History item was not found.');
  if (!prisma.orgDataTransfer?.findUnique) {
    throw new Error('History is not available yet. Restart the API after prisma generate.');
  }
  const row = await prisma.orgDataTransfer.findUnique({ where: { id: transferId } });
  if (!row) throw new Error('History item was not found.');
  if (row.revertedAt) throw new Error('This action was already reverted.');
  assertUnitAccess(scope, oid(row.fromOrgUnitId));
  assertUnitAccess(scope, oid(row.toOrgUnitId));

  const items = Array.isArray(row.items) ? row.items : [];
  const summary = { reverted: 0, missing: 0, skipped: 0 };
  const expectedDest = oid(row.toOrgUnitId);

  for (const item of items) {
    const type = String(item?.type || '');
    try {
      let status = 'skipped';
      if (row.mode === 'copy') {
        status = await revertCopiedRecord(type, oid(item.destId || item.sourceId), expectedDest);
      } else {
        status = await revertMovedRecord(type, oid(item.sourceId || item.destId), oid(item.previousOrgUnitId), {
          previousHierarchyPurpose: item.previousHierarchyPurpose,
        });
      }
      if (status === 'reverted') summary.reverted += 1;
      else if (status === 'missing' || status === 'already') summary.missing += 1;
      else summary.skipped += 1;
    } catch {
      summary.skipped += 1;
    }
  }

  await prisma.orgDataTransfer.update({
    where: { id: transferId },
    data: {
      revertedAt: new Date(),
      revertedById: req.user?.id || null,
    },
  });

  return { id: transferId, mode: row.mode, ...summary };
}

function unitPositionLabel(orgUnitId, unitsById) {
  const id = String(orgUnitId || '');
  if (!id) return { company: 'Unassigned', position: 'No company' };
  const unit = unitsById.get(id);
  if (!unit) return { company: 'Unknown', position: 'Unknown' };
  if (!unit.parentId) return { company: unit.name, position: 'HQ' };
  const parent = unitsById.get(String(unit.parentId));
  if (unit.isLeaf) {
    return {
      company: parent?.name || unit.name,
      position: `Branch · ${unit.name}`,
    };
  }
  return { company: unit.name, position: 'Company' };
}

async function loadAllLiveRows(type) {
  const config = TRANSFERABLE[type];
  if (!config) return [];
  const delegate = config.delegate();
  if (!delegate?.findMany) return [];
  let rows = [];
  try {
    rows = await delegate.findMany({
      orderBy: { createdAt: 'asc' },
      take: 8000,
    });
  } catch {
    return [];
  }
  return rows.filter((row) => {
    if (row?.isDeleted === true || row?.deletedAt) return false;
    if (typeof config.match === 'function' && !config.match(row)) return false;
    return true;
  });
}

function mapDuplicateMember(type, row, unitsById, role) {
  const config = TRANSFERABLE[type];
  const place = unitPositionLabel(row.orgUnitId, unitsById);
  return {
    id: String(row.id),
    role,
    title: config.title(row),
    subtitle: config.subtitle(row) || '',
    orgUnitId: row.orgUnitId ? String(row.orgUnitId) : '',
    company: place.company,
    position: place.position,
    createdAt: row.createdAt || null,
  };
}

async function scanDuplicateGroups(type, unitsById) {
  const rows = await loadAllLiveRows(type);
  const grouped = new Map();
  for (const row of rows) {
    const key = transferIdentityKey(type, row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const groups = [];
  for (const members of grouped.values()) {
    if (members.length < 2) continue;
    members.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime() ||
        String(a.id).localeCompare(String(b.id)),
    );
    const original = members[0];
    const copies = members.slice(1);
    groups.push({
      originalId: String(original.id),
      title: TRANSFERABLE[type].title(original),
      subtitle: TRANSFERABLE[type].subtitle(original) || '',
      original: mapDuplicateMember(type, original, unitsById, 'original'),
      duplicates: copies.map((row) => mapDuplicateMember(type, row, unitsById, 'duplicate')),
    });
  }
  groups.sort((a, b) => b.duplicates.length - a.duplicates.length || a.title.localeCompare(b.title));
  return groups;
}

export async function listOrgDuplicates(req, { type = 'jobs' } = {}) {
  await resolveViewerOrgScope(req);
  const kind = String(type || 'jobs');
  if (!TRANSFERABLE[kind]) {
    throw new Error('Pick jobs, CRM clients, recruitment clients, leads, or candidates.');
  }
  const units = await prisma.orgUnit.findMany({
    select: { id: true, name: true, parentId: true, isLeaf: true },
  });
  const unitsById = new Map(units.map((unit) => [String(unit.id), unit]));
  const groups = await scanDuplicateGroups(kind, unitsById);
  const counts = {};
  for (const other of Object.keys(TRANSFERABLE)) {
    if (other === kind) {
      counts[other] = {
        groups: groups.length,
        duplicates: groups.reduce((sum, group) => sum + group.duplicates.length, 0),
      };
      continue;
    }
    const otherGroups = await scanDuplicateGroups(other, unitsById);
    counts[other] = {
      groups: otherGroups.length,
      duplicates: otherGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
    };
  }
  return {
    type: kind,
    rule:
      'Original = oldest record in the group. Later copies with the same identity in another company are duplicates.',
    groups,
    originalCount: groups.length,
    duplicateCount: groups.reduce((sum, group) => sum + group.duplicates.length, 0),
    counts,
  };
}

async function softDeleteDuplicateRow(type, id) {
  const config = TRANSFERABLE[type];
  if (!config) return 'skipped';
  const delegate = config.delegate();
  const row = await delegate.findUnique({ where: { id } });
  if (!row) return 'missing';
  if (row.isDeleted === true) return 'already';
  if (SOFT_DELETE_TRANSFER_TYPES.has(type)) {
    await delegate.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return 'removed';
  }
  await delegate.delete({ where: { id } });
  return 'removed';
}

export async function removeOrgDuplicates(req, { type = 'jobs', ids } = {}) {
  await resolveViewerOrgScope(req);
  const kind = String(type || 'jobs');
  if (!TRANSFERABLE[kind]) {
    throw new Error('Pick jobs, CRM clients, recruitment clients, leads, or candidates.');
  }
  const units = await prisma.orgUnit.findMany({
    select: { id: true, name: true, parentId: true, isLeaf: true },
  });
  const unitsById = new Map(units.map((unit) => [String(unit.id), unit]));
  const groups = await scanDuplicateGroups(kind, unitsById);
  const originalIds = new Set(groups.map((group) => group.original.id));
  const duplicateIds = new Set(groups.flatMap((group) => group.duplicates.map((row) => row.id)));
  const requested = Array.isArray(ids) && ids.length
    ? ids.map(oid).filter(Boolean)
    : [...duplicateIds];

  const result = { type: kind, removed: 0, skipped: 0, missing: 0 };
  for (const id of requested) {
    if (originalIds.has(id) || !duplicateIds.has(id)) {
      result.skipped += 1;
      continue;
    }
    try {
      const status = await softDeleteDuplicateRow(kind, id);
      if (status === 'removed') result.removed += 1;
      else if (status === 'missing' || status === 'already') result.missing += 1;
      else result.skipped += 1;
    } catch {
      result.skipped += 1;
    }
  }
  return result;
}

export async function getOrgTreeStats(req) {
  const data = await listOrgStructure(req);
  const byParent = new Map();
  for (const unit of data.units) {
    const pid = unit.parentId || '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(unit);
  }

  function subtreePeople(unitId) {
    const ids = new Set();
    const stack = [unitId];
    while (stack.length) {
      const current = stack.pop();
      const node = data.units.find((u) => u.id === current);
      if (!node) continue;
      for (const p of node.people || []) ids.add(p.id);
      for (const child of byParent.get(current) || []) stack.push(child.id);
    }
    return ids.size;
  }

  function nest(unit, seen = new Set()) {
    const id = String(unit?.id || '');
    if (!id || seen.has(id)) {
      return { ...unit, children: [], subtreePeople: Number(unit?.peopleCount || 0) };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(id);
    return {
      ...unit,
      subtreePeople: subtreePeople(unit.id),
      children: (byParent.get(unit.id) || []).map((child) => nest(child, nextSeen)),
    };
  }

  const root = data.units.find((u) => !u.parentId) || data.root;
  return {
    levels: data.levels,
    scope: data.scope,
    tree: root ? nest(root) : null,
    unassignedCount: data.unassignedCount || 0,
    unassignedPeople: data.unassignedPeople || [],
  };
}

export async function listPublicOrgUnits({ tenantDbName, parentId } = {}) {
  const where = { status: 'active' };
  if (parentId) where.parentId = String(parentId);
  else where.levelOrder = 2;
  const units = await prisma.orgUnit.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  return units.map((u) => mapUnit(u));
}
