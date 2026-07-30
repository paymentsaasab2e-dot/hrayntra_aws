'use client';

/**
 * HQ Team — Phase 2–style Members + Roles with permissions (HQ Mongo).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  HqPageContainer,
  HqPageMain,
  HqPrimaryButton,
  HqSecondaryButton,
  HqStatCard,
} from '@/components/hq/hqUi';
import { PermissionPicker } from '@/components/team/PermissionPicker';
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

const EMPTY_STATS: HqTeamStats = { total: 0, active: 0, inactive: 0 };

const MEMBER_FORM_EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  roleId: '',
  permissionIds: [] as string[],
  status: 'active' as HqTeamMemberStatus,
  generateCredentials: true,
  sendInvite: false,
};

const ROLE_FORM_EMPTY = {
  roleName: '',
  description: '',
  color: '#6366F1',
  permissionIds: [] as string[],
};

function statusPill(status: string) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export default function HqTeamPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = tabParam === 'roles' ? 'roles' : 'members';

  const [members, setMembers] = useState<HqTeamMemberRow[]>([]);
  const [stats, setStats] = useState<HqTeamStats>(EMPTY_STATS);
  const [roles, setRoles] = useState<HqRoleRow[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<
    Record<string, HqPermissionRow[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HqTeamMemberRow | null>(null);
  const [memberForm, setMemberForm] = useState(MEMBER_FORM_EMPTY);
  const [savingMember, setSavingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    loginId: string;
    tempPassword: string;
    email: string;
  } | null>(null);

  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<HqRoleRow | null>(null);
  const [roleForm, setRoleForm] = useState(ROLE_FORM_EMPTY);
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
      const [teamRes, rolesRes, permsRes] = await Promise.all([
        apiHqListTeam(),
        apiHqListRoles(),
        apiHqListPermissions(),
      ]);
      setMembers(teamRes.data?.members ?? []);
      setStats(teamRes.data?.stats ?? EMPTY_STATS);
      setRoles(rolesRes.data?.roles ?? []);
      setPermissionsByModule(permsRes.data?.permissionsByModule ?? {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load HQ team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const setTab = (tab: TabType) => {
    router.push(tab === 'members' ? '/hq/team' : `/hq/team?tab=${tab}`, { scroll: false });
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.email, m.role, m.department, m.designation, m.loginId]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [members, search]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      [r.roleName, r.description].join(' ').toLowerCase().includes(q),
    );
  }, [roles, search]);

  const openCreateMember = () => {
    setEditingMember(null);
    setCreatedCredentials(null);
    setShowInlineCreateRole(false);
    setInlineRoleName('');
    setInlineRoleDescription('');
    setInlineRoleColor('#6366F1');
    const defaultRole = roles[0];
    setMemberForm({
      ...MEMBER_FORM_EMPTY,
      roleId: defaultRole?.id || '',
      permissionIds: [...(defaultRole?.permissionIds || [])],
    });
    setMemberDrawerOpen(true);
  };

  const openEditMember = (member: HqTeamMemberRow) => {
    setEditingMember(member);
    setCreatedCredentials(null);
    setShowInlineCreateRole(false);
    setInlineRoleName('');
    setInlineRoleDescription('');
    setInlineRoleColor('#6366F1');
    const rolePerms = roles.find((r) => r.id === member.roleId)?.permissionIds || [];
    setMemberForm({
      firstName: member.firstName || member.name.split(/\s+/)[0] || '',
      lastName: member.lastName || member.name.split(/\s+/).slice(1).join(' ') || '',
      email: member.email,
      phone: member.phone || '',
      designation: member.designation || '',
      department: member.department || '',
      roleId: member.roleId || '',
      permissionIds:
        Array.isArray(member.permissionIds) && member.permissionIds.length > 0
          ? [...member.permissionIds]
          : [...rolePerms],
      status: member.status || 'active',
      generateCredentials: false,
      sendInvite: false,
    });
    setMemberDrawerOpen(true);
  };

  const applyRolePermissions = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    setMemberForm((prev) => ({
      ...prev,
      roleId,
      permissionIds: [...(role?.permissionIds || [])],
    }));
  };

  const createRoleFromMemberDrawer = async () => {
    const roleName = inlineRoleName.trim();
    if (!roleName) {
      toast.error('Role name is required');
      return;
    }
    if (memberForm.permissionIds.length === 0) {
      toast.error('Select HQ permissions below, then create the role');
      return;
    }
    setCreatingInlineRole(true);
    try {
      const res = await apiHqCreateRole({
        roleName,
        description: inlineRoleDescription.trim(),
        color: inlineRoleColor,
        permissionIds: memberForm.permissionIds,
      });
      const created = res.data?.role;
      const rolesRes = await apiHqListRoles();
      const nextRoles = rolesRes.data?.roles ?? [];
      setRoles(nextRoles);
      const selectedId =
        created?.id || nextRoles.find((r) => r.roleName.toLowerCase() === roleName.toLowerCase())?.id || '';
      const nextPerms = [...(created?.permissionIds || memberForm.permissionIds)];
      setMemberForm((prev) => ({
        ...prev,
        roleId: selectedId,
        permissionIds: nextPerms,
      }));
      setShowInlineCreateRole(false);
      setInlineRoleName('');
      setInlineRoleDescription('');
      setInlineRoleColor('#6366F1');
      toast.success(`Role "${roleName}" created and selected`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create role');
    } finally {
      setCreatingInlineRole(false);
    }
  };

  const memberSelectedPermissionIds = useMemo(
    () => new Set(memberForm.permissionIds),
    [memberForm.permissionIds],
  );

  const toggleMemberPermission = (id: string) => {
    setMemberForm((prev) => {
      const has = prev.permissionIds.includes(id);
      return {
        ...prev,
        permissionIds: has
          ? prev.permissionIds.filter((p) => p !== id)
          : [...prev.permissionIds, id],
      };
    });
  };

  const memberModuleSelectAll = (module: string) => {
    const modulePerms = permissionsByModule[module] || [];
    const ids = modulePerms.map((p) => p.id);
    const allSelected = ids.every((id) => memberForm.permissionIds.includes(id));
    setMemberForm((prev) => ({
      ...prev,
      permissionIds: allSelected
        ? prev.permissionIds.filter((id) => !ids.includes(id))
        : [...new Set([...prev.permissionIds, ...ids])],
    }));
  };

  const saveMember = async () => {
    if (!memberForm.email.trim() || (!memberForm.firstName.trim() && !memberForm.lastName.trim())) {
      toast.error('First name and email are required');
      return;
    }
    if (!memberForm.roleId) {
      toast.error('Select a role');
      return;
    }
    if (memberForm.permissionIds.length === 0) {
      toast.error('Select at least one HQ permission');
      return;
    }
    setSavingMember(true);
    try {
      const payload = {
        firstName: memberForm.firstName.trim(),
        lastName: memberForm.lastName.trim(),
        name: `${memberForm.firstName} ${memberForm.lastName}`.trim(),
        email: memberForm.email.trim().toLowerCase(),
        phone: memberForm.phone.trim(),
        designation: memberForm.designation.trim(),
        department: memberForm.department.trim(),
        roleId: memberForm.roleId,
        permissionIds: memberForm.permissionIds,
        status: memberForm.status,
        generateCredentials: memberForm.generateCredentials,
        sendInvite: memberForm.sendInvite,
      };
      if (editingMember) {
        await apiHqUpdateTeamMember(editingMember.id, payload);
        toast.success('Team member updated');
        setMemberDrawerOpen(false);
      } else {
        const res = await apiHqCreateTeamMember(payload);
        toast.success('Team member created');
        if (res.data?.credentials) {
          setCreatedCredentials(res.data.credentials);
        } else {
          setMemberDrawerOpen(false);
        }
      }
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save member');
    } finally {
      setSavingMember(false);
    }
  };

  const deleteMember = async (member: HqTeamMemberRow) => {
    if (!window.confirm(`Remove ${member.name} from HQ team?`)) return;
    try {
      await apiHqDeleteTeamMember(member.id);
      toast.success('Member removed');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete member');
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(ROLE_FORM_EMPTY);
    setRoleDrawerOpen(true);
  };

  const openEditRole = (role: HqRoleRow) => {
    setEditingRole(role);
    setRoleForm({
      roleName: role.roleName,
      description: role.description || '',
      color: role.color || '#6366F1',
      permissionIds: [...(role.permissionIds || [])],
    });
    setRoleDrawerOpen(true);
  };

  const selectedPermissionIds = useMemo(
    () => new Set(roleForm.permissionIds),
    [roleForm.permissionIds],
  );

  const togglePermission = (id: string) => {
    setRoleForm((prev) => {
      const has = prev.permissionIds.includes(id);
      return {
        ...prev,
        permissionIds: has
          ? prev.permissionIds.filter((p) => p !== id)
          : [...prev.permissionIds, id],
      };
    });
  };

  const moduleSelectAll = (module: string) => {
    const modulePerms = permissionsByModule[module] || [];
    const ids = modulePerms.map((p) => p.id);
    const allSelected = ids.every((id) => roleForm.permissionIds.includes(id));
    setRoleForm((prev) => ({
      ...prev,
      permissionIds: allSelected
        ? prev.permissionIds.filter((id) => !ids.includes(id))
        : [...new Set([...prev.permissionIds, ...ids])],
    }));
  };

  const saveRole = async () => {
    if (!roleForm.roleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    if (roleForm.permissionIds.length === 0) {
      toast.error('Select at least one permission');
      return;
    }
    setSavingRole(true);
    try {
      const payload = {
        roleName: roleForm.roleName.trim(),
        description: roleForm.description.trim(),
        color: roleForm.color,
        permissionIds: roleForm.permissionIds,
      };
      if (editingRole) {
        await apiHqUpdateRole(editingRole.id, payload);
        toast.success('Role updated');
      } else {
        await apiHqCreateRole(payload);
        toast.success('Role created');
      }
      setRoleDrawerOpen(false);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = async (role: HqRoleRow) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete role "${role.roleName}"?`)) return;
    try {
      await apiHqDeleteRole(role.id);
      toast.success('Role deleted');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete role');
    }
  };

  return (
    <HqPageMain>
      <HqPageContainer>
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <UsersRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                HQ team members with roles and permissions — same pattern as Phase 2 Team.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <HqStatCard label="Members" value={stats.total} active />
          <HqStatCard label="Active" value={stats.active} />
          <HqStatCard label="Inactive" value={stats.inactive} />
          <HqStatCard label="Roles" value={roles.length} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'members' as const, label: 'Members' },
                  { id: 'roles' as const, label: 'Roles' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'members' ? 'Search members…' : 'Search roles…'
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          {activeTab === 'members' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        {loading ? 'Loading members…' : 'No HQ team members yet. Add one with a role.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openEditMember(member)}
                            className="text-left"
                          >
                            <div className="font-semibold text-slate-900">{member.name}</div>
                            <div className="text-xs text-slate-500">{member.email}</div>
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
                          <div className="mt-1 text-[10px] text-slate-400">
                            {(member.permissionIds || []).length} permissions
                          </div>
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
                            className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                            title="Delete member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        {loading ? 'Loading roles…' : 'No roles yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((role) => (
                      <tr
                        key={role.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50/60"
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
                          {(role.permissionIds || []).length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void deleteRole(role)}
                            disabled={Boolean(role.isSystem)}
                            className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title={role.isSystem ? 'System role' : 'Delete role'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </HqPageContainer>

      {/* Member drawer */}
      {memberDrawerOpen ? (
        <div className="fixed inset-0 z-[500]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => !savingMember && setMemberDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingMember ? 'Edit member' : 'Add HQ team member'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick a role, then grant or tweak HQ module permissions for this person.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMemberDrawerOpen(false)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {createdCredentials ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-bold">Credentials generated</p>
                  <p className="mt-2">
                    Login ID: <span className="font-mono font-semibold">{createdCredentials.loginId}</span>
                  </p>
                  <p>
                    Temp password:{' '}
                    <span className="font-mono font-semibold">{createdCredentials.tempPassword}</span>
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    Share these securely. Permissions saved on this member control HQ module access.
                  </p>
                  <HqPrimaryButton
                    className="mt-3"
                    type="button"
                    onClick={() => setMemberDrawerOpen(false)}
                  >
                    Done
                  </HqPrimaryButton>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      First name *
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        value={memberForm.firstName}
                        onChange={(e) =>
                          setMemberForm((p) => ({ ...p, firstName: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Last name
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        value={memberForm.lastName}
                        onChange={(e) =>
                          setMemberForm((p) => ({ ...p, lastName: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email *
                    <input
                      type="email"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </label>
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Role *
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {memberForm.roleId ? (
                          <button
                            type="button"
                            onClick={() => applyRolePermissions(memberForm.roleId)}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                          >
                            Apply role permissions
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setShowInlineCreateRole((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {showInlineCreateRole ? 'Cancel' : 'Create role'}
                        </button>
                      </div>
                    </div>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      value={memberForm.roleId}
                      onChange={(e) => applyRolePermissions(e.target.value)}
                    >
                      <option value="">Select role…</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName} ({role.permissionIds.length} perms)
                        </option>
                      ))}
                    </select>

                    {showInlineCreateRole ? (
                      <div className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                        <p className="text-xs font-semibold text-violet-900">
                          Create a new HQ role and select it for this member
                        </p>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Role name *
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            value={inlineRoleName}
                            onChange={(e) => setInlineRoleName(e.target.value)}
                            placeholder="e.g. HQ Sales"
                          />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Description
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                            value={inlineRoleDescription}
                            onChange={(e) => setInlineRoleDescription(e.target.value)}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                          Color
                          <input
                            type="color"
                            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2"
                            value={inlineRoleColor}
                            onChange={(e) => setInlineRoleColor(e.target.value)}
                          />
                        </label>
                        <p className="text-[11px] text-slate-600">
                          This role will be created with the{' '}
                          <span className="font-semibold">{memberForm.permissionIds.length}</span>{' '}
                          HQ permission(s) selected in the checklist below.
                        </p>
                        <div className="flex justify-end gap-2">
                          <HqSecondaryButton
                            type="button"
                            onClick={() => {
                              setShowInlineCreateRole(false);
                              setInlineRoleName('');
                              setInlineRoleDescription('');
                            }}
                            disabled={creatingInlineRole}
                          >
                            Cancel
                          </HqSecondaryButton>
                          <HqPrimaryButton
                            type="button"
                            onClick={() => void createRoleFromMemberDrawer()}
                            loading={creatingInlineRole}
                          >
                            Create & select
                          </HqPrimaryButton>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Changing the role loads its permissions below — you can still check/uncheck
                        individual HQ modules. Use Create role to add a new role here.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-violet-600" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          HQ permissions *
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
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Phone
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        value={memberForm.phone}
                        onChange={(e) => setMemberForm((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Status
                      <select
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        value={memberForm.status}
                        onChange={(e) =>
                          setMemberForm((p) => ({
                            ...p,
                            status: e.target.value as HqTeamMemberStatus,
                          }))
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Designation
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        value={memberForm.designation}
                        onChange={(e) =>
                          setMemberForm((p) => ({ ...p, designation: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Department
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        value={memberForm.department}
                        onChange={(e) =>
                          setMemberForm((p) => ({ ...p, department: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  {!editingMember ? (
                    <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={memberForm.generateCredentials}
                          onChange={(e) =>
                            setMemberForm((p) => ({
                              ...p,
                              generateCredentials: e.target.checked,
                            }))
                          }
                        />
                        Generate login credentials
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={memberForm.sendInvite}
                          onChange={(e) =>
                            setMemberForm((p) => ({ ...p, sendInvite: e.target.checked }))
                          }
                          disabled={!memberForm.generateCredentials}
                        />
                        Mark invite pending
                      </label>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {!createdCredentials ? (
              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <HqSecondaryButton
                  type="button"
                  onClick={() => setMemberDrawerOpen(false)}
                  disabled={savingMember}
                >
                  Cancel
                </HqSecondaryButton>
                <HqPrimaryButton type="button" onClick={() => void saveMember()} loading={savingMember}>
                  {editingMember ? 'Save changes' : 'Create member'}
                </HqPrimaryButton>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {/* Role drawer */}
      {roleDrawerOpen ? (
        <div className="fixed inset-0 z-[500]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => !savingRole && setRoleDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingRole ? 'Edit role' : 'Add HQ role'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick HQ module permissions — like Phase 2 roles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleDrawerOpen(false)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Role name *
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={roleForm.roleName}
                  onChange={(e) => setRoleForm((p) => ({ ...p, roleName: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Color
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2"
                  value={roleForm.color}
                  onChange={(e) => setRoleForm((p) => ({ ...p, color: e.target.value }))}
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
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <HqSecondaryButton
                type="button"
                onClick={() => setRoleDrawerOpen(false)}
                disabled={savingRole}
              >
                Cancel
              </HqSecondaryButton>
              <HqPrimaryButton type="button" onClick={() => void saveRole()} loading={savingRole}>
                {editingRole ? 'Save role' : 'Create role'}
              </HqPrimaryButton>
            </div>
          </aside>
        </div>
      ) : null}
    </HqPageMain>
  );
}
