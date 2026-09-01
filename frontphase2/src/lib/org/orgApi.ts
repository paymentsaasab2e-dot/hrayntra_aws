import { apiFetch } from '../api';

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

export async function apiGetAssignCompanies(module?: string) {
  const query = module ? `?module=${encodeURIComponent(module)}` : '';
  const res = await apiFetch<{ companies: Array<{ id: string; name: string; kind?: string }> }>(
    `/org-units/assign-companies${query}`,
    { auth: true },
  );
  const data = res.data as { companies?: Array<{ id: string; name: string; kind?: string }> } | unknown;
  if (Array.isArray(data)) return data as Array<{ id: string; name: string; kind?: string }>;
  if (data && typeof data === 'object' && Array.isArray((data as { companies?: unknown }).companies)) {
    return (data as { companies: Array<{ id: string; name: string; kind?: string }> }).companies;
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

export type TransferableType = 'leads' | 'clients' | 'jobs' | 'candidates';

export type TransferableItem = {
  id: string;
  title: string;
  subtitle?: string;
  orgUnitId?: string | null;
};

/** Rows living in a company/branch (empty id = rows with no company yet). */
export async function apiTransferableData(params: {
  orgUnitId: string;
  type: TransferableType;
  search?: string;
}) {
  const query = new URLSearchParams({ orgUnitId: params.orgUnitId, type: params.type });
  if (params.search) query.set('search', params.search);
  const res = await apiFetch<{ type: TransferableType; items: TransferableItem[] }>(
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

/** Duplicate or move selected rows into another company/branch (empty target = leave with no company). */
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
