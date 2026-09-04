import { apiFetch } from '../api';
import { dedupeByCompanyName } from '../companyNameKey';

export type OrgPerson = {
  id: string;
  name: string;
  email?: string;
  hierarchyPurpose?: string;
  purposeLabel?: string;
  roleName?: string;
  roleId?: string;
  unassigned?: boolean;
};

export type OrgUnitNode = {
  id: string;
  parentId?: string | null;
  name: string;
  levelOrder: number;
  isLeaf: boolean;
  status?: string;
  levelName?: string;
  peopleCount?: number;
  people?: OrgPerson[];
  subtreePeople?: number;
  children?: OrgUnitNode[];
};

export type OrgTreePayload = {
  levels?: Array<{ code: string; displayName: string; levelOrder: number; isLeaf: boolean }>;
  scope?: {
    isTenantAdmin?: boolean;
    isTenantWide?: boolean;
    canSwitchCompanies?: boolean;
    hierarchyPurpose?: string;
  };
  tree: OrgUnitNode | null;
  unassignedCount?: number;
  unassignedPeople?: OrgPerson[];
};

export type OrgWorkspaceScope = {
  isTenantAdmin?: boolean;
  isTenantWide?: boolean;
  canSwitchCompanies?: boolean;
  hierarchyPurpose?: string;
  orgUnitId?: string | null;
  homeOrgUnitId?: string | null;
  homeOrgUnitName?: string | null;
  homeIsOrgCompany?: boolean;
  hasCompanies?: boolean;
  companies?: Array<{ id: string; name: string }>;
  companiesCrm?: Array<{ id: string; name: string }>;
  companiesRecruitment?: Array<{ id: string; name: string }>;
};

export async function apiOrgWorkspace() {
  const res = await apiFetch<OrgWorkspaceScope>('/org-units/workspace', { auth: true });
  return res.data;
}

export async function apiGetAssignCompanies(module?: string) {
  const query = module ? `?module=${encodeURIComponent(module)}` : '';
  const res = await apiFetch<{ companies: Array<{ id: string; name: string; kind?: string }> }>(
    `/org-units/assign-companies${query}`,
    { auth: true },
  );
  const data = res.data as { companies?: Array<{ id: string; name: string; kind?: string }> } | unknown;
  if (Array.isArray(data)) {
    return dedupeByCompanyName(data as Array<{ id: string; name: string; kind?: string }>, (company) => company.name);
  }
  if (data && typeof data === 'object' && Array.isArray((data as { companies?: unknown }).companies)) {
    return dedupeByCompanyName(
      (data as { companies: Array<{ id: string; name: string; kind?: string }> }).companies,
      (company) => company.name,
    );
  }
  return [];
}

export async function apiOrgTree() {
  const res = await apiFetch<OrgTreePayload>('/org-units/tree', { auth: true });
  return res.data;
}

export type OrgUnitCreateResult = OrgUnitNode & {
  attachedCount?: number;
  stamped?: { jobs: number; leads: number; clients: number; candidates: number };
  createdUser?: { id: string; email?: string; name?: string } | null;
  credentialData?: { loginId?: string; tempPassword?: string } | null;
};

export async function apiCreateOrgUnit(body: {
  name: string;
  parentId?: string;
  kind: 'company' | 'site';
  departmentId?: string;
  userIds?: string[];
  headUserId?: string;
  adoptWorkspace?: boolean;
  newUser?: {
    firstName: string;
    lastName?: string;
    email: string;
    roleId?: string;
    generateCredentials?: boolean;
    sendInvite?: boolean;
    loginIdOption?: 'auto' | 'email' | 'custom';
  };
  newUserPurpose?: 'member' | 'company_head' | 'site_head';
}) {
  const res = await apiFetch<OrgUnitCreateResult>('/org-units', {
    auth: true,
    method: 'POST',
    body,
  });
  return res.data;
}

export async function apiUpdateOrgUnit(id: string, body: { name?: string; status?: string }) {
  const res = await apiFetch<OrgUnitNode>(`/org-units/${encodeURIComponent(id)}`, {
    auth: true,
    method: 'PATCH',
    body,
  });
  return res.data;
}

export async function apiDeleteOrgUnit(id: string) {
  const res = await apiFetch<{ deleted: boolean }>(`/org-units/${encodeURIComponent(id)}`, {
    auth: true,
    method: 'DELETE',
  });
  return res.data;
}

export async function apiAdoptWorkspace(orgUnitId: string, userIds?: string[]) {
  const res = await apiFetch<{
    id: string;
    name: string;
    attachedCount: number;
    stamped?: { jobs: number; leads: number; clients: number; candidates: number };
  }>('/org-units/adopt-workspace', {
    auth: true,
    method: 'POST',
    body: { orgUnitId, userIds: userIds?.length ? userIds : undefined },
  });
  return res.data;
}

/** Attach existing untagged jobs/leads/clients/candidates AND leftover users to this company id. */
export async function apiStampUntaggedToOrgUnit(orgUnitId: string, userIds?: string[]) {
  const res = await apiFetch<{
    id: string;
    name: string;
    attachedCount?: number;
    stamped: { jobs: number; leads: number; clients: number; candidates: number };
  }>('/org-units/stamp-untagged', {
    auth: true,
    method: 'POST',
    body: { orgUnitId, userIds: userIds?.length ? userIds : undefined },
  });
  return res.data;
}

export type TransferableType = 'leads' | 'clients' | 'recruitmentClients' | 'jobs' | 'candidates' | 'members';

export type TransferableItem = {
  id: string;
  title: string;
  subtitle?: string;
  orgUnitId?: string | null;
};

/** Rows living in a company/branch (empty id = rows with no company yet). */
export async function apiTransferableData(params: {
  orgUnitId: string;
  toOrgUnitId?: string;
  type: TransferableType;
  search?: string;
}) {
  const query = new URLSearchParams({ orgUnitId: params.orgUnitId, type: params.type });
  query.set('toOrgUnitId', params.toOrgUnitId ?? '');
  if (params.search) query.set('search', params.search);
  const res = await apiFetch<{
    type: TransferableType;
    items: TransferableItem[];
    alreadyInDestination?: number;
  }>(
    `/org-units/transferable-data?${query.toString()}`,
    { auth: true },
  );
  return res.data;
}

export type TransferResult = {
  mode: 'copy' | 'move';
  copied: Record<TransferableType, number>;
  moved: Record<TransferableType, number>;
  skipped: Record<TransferableType, number>;
  total: number;
};

/** Duplicate records, or move records and team members, between companies. */
export async function apiTransferOrgData(body: {
  fromOrgUnitId: string;
  toOrgUnitId: string;
  mode: 'copy' | 'move';
  items: Partial<Record<TransferableType, string[]>>;
}) {
  const res = await apiFetch<TransferResult>('/org-units/transfer-data', {
    auth: true,
    method: 'POST',
    body,
  });
  return res.data;
}

export type OrgTransferHistoryItem = {
  type: TransferableType | string;
  sourceId?: string;
  destId?: string;
  title?: string;
  previousOrgUnitId?: string;
};

export type OrgTransferHistoryRow = {
  id: string;
  mode: 'copy' | 'move' | string;
  fromOrgUnitId?: string;
  fromLabel: string;
  toOrgUnitId?: string;
  toLabel: string;
  performedByName: string;
  items: OrgTransferHistoryItem[];
  counts?: { copied?: Record<string, number>; moved?: Record<string, number>; total?: number };
  total: number;
  revertedAt?: string | null;
  createdAt: string;
};

export async function apiOrgTransferHistory() {
  const res = await apiFetch<{ items: OrgTransferHistoryRow[] }>('/org-units/transfer-history', { auth: true });
  return res.data;
}

export async function apiRevertOrgTransfer(id: string) {
  const res = await apiFetch<{ id: string; mode: string; reverted: number; missing: number; skipped: number }>(
    `/org-units/transfer-history/${id}/revert`,
    { auth: true, method: 'POST' },
  );
  return res.data;
}

export type OrgDuplicateMember = {
  id: string;
  role: 'original' | 'duplicate' | string;
  title: string;
  subtitle?: string;
  orgUnitId?: string;
  company: string;
  position: string;
  createdAt?: string | null;
};

export type OrgDuplicateGroup = {
  originalId: string;
  title: string;
  subtitle?: string;
  original: OrgDuplicateMember;
  duplicates: OrgDuplicateMember[];
};

export type OrgDuplicatesPayload = {
  type: TransferableType | string;
  rule?: string;
  groups: OrgDuplicateGroup[];
  originalCount: number;
  duplicateCount: number;
  counts?: Record<string, { groups: number; duplicates: number }>;
};

export async function apiOrgDuplicates(type: TransferableType | string = 'jobs') {
  const query = new URLSearchParams({ type: String(type) });
  const res = await apiFetch<OrgDuplicatesPayload>(`/org-units/duplicates?${query.toString()}`, { auth: true });
  return res.data;
}

export async function apiRemoveOrgDuplicates(body: { type: TransferableType | string; ids?: string[] }) {
  const res = await apiFetch<{ type: string; removed: number; skipped: number; missing: number }>(
    '/org-units/duplicates/remove',
    { auth: true, method: 'POST', body },
  );
  return res.data;
}

export async function apiAssignOrgMember(body: {
  userId?: string;
  orgUnitId: string;
  hierarchyPurpose: 'member' | 'company_head' | 'site_head';
  roleId?: string;
  newUser?: {
    firstName: string;
    lastName?: string;
    email: string;
    roleId?: string;
    generateCredentials?: boolean;
    sendInvite?: boolean;
    loginIdOption?: 'auto' | 'email' | 'custom';
  };
}) {
  const res = await apiFetch<
    OrgPerson & { credentialData?: { loginId?: string; tempPassword?: string } | null }
  >('/org-units/assign', {
    auth: true,
    method: 'POST',
    body,
  });
  return res.data;
}
