import { prisma } from '../../config/prisma.js';
import { isSuperAdminUser } from '../../utils/superAdminScope.js';
import { hasPermission } from '../../utils/permissionScope.js';
import { teamMemberService } from '../team/teamMember.service.js';

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

  const requested = oid(
    req?.query?.orgUnitId || req?.body?.orgUnitId || req?.headers?.['x-org-unit-id'],
  );
  let viewer = null;
  if (userId) {
    viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, orgUnitId: true, hierarchyPurpose: true, role: true },
    });
  }

  const purpose = String(viewer?.hierarchyPurpose || 'member');
  const homeId = viewer?.orgUnitId ? String(viewer.orgUnitId) : '';
  const isCompanyScopedHead = purpose === 'company_head' || purpose === 'site_head';
  // Cross-company selector: Super Admin, or roles explicitly granted switch_companies.
  // Do not treat org_structure alone as switch access (Managers had org_structure and saw the selector).
  const canSwitchCompanies =
    isSuperAdminUser(req) || hasPermission(req, 'switch_companies');
  // HQ org tree editors (without being locked to a company_head home).
  const isTenantAdmin =
    canSwitchCompanies ||
    (hasPermission(req, 'org_structure') && !isCompanyScopedHead);

  const forced =
    !canSwitchCompanies &&
    (isCompanyScopedHead || Boolean(homeId));

  let scopeUnitId = null;
  if (forced && homeId) scopeUnitId = homeId;
  else if (canSwitchCompanies && requested) scopeUnitId = requested;

  const isTenantWide = Boolean(canSwitchCompanies && !scopeUnitId);
  let unitIds = [];
  let memberIds = [];
  if (scopeUnitId) {
    unitIds = await collectDescendantIds(scopeUnitId);
    memberIds = await userIdsInOrgScope(scopeUnitId);
    // Company/site heads must always see their own rows.
    if (forced && userId && !memberIds.includes(userId)) {
      memberIds = [userId, ...memberIds];
    } else if (canSwitchCompanies && userId && !memberIds.includes(userId)) {
      // Never inject HQ Super Admin into a selected company. Empty Company B must
      // stay empty — SA rows (createdBy/assignedTo) belong to HQ / other companies.
    }
  }

  const companies = await prisma.orgUnit.findMany({
    where: ACTIVE_ORG_COMPANY_WHERE,
    orderBy: { name: 'asc' },
  });

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

  const payload = {
    isTenantAdmin,
    isTenantWide,
    canSwitchCompanies: Boolean(canSwitchCompanies),
    hierarchyPurpose: purpose,
    orgUnitId: scopeUnitId,
    homeOrgUnitId: homeId || null,
    homeOrgUnitName,
    homeIsOrgCompany,
    unitIds,
    memberIds,
    // Only expose full company list to users who may switch.
    companies: canSwitchCompanies ? companies.map((c) => mapUnit(c)) : [],
    hasCompanies: companies.length > 0,
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
 * All four models carry `orgUnitId`, so a clone is the same row with a new home.
 */
const TRANSFERABLE = {
  leads: {
    delegate: () => prisma.lead,
    label: 'leads',
    title: (row) => row.companyName || row.contactName || row.email || 'Lead',
    subtitle: (row) => [row.status, row.city || row.location].filter(Boolean).join(' · '),
  },
  clients: {
    delegate: () => prisma.client,
    label: 'clients',
    title: (row) => row.companyName || 'Client',
    subtitle: (row) => [row.status, row.location].filter(Boolean).join(' · '),
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

export const TRANSFERABLE_TYPES = Object.keys(TRANSFERABLE);

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

/**
 * Rows currently living in a company / branch (including its branches), for the
 * multi-select copy list. Pass `orgUnitId` empty to list rows with no company yet.
 */
export async function listTransferableData(req, { orgUnitId, type, search = '', limit = 200 } = {}) {
  const scope = await resolveViewerOrgScope(req);
  const config = TRANSFERABLE[String(type || '')];
  if (!config) throw new Error('Pick leads, clients, jobs, or candidates.');

  const unitId = oid(orgUnitId);
  assertUnitAccess(scope, unitId);

  const delegate = config.delegate();
  if (!delegate?.findMany) return { type, items: [] };

  const unitIds = unitId ? await collectDescendantIds(unitId) : [];
  let rows = [];
  try {
    rows = await delegate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
  } catch {
    return { type, items: [] };
  }

  const wanted = new Set(unitIds.map(String));
  const term = String(search || '').trim().toLowerCase();

  const items = rows
    .filter((row) => {
      const home = row.orgUnitId ? String(row.orgUnitId) : '';
      return unitId ? wanted.has(home) : !home;
    })
    .map((row) => ({
      id: String(row.id),
      title: config.title(row),
      subtitle: config.subtitle(row) || '',
      orgUnitId: row.orgUnitId ? String(row.orgUnitId) : null,
    }))
    .filter((item) => !term || `${item.title} ${item.subtitle}`.toLowerCase().includes(term))
    .slice(0, Math.max(1, Math.min(Number(limit) || 200, 500)));

  return { type, items };
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
  await delegate.create({ data });
  return true;
}

/**
 * Duplicate ("copy") or re-home ("move") selected rows into another company /
 * branch. A null / empty `toOrgUnitId` leaves the rows with no company, so they
 * behave like freshly created data that has not been assigned yet.
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
    if (!target) throw new Error('Target company or branch was not found.');
    if (!target.parentId) throw new Error('Pick a company or branch, not HQ.');
  }

  const selections = body?.items && typeof body.items === 'object' ? body.items : {};
  const result = { mode, copied: {}, moved: {}, skipped: {}, total: 0 };

  for (const type of TRANSFERABLE_TYPES) {
    const ids = Array.isArray(selections[type]) ? selections[type].map(oid).filter(Boolean) : [];
    result.copied[type] = 0;
    result.moved[type] = 0;
    result.skipped[type] = 0;
    if (!ids.length) continue;

    const delegate = TRANSFERABLE[type].delegate();
    if (!delegate?.findUnique) {
      result.skipped[type] = ids.length;
      continue;
    }

    for (const id of ids) {
      try {
        if (mode === 'move') {
          await delegate.update({ where: { id }, data: { orgUnitId: toId || null } });
          result.moved[type] += 1;
        } else {
          const done = await cloneRow(delegate, id, toId);
          if (done) result.copied[type] += 1;
          else result.skipped[type] += 1;
        }
        result.total += 1;
      } catch {
        result.skipped[type] += 1;
      }
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

  function nest(unit) {
    return {
      ...unit,
      subtreePeople: subtreePeople(unit.id),
      children: (byParent.get(unit.id) || []).map(nest),
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
