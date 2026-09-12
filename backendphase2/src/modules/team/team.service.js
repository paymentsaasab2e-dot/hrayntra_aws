import { prisma } from '../../config/prisma.js';
import { getPaginationParams, formatPaginationResponse } from '../../utils/pagination.js';
import { hqPlatformUserEmailNotClause, isHqPlatformUser } from '../../utils/hqPlatformUser.js';

const TEAM_KIND_SALES = 'SALES';
const TEAM_KIND_GENERAL = 'GENERAL';
/** Org ranks at or below this (1 = top) are suggested by default for sales groups. */
export const SALES_DEFAULT_ORG_RANK_MAX = 2;

function oid(value) {
  return String(value || '').trim();
}

function normalizeKind(value) {
  const kind = String(value || TEAM_KIND_GENERAL).trim().toUpperCase();
  return kind === TEAM_KIND_SALES ? TEAM_KIND_SALES : TEAM_KIND_GENERAL;
}

function isTenantSuperAdminUser(user) {
  const role = String(user?.role || '').trim().toUpperCase().replace(/\s+/g, '_');
  const roleName = String(user?.systemRole?.roleName || user?.roleName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return (
    role === 'SUPER_ADMIN' ||
    roleName === 'SUPER_ADMIN' ||
    roleName.replace(/_/g, '') === 'SUPERADMIN'
  );
}

function memberLabel(user, unitNameById = null) {
  if (!user) return null;
  // Keep tenant Super Admins available for sales teams; only drop true HQ platform ops.
  if (isHqPlatformUser(user) && !isTenantSuperAdminUser(user)) return null;
  const name =
    String(user.name || '').trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email ||
    'User';
  const orgUnitId = user.orgUnitId ? String(user.orgUnitId) : null;
  return {
    id: String(user.id),
    name,
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    orgUnitId,
    orgUnitName: orgUnitId && unitNameById ? unitNameById.get(orgUnitId) || '' : '',
    orgRank: user.orgRank ?? null,
    hierarchyPurpose: user.hierarchyPurpose || 'member',
    roleName: user.systemRole?.roleName || '',
    role: user.role || '',
    isSuperAdmin: isTenantSuperAdminUser(user),
    departmentName: user.departmentRelation?.name || '',
  };
}

const memberInclude = {
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      role: true,
      orgUnitId: true,
      orgRank: true,
      hierarchyPurpose: true,
      systemRole: { select: { id: true, roleName: true, color: true } },
      departmentRelation: { select: { id: true, name: true } },
    },
  },
};

function formatTeam(team) {
  if (!team) return null;
  return {
    id: String(team.id),
    name: team.name,
    kind: normalizeKind(team.kind),
    department: team.department || null,
    description: team.description || null,
    orgUnitId: team.orgUnitId || null,
    orgUnitName: team.orgUnit?.name || null,
    isActive: team.isActive !== false,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    memberCount: team._count?.members ?? team.members?.length ?? 0,
    members: (team.members || [])
      .map((row) => {
        const user = memberLabel(row.user);
        if (!user) return null;
        return {
          ...user,
          membershipId: String(row.id),
          membershipRole: row.role || 'MEMBER',
          joinedAt: row.joinedAt,
        };
      })
      .filter(Boolean),
  };
}

/**
 * When any active SALES group exists, CRM assignees must be in one of them.
 * Returns null when unrestricted (no sales groups configured yet).
 */
export async function getActiveSalesTeamMemberIdSet({ orgUnitId = null } = {}) {
  let teams = [];
  try {
    teams = await prisma.team.findMany({
      where: {
        kind: TEAM_KIND_SALES,
        isActive: true,
      },
      select: {
        id: true,
        orgUnitId: true,
        members: { select: { userId: true } },
      },
    });
  } catch (error) {
    // Older generated Prisma clients / DBs may not have Team.kind yet — do not block CRM assign.
    console.warn('[team] sales team kind filter unavailable:', error?.message || error);
    return null;
  }
  if (!teams.length) return null;

  const requested = oid(orgUnitId);
  const relevant = requested
    ? teams.filter((team) => !team.orgUnitId || String(team.orgUnitId) === requested)
    : teams;

  // If company-scoped teams exist for this company, prefer those; else all sales teams.
  const scoped = requested
    ? relevant.filter((team) => team.orgUnitId && String(team.orgUnitId) === requested)
    : [];
  const use = scoped.length ? scoped : relevant;

  const ids = new Set();
  for (const team of use) {
    for (const member of team.members || []) {
      if (member.userId) ids.add(String(member.userId));
    }
  }
  return ids;
}

export const teamService = {
  TEAM_KIND_SALES,
  TEAM_KIND_GENERAL,
  SALES_DEFAULT_ORG_RANK_MAX,

  async getAll(req) {
    const { page, limit, skip } = getPaginationParams(req);
    const { department, search, kind } = req.query || {};

    const where = {};
    if (department) where.department = String(department);
    if (kind) where.kind = normalizeKind(kind);
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        include: {
          members: { include: memberInclude },
          orgUnit: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.team.count({ where }),
    ]);

    return formatPaginationResponse(teams.map(formatTeam), page, limit, total);
  },

  async getById(id) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: { include: memberInclude },
        orgUnit: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    return formatTeam(team);
  },

  async create(data) {
    const name = String(data?.name || '').trim();
    if (!name) throw new Error('Enter a team name.');
    const kind = normalizeKind(data?.kind);
    const orgUnitId = oid(data?.orgUnitId) || null;
    if (orgUnitId) {
      const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId }, select: { id: true } });
      if (!unit) throw new Error('Company or branch not found.');
    }

    const team = await prisma.team.create({
      data: {
        name,
        kind,
        department: data?.department ? String(data.department) : null,
        description: data?.description ? String(data.description) : null,
        orgUnitId: orgUnitId || undefined,
        isActive: data?.isActive !== false,
      },
    });

    const memberIds = Array.isArray(data?.memberIds)
      ? data.memberIds.map(oid).filter(Boolean)
      : [];
    if (memberIds.length) {
      for (let i = 0; i < memberIds.length; i += 1) {
        await prisma.teamMember.create({
          data: {
            userId: memberIds[i],
            teamId: team.id,
            role: data?.memberRoles?.[i] || 'MEMBER',
          },
        });
      }
    }

    return this.getById(team.id);
  },

  async update(id, data) {
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw new Error('Team not found');

    const updateData = {};
    if (data?.name !== undefined) {
      const name = String(data.name || '').trim();
      if (!name) throw new Error('Enter a team name.');
      updateData.name = name;
    }
    if (data?.kind !== undefined) updateData.kind = normalizeKind(data.kind);
    if (data?.department !== undefined) updateData.department = data.department || null;
    if (data?.description !== undefined) updateData.description = data.description || null;
    if (data?.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data?.orgUnitId !== undefined) {
      const orgUnitId = oid(data.orgUnitId);
      updateData.orgUnitId = orgUnitId || null;
      if (orgUnitId) {
        const unit = await prisma.orgUnit.findUnique({ where: { id: orgUnitId }, select: { id: true } });
        if (!unit) throw new Error('Company or branch not found.');
      }
    }

    await prisma.team.update({ where: { id }, data: updateData });

    if (Array.isArray(data?.memberIds)) {
      const memberIds = data.memberIds.map(oid).filter(Boolean);
      await prisma.teamMember.deleteMany({ where: { teamId: id } });
      for (const userId of memberIds) {
        await prisma.teamMember.create({
          data: { teamId: id, userId, role: 'MEMBER' },
        });
      }
    }

    return this.getById(id);
  },

  async addMember(teamId, userId, role) {
    const id = oid(teamId);
    const uid = oid(userId);
    if (!id || !uid) throw new Error('Team and member are required.');
    const [team, user] = await Promise.all([
      prisma.team.findUnique({ where: { id }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: uid }, select: { id: true } }),
    ]);
    if (!team) throw new Error('Team not found');
    if (!user) throw new Error('User not found');

    const existing = await prisma.teamMember.findFirst({ where: { teamId: id, userId: uid } });
    if (existing) throw new Error('Member is already in this team.');

    await prisma.teamMember.create({
      data: {
        teamId: id,
        userId: uid,
        role: role || 'MEMBER',
      },
    });
    return this.getById(id);
  },

  async removeMember(teamId, userId) {
    await prisma.teamMember.deleteMany({
      where: {
        teamId: oid(teamId),
        userId: oid(userId),
      },
    });
    return { message: 'Member removed successfully' };
  },

  async delete(id) {
    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    await prisma.team.delete({ where: { id } });
    return { message: 'Team deleted successfully' };
  },

  /**
   * Candidates to add into a sales group.
   * Default: Super Admins + top org ranks (1–2) + company/site heads.
   * includeLowerRanks=true: everyone else in scope.
   */
  async listSalesCandidateMembers({ orgUnitId = null, includeLowerRanks = false, teamId = null } = {}) {
    const emailExclude = hqPlatformUserEmailNotClause();
    const clauses = [
      { OR: [{ status: 'ACTIVE' }, { status: null }] },
      ...(Object.keys(emailExclude).length ? [emailExclude] : []),
    ];
    const unitId = oid(orgUnitId);
    // Load company-scoped people and/or whole tenant; Super Admins always merged in JS.
    if (unitId) {
      clauses.push({ orgUnitId: unitId });
    }

    const [users, orgUnits, superAdminUsers] = await Promise.all([
      prisma.user.findMany({
        where: clauses.length === 1 ? clauses[0] : { AND: clauses },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          orgUnitId: true,
          orgRank: true,
          hierarchyPurpose: true,
          systemRole: { select: { id: true, roleName: true, color: true } },
          departmentRelation: { select: { id: true, name: true } },
        },
        orderBy: [{ orgRank: 'asc' }, { firstName: 'asc' }, { name: 'asc' }],
      }),
      prisma.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
      prisma.user.findMany({
        where: {
          AND: [
            { OR: [{ status: 'ACTIVE' }, { status: null }] },
            ...(Object.keys(emailExclude).length ? [emailExclude] : []),
            {
              OR: [
                { role: 'SUPER_ADMIN' },
                { systemRole: { is: { roleName: 'Super Admin' } } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          orgUnitId: true,
          orgRank: true,
          hierarchyPurpose: true,
          systemRole: { select: { id: true, roleName: true, color: true } },
          departmentRelation: { select: { id: true, name: true } },
        },
      }),
    ]);

    const byId = new Map();
    for (const user of [...users, ...superAdminUsers]) {
      byId.set(String(user.id), user);
    }
    const mergedUsers = [...byId.values()];

    const unitNameById = new Map(orgUnits.map((u) => [String(u.id), String(u.name || '')]));
    // Real companies/branches = units with a parent (not HQ root).
    const companyOrBranchIds = new Set(
      orgUnits.filter((u) => Boolean(u.parentId)).map((u) => String(u.id)),
    );

    let already = new Set();
    if (teamId) {
      const existing = await prisma.teamMember.findMany({
        where: { teamId: oid(teamId) },
        select: { userId: true },
      });
      already = new Set(existing.map((row) => String(row.userId)));
    }

    const mapped = mergedUsers
      .map((user) => memberLabel(user, unitNameById))
      .filter(Boolean)
      .filter((user) => !already.has(String(user.id)))
      // All-companies view: keep people on companies/branches + every Super Admin.
      .filter((user) => {
        if (unitId) {
          return user.isSuperAdmin || String(user.orgUnitId || '') === unitId;
        }
        if (user.isSuperAdmin) return true;
        return Boolean(user.orgUnitId && companyOrBranchIds.has(String(user.orgUnitId)));
      });

    const isTop = (user) => {
      if (user.isSuperAdmin) return true;
      const purpose = String(user.hierarchyPurpose || 'member');
      if (purpose === 'company_head' || purpose === 'site_head') return true;
      const rank = Number(user.orgRank);
      return Number.isFinite(rank) && rank > 0 && rank <= SALES_DEFAULT_ORG_RANK_MAX;
    };

    const recommended = mapped.filter(isTop);
    const lower = mapped.filter((user) => !isTop(user));

    return {
      recommended,
      lower,
      members: includeLowerRanks ? mapped : recommended,
      includeLowerRanks: Boolean(includeLowerRanks),
      defaultRankMax: SALES_DEFAULT_ORG_RANK_MAX,
      allCompanies: !unitId,
    };
  },
};
