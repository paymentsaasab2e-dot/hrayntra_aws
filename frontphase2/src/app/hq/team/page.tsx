'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  HqModulePageLayout,
  HQ_TABLE_BODY_SCROLL_CLASS,
  HQ_TABLE_CARD_CLASS,
  HQ_TOOLBAR_ROW_CLASS,
} from '@/components/hq/HqModulePageLayout';
import { HqPrimaryButton, HqSecondaryButton } from '@/components/hq/hqUi';
import { PermissionPicker } from '@/components/team/PermissionPicker';
import { SummaryCard } from '@/components/ui/SummaryCard';
import {
  apiHqCreateRole,
  apiHqCreateTeamMember,
  apiHqDeleteRole,
  apiHqDeleteTeamMember,
  apiHqListPermissions,
  apiHqListRoles,
  apiHqListTeam,
  apiHqUpdateRole,
  apiHqUpdateTeamMember,
  type HqPermissionRow,
  type HqRoleRow,
  type HqTeamMemberRow,
  type HqTeamMemberStatus,
  type HqTeamStats,
} from '@/lib/api';

type TabType = 'members' | 'roles';
type Credentials = { loginId: string; tempPassword: string };

type MemberForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  roleId: string;
  permissionIds: string[];
  status: HqTeamMemberStatus;
  generateCredentials: boolean;
  sendInvite: boolean;
};

type RoleForm = {
  roleName: string;
  description: string;
  color: string;
  permissionIds: string[];
};

const EMPTY_STATS: HqTeamStats = { total: 0, active: 0, inactive: 0 };

const emptyMemberForm = (): MemberForm => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  roleId: '',
  permissionIds: [],
  status: 'active',
  generateCredentials: true,
  sendInvite: false,
});

const emptyRoleForm = (): RoleForm => ({
  roleName: '',
  description: '',
  color: '#6366F1',
  permissionIds: [],
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function statusPill(status: HqTeamMemberStatus) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function HqTeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: TabType = searchParams.get('tab') === 'roles' ? 'roles' : 'members';

  const [members, setMembers] = useState<HqTeamMemberRow[]>([]);
  const [roles, setRoles] = useState<HqRoleRow[]>([]);
  const [stats, setStats] = useState<HqTeamStats>(EMPTY_STATS);
  const [permissionsByModule, setPermissionsByModule] = useState<
    Record<string, Array<HqPermissionRow & { createdAt: string }>>
  >({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HqTeamMemberRow | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [savingMember, setSavingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<Credentials | null>(null);

  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<HqRoleRow | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  const [savingRole, setSavingRole] = useState(false);

  const [showInlineCreateRole, setShowInlineCreateRole] = useState(false);
  const [inlineRoleName, setInlineRoleName] = useState('');
  const [inlineRoleDescription, setInlineRoleDescription] = useState('');
  const [inlineRoleColor, setInlineRoleColor] = useState('#6366F1');
  const [creatingInlineRole, setCreatingInlineRole] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamResponse, rolesResponse, permissionsResponse] = await Promise.all([
        apiHqListTeam(),
        apiHqListRoles(),
        apiHqListPermissions(),
      ]);
      const teamData = teamResponse.data;
      const rolesData = rolesResponse.data;
      const permissionsData = permissionsResponse.data;
      setMembers(teamData.members);
      setStats(teamData.stats);
      setRoles(rolesData.roles);
      setPermissionsByModule(
        Object.fromEntries(
          Object.entries(permissionsData.permissionsByModule).map(([module, permissions]) => [
            module,
            permissions.map((permission) => ({ ...permission, createdAt: '' })),
          ]),
        ),
      );
      setModuleOrder(
        permissionsData.moduleOrder?.length
          ? permissionsData.moduleOrder
          : Object.keys(permissionsData.permissionsByModule),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      [
        member.name,
        member.email,
        member.phone,
        member.role,
        member.department,
        member.designation,
        member.status,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [members, search]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      [role.roleName, role.description].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [roles, search]);

  const selectedPermissionIds = useMemo(
    () => new Set(roleForm.permissionIds),
    [roleForm.permissionIds],
  );
  const memberSelectedPermissionIds = useMemo(
    () => new Set(memberForm.permissionIds),
    [memberForm.permissionIds],
  );

  function setTab(tab: TabType) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'roles') params.set('tab', 'roles');
    else params.delete('tab');
    setSearch('');
    router.replace(params.size ? `/hq/team?${params.toString()}` : '/hq/team');
  }

  function resetInlineRole() {
    setShowInlineCreateRole(false);
    setInlineRoleName('');
    setInlineRoleDescription('');
    setInlineRoleColor('#6366F1');
  }

  function openCreateMember() {
    setEditingMember(null);
    setMemberForm(emptyMemberForm());
    setCreatedCredentials(null);
    resetInlineRole();
    setMemberDrawerOpen(true);
  }

  function openEditMember(member: HqTeamMemberRow) {
    const nameParts = member.name.trim().split(/\s+/);
    setEditingMember(member);
    setMemberForm({
      firstName: member.firstName || nameParts[0] || '',
      lastName: member.lastName || nameParts.slice(1).join(' '),
      email: member.email,
      phone: member.phone || '',
      designation: member.designation || '',
      department: member.department || '',
      roleId: member.roleId || roles.find((role) => role.roleName === member.role)?.id || '',
      permissionIds: [...(member.permissionIds || [])],
      status: member.status,
      generateCredentials: false,
      sendInvite: false,
    });
    setCreatedCredentials(null);
    resetInlineRole();
    setMemberDrawerOpen(true);
  }

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleDrawerOpen(true);
  }

  function openEditRole(role: HqRoleRow) {
    setEditingRole(role);
    setRoleForm({
      roleName: role.roleName,
      description: role.description || '',
      color: role.color || '#6366F1',
      permissionIds: [...(role.permissionIds || [])],
    });
    setRoleDrawerOpen(true);
  }

  function applyRolePermissions(roleId: string) {
    const role = roles.find((candidate) => candidate.id === roleId);
    setMemberForm((current) => ({
      ...current,
      roleId,
      permissionIds: role ? [...role.permissionIds] : [],
    }));
  }

  function togglePermission(permissionId: string) {
    setRoleForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  }

  function toggleMemberPermission(permissionId: string) {
    setMemberForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  }

  function toggleModule(
    module: string,
    selectedIds: string[],
    update: (permissionIds: string[]) => void,
  ) {
    const moduleIds = (permissionsByModule[module] || []).map((permission) => permission.id);
    const allSelected = moduleIds.length > 0 && moduleIds.every((id) => selectedIds.includes(id));
    update(
      allSelected
        ? selectedIds.filter((id) => !moduleIds.includes(id))
        : Array.from(new Set([...selectedIds, ...moduleIds])),
    );
  }

  function moduleSelectAll(module: string) {
    toggleModule(module, roleForm.permissionIds, (permissionIds) =>
      setRoleForm((current) => ({ ...current, permissionIds })),
    );
  }

  function memberModuleSelectAll(module: string) {
    toggleModule(module, memberForm.permissionIds, (permissionIds) =>
      setMemberForm((current) => ({ ...current, permissionIds })),
    );
  }

  async function saveMember() {
    const firstName = memberForm.firstName.trim();
    const lastName = memberForm.lastName.trim();
    const email = memberForm.email.trim();
    const role = roles.find((candidate) => candidate.id === memberForm.roleId);
    if (!firstName || !email || !role) {
      toast.error('First name, email, and role are required.');
      return;
    }

    setSavingMember(true);
    try {
      const payload = {
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone: memberForm.phone.trim(),
        designation: memberForm.designation.trim(),
        department: memberForm.department.trim(),
        role: role.roleName,
        roleId: role.id,
        permissionIds: memberForm.permissionIds,
        status: memberForm.status,
      };

      if (editingMember) {
        await apiHqUpdateTeamMember(editingMember.id, payload);
        toast.success('Team member updated.');
        setMemberDrawerOpen(false);
      } else {
        const response = await apiHqCreateTeamMember({
          ...payload,
          generateCredentials: memberForm.generateCredentials,
          sendInvite: memberForm.generateCredentials && memberForm.sendInvite,
        });
        toast.success('Team member created.');
        if (response.data.credentials) {
          setCreatedCredentials({
            loginId: response.data.credentials.loginId,
            tempPassword: response.data.credentials.tempPassword,
          });
        } else {
          setMemberDrawerOpen(false);
        }
      }
      await loadAll();
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    } finally {
      setSavingMember(false);
    }
  }

  async function saveRole() {
    const roleName = roleForm.roleName.trim();
    if (!roleName) {
      toast.error('Role name is required.');
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        roleName,
        description: roleForm.description.trim(),
        color: roleForm.color,
        permissionIds: roleForm.permissionIds,
      };
      if (editingRole) {
        await apiHqUpdateRole(editingRole.id, payload);
        toast.success('Role updated.');
      } else {
        await apiHqCreateRole(payload);
        toast.success('Role created.');
      }
      setRoleDrawerOpen(false);
      await loadAll();
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    } finally {
      setSavingRole(false);
    }
  }

  async function createRoleFromMemberDrawer() {
    const roleName = inlineRoleName.trim();
    if (!roleName) {
      toast.error('Role name is required.');
      return;
    }
    setCreatingInlineRole(true);
    try {
      const response = await apiHqCreateRole({
        roleName,
        description: inlineRoleDescription.trim(),
        color: inlineRoleColor,
        permissionIds: memberForm.permissionIds,
      });
      const createdRole = response.data.role;
      setRoles((current) => [...current, createdRole]);
      setMemberForm((current) => ({
        ...current,
        roleId: createdRole.id,
        permissionIds: [...createdRole.permissionIds],
      }));
      resetInlineRole();
      toast.success('Role created and selected.');
    } catch (createError) {
      toast.error(errorMessage(createError));
    } finally {
      setCreatingInlineRole(false);
    }
  }

  async function deleteMember(member: HqTeamMemberRow) {
    if (!window.confirm(`Delete ${member.name}? This cannot be undone.`)) return;
    try {
      await apiHqDeleteTeamMember(member.id);
      toast.success('Team member deleted.');
      await loadAll();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  }

  async function deleteRole(role: HqRoleRow) {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete the ${role.roleName} role? This cannot be undone.`)) return;
    try {
      await apiHqDeleteRole(role.id);
      toast.success('Role deleted.');
      await loadAll();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  }

  const drawers = (
    <>
      {memberDrawerOpen ? (
        <div className="fixed inset-0 z-[500]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close member drawer"
            onClick={() => !savingMember && setMemberDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingMember ? 'Edit member' : 'Add HQ team member'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Assign a role and customize this member&apos;s HQ permissions.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close member drawer"
                onClick={() => setMemberDrawerOpen(false)}
                disabled={savingMember}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {createdCredentials ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-bold">Credentials generated</p>
                  <p className="mt-2">
                    Login ID:{' '}
                    <span className="font-mono font-semibold">{createdCredentials.loginId}</span>
                  </p>
                  <p>
                    Temp password:{' '}
                    <span className="font-mono font-semibold">
                      {createdCredentials.tempPassword}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    Copy these credentials now and share them securely.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      First name *
                      <input
                        value={memberForm.firstName}
                        onChange={(event) =>
                          setMemberForm((current) => ({
                            ...current,
                            firstName: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Last name
                      <input
                        value={memberForm.lastName}
                        onChange={(event) =>
                          setMemberForm((current) => ({
                            ...current,
                            lastName: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                  </div>

                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email *
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(event) =>
                        setMemberForm((current) => ({ ...current, email: event.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </label>

                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Role *
                      </span>
                      <div className="flex items-center gap-3">
                        {memberForm.roleId ? (
                          <button
                            type="button"
                            onClick={() => applyRolePermissions(memberForm.roleId)}
                            className="text-xs font-semibold text-violet-600"
                          >
                            Reset to role permissions
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setShowInlineCreateRole((current) => !current)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {showInlineCreateRole ? 'Cancel' : 'Create role'}
                        </button>
                      </div>
                    </div>
                    <select
                      value={memberForm.roleId}
                      onChange={(event) => applyRolePermissions(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">Select role…</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName} ({role.permissionIds.length} permissions)
                        </option>
                      ))}
                    </select>

                    {showInlineCreateRole ? (
                      <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                        <p className="text-xs font-semibold text-violet-900">
                          Create a role using the permissions selected below
                        </p>
                        <input
                          value={inlineRoleName}
                          onChange={(event) => setInlineRoleName(event.target.value)}
                          placeholder="Role name *"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        />
                        <input
                          value={inlineRoleDescription}
                          onChange={(event) => setInlineRoleDescription(event.target.value)}
                          placeholder="Description"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        />
                        <input
                          type="color"
                          value={inlineRoleColor}
                          onChange={(event) => setInlineRoleColor(event.target.value)}
                          aria-label="Role color"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2"
                        />
                        <div className="flex justify-end gap-2">
                          <HqSecondaryButton
                            onClick={resetInlineRole}
                            disabled={creatingInlineRole}
                          >
                            Cancel
                          </HqSecondaryButton>
                          <HqPrimaryButton
                            onClick={() => void createRoleFromMemberDrawer()}
                            loading={creatingInlineRole}
                          >
                            Create &amp; select
                          </HqPrimaryButton>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-violet-600" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          HQ permissions
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
                        {memberForm.permissionIds.length} selected
                      </span>
                    </div>
                    <PermissionPicker
                      permissionsByModule={permissionsByModule}
                      selectedIds={memberSelectedPermissionIds}
                      onToggle={toggleMemberPermission}
                      onModuleSelectAll={memberModuleSelectAll}
                      maxHeightClass="max-h-[320px]"
                      moduleOrder={moduleOrder}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Phone
                      <input
                        value={memberForm.phone}
                        onChange={(event) =>
                          setMemberForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                      <select
                        value={memberForm.status}
                        onChange={(event) =>
                          setMemberForm((current) => ({
                            ...current,
                            status: event.target.value as HqTeamMemberStatus,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Designation
                      <input
                        value={memberForm.designation}
                        onChange={(event) =>
                          setMemberForm((current) => ({
                            ...current,
                            designation: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Department
                      <input
                        value={memberForm.department}
                        onChange={(event) =>
                          setMemberForm((current) => ({
                            ...current,
                            department: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                  </div>

                  {!editingMember ? (
                    <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={memberForm.generateCredentials}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              generateCredentials: event.target.checked,
                              sendInvite: event.target.checked ? current.sendInvite : false,
                            }))
                          }
                        />
                        Generate login credentials
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={memberForm.sendInvite}
                          disabled={!memberForm.generateCredentials}
                          onChange={(event) =>
                            setMemberForm((current) => ({
                              ...current,
                              sendInvite: event.target.checked,
                            }))
                          }
                        />
                        Mark invite pending
                      </label>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              {createdCredentials ? (
                <HqPrimaryButton onClick={() => setMemberDrawerOpen(false)}>Done</HqPrimaryButton>
              ) : (
                <>
                  <HqSecondaryButton
                    onClick={() => setMemberDrawerOpen(false)}
                    disabled={savingMember}
                  >
                    Cancel
                  </HqSecondaryButton>
                  <HqPrimaryButton onClick={() => void saveMember()} loading={savingMember}>
                    {editingMember ? 'Save changes' : 'Create member'}
                  </HqPrimaryButton>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {roleDrawerOpen ? (
        <div className="fixed inset-0 z-[500]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close role drawer"
            onClick={() => !savingRole && setRoleDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingRole ? 'Edit role' : 'Add HQ role'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the HQ modules and actions available to this role.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close role drawer"
                onClick={() => setRoleDrawerOpen(false)}
                disabled={savingRole}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Role name *
                <input
                  value={roleForm.roleName}
                  onChange={(event) =>
                    setRoleForm((current) => ({ ...current, roleName: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
                <textarea
                  rows={2}
                  value={roleForm.description}
                  onChange={(event) =>
                    setRoleForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Color
                <input
                  type="color"
                  value={roleForm.color}
                  onChange={(event) =>
                    setRoleForm((current) => ({ ...current, color: event.target.value }))
                  }
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2"
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Permissions ({roleForm.permissionIds.length})
                </p>
                <PermissionPicker
                  permissionsByModule={permissionsByModule}
                  selectedIds={selectedPermissionIds}
                  onToggle={togglePermission}
                  onModuleSelectAll={moduleSelectAll}
                  moduleOrder={moduleOrder}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <HqSecondaryButton
                onClick={() => setRoleDrawerOpen(false)}
                disabled={savingRole}
              >
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton onClick={() => void saveRole()} loading={savingRole}>
                {editingRole ? 'Save role' : 'Create role'}
              </HqPrimaryButton>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );

  return (
    <HqModulePageLayout
      title="Team"
      subtitle="Manage HQ members, credentials, roles, and module-level permissions."
      icon={<UsersRound className="h-5 w-5" />}
      actions={
        <>
          <HqSecondaryButton onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </HqSecondaryButton>
          {activeTab === 'members' ? (
            <HqPrimaryButton onClick={openCreateMember}>
              <Plus className="h-4 w-4" />
              Add Member
            </HqPrimaryButton>
          ) : (
            <HqPrimaryButton onClick={openCreateRole}>
              <Plus className="h-4 w-4" />
              Add Role
            </HqPrimaryButton>
          )}
        </>
      }
      belowScroll={drawers}
    >
      {error ? (
        <div className="mb-4 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard
          label="Members"
          count={stats.total}
          color="indigo"
          icon={<Users className="h-4 w-4" />}
          active
        />
        <SummaryCard
          label="Active"
          count={stats.active}
          color="green"
          icon={<UserCheck className="h-4 w-4" />}
        />
        <SummaryCard
          label="Inactive"
          count={stats.inactive}
          color="gray"
          icon={<UserX className="h-4 w-4" />}
        />
        <SummaryCard
          label="Roles"
          count={roles.length}
          color="purple"
          icon={<Shield className="h-4 w-4" />}
        />
      </div>

      <div className={HQ_TABLE_CARD_CLASS}>
        <div className={HQ_TOOLBAR_ROW_CLASS}>
          <div className="flex items-center gap-1">
            {(['members', 'roles'] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-500 hover:bg-indigo-50/60 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeTab === 'members' ? 'Search members…' : 'Search roles…'}
              className="h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 py-2 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>
        </div>

        <div className={HQ_TABLE_BODY_SCROLL_CLASS}>
          {activeTab === 'members' ? (
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length ? (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 transition hover:bg-indigo-50/40"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEditMember(member)}
                          className="text-left"
                        >
                          <span className="block font-semibold text-slate-900">{member.name}</span>
                          <span className="block text-xs text-slate-500">{member.email}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-slate-200"
                          style={{ color: member.roleColor || '#4F46E5' }}
                        >
                          <Shield className="h-3 w-3" />
                          {member.role}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {(member.permissionIds || []).length} permissions
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {member.department || member.designation || '—'}
                      </td>
                      <td className="px-4 py-3">{statusPill(member.status)}</td>
                      <td className="px-4 py-3">
                        {member.hasCredentials ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <KeyRound className="h-3.5 w-3.5" />
                            {member.loginId || 'Credentials set'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No login yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteMember(member)}
                          title="Delete member"
                          className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      {loading ? 'Loading members…' : 'No matching HQ team members.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.length ? (
                  filteredRoles.map((role) => (
                    <tr
                      key={role.id}
                      className="border-b border-slate-100 transition hover:bg-indigo-50/40"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEditRole(role)}
                          className="flex items-center gap-2 text-left font-semibold text-slate-900"
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: role.color || '#6366F1' }}
                          />
                          {role.roleName}
                          {role.isSystem ? (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                              System
                            </span>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{role.description || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {role.permissionIds.length}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteRole(role)}
                          disabled={Boolean(role.isSystem)}
                          title={role.isSystem ? 'System roles cannot be deleted' : 'Delete role'}
                          className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      {loading ? 'Loading roles…' : 'No matching roles.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </HqModulePageLayout>
  );
}
