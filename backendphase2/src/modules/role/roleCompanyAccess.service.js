import { prisma } from '../../config/prisma.js';

const ORG_SCOPE = 'ORG';
export const ROLE_COMPANY_ACCESS_KEY = 'role_company_access_v1';
export const VIEW_ALL_COMPANIES_PERMISSION = 'view_all_companies';

/** Same L2 companies as Organization Management (avoid importing org.service — circular). */
const ACTIVE_ORG_COMPANY_WHERE = {
  levelOrder: 2,
  isLeaf: false,
  status: 'active',
  parentId: { not: null },
};

export function emptyRoleCompanyAccess() {
  return { crm: [], recruitment: [] };
}

export function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((id) => String(id || '').trim()).filter(Boolean))];
}

export function normalizeRoleCompanyAccess(raw, allowedCompanyIds = null) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const allow = Array.isArray(allowedCompanyIds) && allowedCompanyIds.length
    ? new Set(allowedCompanyIds.map(String))
    : null;
  const filter = (list) => {
    const ids = uniqueIds(list);
    return allow ? ids.filter((id) => allow.has(id)) : ids;
  };
  return {
    crm: filter(src.crm),
    recruitment: filter(src.recruitment),
  };
}

export function accessForAllCompanies(companyIds) {
  const ids = uniqueIds(companyIds);
  return { crm: [...ids], recruitment: [...ids] };
}

export async function listActiveOrgCompanies() {
  const rows = await prisma.orgUnit.findMany({
    where: ACTIVE_ORG_COMPANY_WHERE,
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return (rows || []).map((row) => ({
    id: String(row.id),
    name: row.name,
  }));
}

async function loadStore() {
  const row = await prisma.setting.findFirst({
    where: { key: ROLE_COMPANY_ACCESS_KEY, scope: ORG_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
  const value = row?.value && typeof row.value === 'object' ? row.value : {};
  return value;
}

async function saveStore(store) {
  const existing = await prisma.setting.findFirst({
    where: { key: ROLE_COMPANY_ACCESS_KEY, scope: ORG_SCOPE },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data: { value: store } });
    return;
  }
  await prisma.setting.create({
    data: { key: ROLE_COMPANY_ACCESS_KEY, scope: ORG_SCOPE, value: store },
  });
}

export async function getRoleCompanyAccess(roleId, allowedCompanyIds = null) {
  const id = String(roleId || '').trim();
  if (!id) return emptyRoleCompanyAccess();
  const store = await loadStore();
  return normalizeRoleCompanyAccess(store[id], allowedCompanyIds);
}

export function resolveAccessForRole({ roleId, permissionNames = [], stored, allCompanyIds }) {
  const id = String(roleId || '').trim();
  const names = Array.isArray(permissionNames) ? permissionNames.map(String) : [];
  const fromStore = normalizeRoleCompanyAccess(stored?.[id], allCompanyIds);
  if (fromStore.crm.length || fromStore.recruitment.length) return fromStore;
  if (names.includes(VIEW_ALL_COMPANIES_PERMISSION)) {
    return accessForAllCompanies(allCompanyIds);
  }
  return emptyRoleCompanyAccess();
}

export async function decorateRolesWithCompanyAccess(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.length) return list;
  const [store, companies] = await Promise.all([loadStore(), listActiveOrgCompanies()]);
  const allCompanyIds = companies.map((c) => c.id);
  return list.map((role) => {
    const permissionNames = (role.rolePermissions || [])
      .map((row) => row?.permission?.permissionName)
      .filter(Boolean);
    return {
      ...role,
      companyAccess: resolveAccessForRole({
        roleId: role.id,
        permissionNames,
        stored: store,
        allCompanyIds,
      }),
    };
  });
}

export async function saveRoleCompanyAccess(roleId, access) {
  const id = String(roleId || '').trim();
  if (!id) return emptyRoleCompanyAccess();
  const companies = await listActiveOrgCompanies();
  const normalized = normalizeRoleCompanyAccess(access, companies.map((c) => c.id));
  const store = await loadStore();
  store[id] = normalized;
  await saveStore(store);
  return normalized;
}

/** Drop the retired tick so it cannot be assigned from the role editor. */
export async function stripViewAllCompaniesPermissionIds(permissionIds) {
  const values = uniqueIds(permissionIds);
  if (!values.length) return values;
  const viewAll = await prisma.permission.findFirst({
    where: { permissionName: VIEW_ALL_COMPANIES_PERMISSION },
    select: { id: true },
  });
  const banned = new Set(
    [viewAll?.id, VIEW_ALL_COMPANIES_PERMISSION].filter(Boolean).map(String),
  );
  return values.filter((id) => !banned.has(String(id)));
}

export async function assertSwitchCompaniesHavePicks(permissionIds, companyAccess) {
  const values = uniqueIds(permissionIds);
  if (!values.length) return;
  const records = await prisma.permission.findMany({
    where: {
      OR: [{ id: { in: values } }, { permissionName: { in: values } }],
    },
    select: { permissionName: true },
  });
  const names = new Set(records.map((row) => String(row.permissionName || '')));
  if (!names.has('switch_companies')) return;
  const access = normalizeRoleCompanyAccess(companyAccess);
  if (!access.crm.length && !access.recruitment.length) {
    const err = new Error(
      'Switch companies needs at least one CRM or Recruitment organization ticked below it',
    );
    err.statusCode = 400;
    throw err;
  }
}

export function resolveOrgSide(req) {
  const header = String(req?.headers?.['x-org-side'] || req?.query?.orgSide || '')
    .trim()
    .toLowerCase();
  if (header === 'crm' || header === 'recruitment') return header;
  const path = String(req?.originalUrl || req?.url || req?.path || '').toLowerCase();
  if (/(^|\/)(leads|clients?|contacts)(\/|\?|$)/.test(path)) return 'crm';
  if (/(^|\/)(jobs?|candidates?|interviews?|placements?|pipeline|matches)(\/|\?|$)/.test(path)) {
    return 'recruitment';
  }
  return 'all';
}
