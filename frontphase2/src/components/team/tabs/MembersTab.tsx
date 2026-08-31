'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../../constants/tableUi';
import {
  Search,
  Edit,
  Key,
  Target,
  Users,
  Building2,
  XCircle,
  LogIn,
} from 'lucide-react';
import { downloadCsv } from '../../../utils/csv';
import { ExportColumnsModal } from '../../export/ExportColumnsModal';
import { buildTeamCsvColumns, TEAM_EXPORT_COLUMNS } from '../../../lib/export/teamExportColumns';
import { TableColumnsMenu } from '../../table/TableColumnsMenu';
import { usePersistedColumnVisibility } from '../../../hooks/usePersistedColumnVisibility';
import { TEAM_TABLE_COLUMNS } from '../../../lib/tableColumns/moduleTableColumns';
import { toast } from 'sonner';
import useSWR from 'swr';
import {
  getTeamMembers,
  getRoles,
  getDepartments,
  deactivateTeamMember,
  deleteTeamMember,
  activateTeamMember,
  generateCredentials,
  resetPassword,
  resendInvite,
  lockAccount,
  unlockAccount,
  impersonateTeamMember,
} from '../../../lib/api/teamApi';
import type { TeamMember, Role, Department, UserStatus } from '../../../types/team';
import { AddMemberDrawer } from '../AddMemberDrawer';
import { EditMemberDrawer } from '../EditMemberDrawer';
import { MemberProfileDrawer } from '../MemberProfileDrawer';
import { TeamMemberRowActionsMenu } from '../TeamMemberRowActionsMenu';
import { usePermissions } from '../../../hooks/usePermissions';
import { useUser } from '../../../hooks/useUser';
import { enterTenantImpersonation, getTenantImpersonationMeta } from '../../../lib/sessionAuth';
import { useWorkspaceEntityAlerts } from '../../../hooks/useWorkspaceEntityAlerts';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from '../../ai/WorkspaceAlertTableCell';
import { requestConfirm } from '../../../lib/appDialog';
import PaginationAll from '../../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../../constants/tablePagination';
import {
  PH2_TABLE_CARD_CLASS,
  PH2_TOOLBAR_ROW_CLASS,
  PH2_TOOLBAR_SELECT_CLASS,
  PH2_TABLE_CARD_FOOTER_CLASS,
} from '../../../components/layout/Ph2ModulePageLayout';
import { SummaryCard, SummaryCardSkeleton, type SummaryCardColor } from '../../../components/ui/SummaryCard';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { formatDateDMY } from '../../../utils/dateDisplay';

// Color mapping for role colors
const roleColorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-gray-100 text-gray-600',
};

const TEAM_TABLE_HEAD_ROW =
  'bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]';

const TEAM_TH = 'px-3 py-2.5 text-left first:pl-4 sm:px-4 sm:first:pl-6 sm:py-3';

const TEAM_TR =
  'transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45';

function formatDepartmentRankLabel(rank: number | null | undefined) {
  if (rank == null || Number.isNaN(rank)) return null;
  return rank === 1 ? 'Rank 1 · Head' : `Rank ${rank}`;
}

function getDepartmentRankBadgeClass(rank: number | null | undefined) {
  if (rank === 1) return 'bg-violet-100 text-violet-800 ring-violet-200/80';
  if (rank === 2) return 'bg-sky-100 text-sky-800 ring-sky-200/80';
  if (rank != null) return 'bg-slate-100 text-slate-700 ring-slate-200/80';
  return 'bg-slate-50 text-slate-400 ring-slate-200/60';
}

const TEAM_SEARCH_INPUT_CLASS =
  'h-9 w-full rounded-xl border border-indigo-100/90 bg-white/95 pl-10 pr-3 text-xs text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition-all focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/** Live counts + actions surfaced in `/team` header (Leads-style top bar). */
export type TeamMembersHeaderExtras = {
  pageCount: number;
  total: number;
  isLoading: boolean;
  onRefresh: () => void;
  onExport: () => void;
};

type MembersTabProps = {
  onHeaderExtrasChange?: (extras: TeamMembersHeaderExtras | null) => void;
};

export const MembersTab: React.FC<MembersTabProps> = ({ onHeaderExtrasChange }) => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { user } = useUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // UI state
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedMemberTempPassword, setSelectedMemberTempPassword] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);
  const [totalMembers, setTotalMembers] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [openActionsMenuMemberId, setOpenActionsMenuMemberId] = useState<string | null>(null);
  const teamColumnVisibility = usePersistedColumnVisibility(
    'team.visibleColumns',
    TEAM_TABLE_COLUMNS,
  );

  const debouncedSearch = useDebounce(searchQuery, 300);

  const swrKey = useMemo(
    () => [
      'team:members',
      debouncedSearch,
      selectedDepartment,
      selectedRole,
      selectedStatus,
      currentPage,
      pageSize,
    ],
    [debouncedSearch, selectedDepartment, selectedRole, selectedStatus, currentPage, pageSize]
  );

  const fetchData = useCallback(async () => {
    const [membersRes, rolesRes, deptsRes] = await Promise.all([
      getTeamMembers({
        search: debouncedSearch || undefined,
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        roleName: selectedRole !== 'all' ? selectedRole : undefined,
        status: selectedStatus !== 'all' ? (selectedStatus as UserStatus) : undefined,
        page: currentPage,
        limit: pageSize,
      }),
      getRoles(),
      getDepartments(),
    ]);

    return {
      members: membersRes.data || [],
      pagination: membersRes.pagination || null,
      roles: rolesRes.data || [],
      departments: deptsRes.data || [],
    };
  }, [debouncedSearch, selectedDepartment, selectedRole, selectedStatus, currentPage]);

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetchData, {
    revalidateOnFocus: true,
    refreshInterval: 45_000,
    refreshWhenHidden: false,
    dedupingInterval: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    setMembers(data.members || []);
    setRoles(data.roles || []);
    setDepartments(data.departments || []);
    setTotalMembers(data.pagination?.total || data.members?.length || 0);
  }, [data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedDepartment, selectedRole, selectedStatus]);

  useEffect(() => {
    if (!error) return;
    toast.error((error as any)?.message || 'Failed to load team members');
  }, [error]);

  // Stats
  const stats = useMemo(() => {
    return {
      departments: departments.length,
      roles: roles.length,
    };
  }, [departments, roles]);

  const { alertsByEntityId: workspaceAlertsByEntityId, showAlertColumn: showMemberAiAlertColumn } =
    useWorkspaceEntityAlerts('USER', members.map((member) => member.id));

  const memberMatchesFilters = useCallback(
    (member: TeamMember) => {
      const query = debouncedSearch.trim().toLowerCase();
      if (query) {
        const haystack = [
          member.firstName,
          member.lastName,
          member.email,
          member.designation,
          member.location,
          member.role?.roleName,
          member.department?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (selectedDepartment !== 'all' && member.department?.id !== selectedDepartment) return false;
      if (selectedRole !== 'all' && member.role?.roleName !== selectedRole) return false;
      if (selectedStatus !== 'all' && member.status !== selectedStatus) return false;

      return true;
    },
    [debouncedSearch, selectedDepartment, selectedRole, selectedStatus]
  );

  const upsertMemberLocal = useCallback((member: TeamMember) => {
    setMembers((prev) => {
      const matches = memberMatchesFilters(member);
      const exists = prev.some((item) => item.id === member.id);

      if (!matches) {
        return prev.filter((item) => item.id !== member.id);
      }

      if (exists) {
        return prev.map((item) => (item.id === member.id ? member : item));
      }

      return [member, ...prev];
    });
  }, [memberMatchesFilters]);

  const removeMemberLocal = useCallback((memberId: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
  }, []);

  useEffect(() => {
    const handleMemberCreated = (event: Event) => {
      const customEvent = event as CustomEvent<TeamMember | undefined>;
      if (!customEvent.detail) return;
      upsertMemberLocal(customEvent.detail);
      mutate();
    };

    window.addEventListener('team:member-created', handleMemberCreated as EventListener);
    return () => window.removeEventListener('team:member-created', handleMemberCreated as EventListener);
  }, [mutate, upsertMemberLocal]);

  // Get initials
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Get role color class
  const getRoleColorClass = (color: string) => {
    return roleColorMap[color.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  // Get credential status badge
  const getCredentialBadge = (member: TeamMember) => {
    if (!member.credential) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">No login</span>;
    }
    if (member.credential.isLocked) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Locked</span>;
    }
    if (member.credential.tempPasswordFlag) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Pending</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>;
  };

  // Action handlers
  const handleView = (member: TeamMember) => {
    setSelectedMember(member);
    setSelectedMemberTempPassword(null);
    setShowProfileDrawer(true);
  };

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setShowEditDrawer(true);
  };

  const canOpenMemberAccount = (member: TeamMember) => {
    if (!isSuperAdmin()) return false;
    if (getTenantImpersonationMeta()) return false;
    if (!user?.id || member.id === user.id) return false;
    if (member.status !== 'ACTIVE') return false;
    return true;
  };

  const handleOpenAccount = async (member: TeamMember) => {
    const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
    const confirmed = await requestConfirm(
      `Open ${name}'s account? They will stay signed in. You can return to your Super Admin account anytime.`,
      { confirmLabel: 'Open account', cancelLabel: 'Cancel' },
    );
    if (!confirmed) return;
    try {
      const res = await impersonateTeamMember(member.id);
      const data = res.data;
      if (!data?.accessToken) {
        throw new Error('Could not open this account');
      }
      enterTenantImpersonation({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantDbName: data.tenantDbName,
        user: data.user,
        permissions: data.permissions,
        impersonation: {
          memberId: data.impersonation.memberId,
          memberName: data.impersonation.memberName,
          memberEmail: data.impersonation.memberEmail,
          actorName: data.impersonation.actorName,
        },
      });
      window.location.href = '/dashboard';
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to open account');
    }
  };

  const handleDeactivate = async (member: TeamMember) => {
    try {
      await deactivateTeamMember(member.id);
      toast.success('Member deactivated');
      upsertMemberLocal({ ...member, status: 'INACTIVE' });
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate member');
    }
  };

  const handleActivate = async (member: TeamMember) => {
    try {
      await activateTeamMember(member.id);
      toast.success('Member activated');
      upsertMemberLocal({ ...member, status: 'ACTIVE' });
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate member');
    }
  };

  const handleGenerateCredentials = async (member: TeamMember) => {
    try {
      const res = await generateCredentials(member.id, { sendInvite: true });
      toast.success(`Credentials generated. Login ID: ${res.data?.loginId || 'N/A'}`);
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate credentials');
    }
  };

  const handleResetPassword = async (member: TeamMember) => {
    try {
      await resetPassword(member.id);
      toast.success('Password reset email sent');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await resendInvite(member.id);
      toast.success('Invite email resent');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invite');
    }
  };

  const handleLock = async (member: TeamMember) => {
    try {
      await lockAccount(member.id);
      toast.success('Account locked');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to lock account');
    }
  };

  const handleUnlock = async (member: TeamMember) => {
    try {
      await unlockAccount(member.id);
      toast.success('Account unlocked');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock account');
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (!(await requestConfirm(`Are you sure you want to permanently delete ${member.firstName} ${member.lastName}? This action cannot be undone and will remove all associated data.`))) {
      return;
    }
    try {
      await deleteTeamMember(member.id);
      toast.success('Team member deleted successfully');
      removeMemberLocal(member.id);
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team member');
    }
  };

  const openExportModal = useCallback(() => {
    setExportModalOpen(true);
    if (members.length === 0) {
      toast.message('No team members to export with the current filters.');
    }
  }, [members.length]);

  const handleExportMembersCsv = useCallback(
    (selectedColumnIds: string[]) => {
      const columns = buildTeamCsvColumns(selectedColumnIds);
      if (columns.length === 0) {
        toast.message('Select at least one column to export.');
        return;
      }
      if (members.length === 0) {
        toast.message('No team members to export with the current filters.');
        return;
      }
      downloadCsv<TeamMember>(
        `team-members-${new Date().toISOString().slice(0, 10)}.csv`,
        columns,
        members,
      );
      toast.success(`Exported ${members.length} team member${members.length === 1 ? '' : 's'} to CSV`);
    },
    [members],
  );

  useEffect(() => {
    if (!onHeaderExtrasChange) return;
    onHeaderExtrasChange({
      pageCount: members.length,
      total: totalMembers,
      isLoading,
      onRefresh: () => {
        void mutate();
      },
      onExport: openExportModal,
    });
    return () => {
      onHeaderExtrasChange(null);
    };
  }, [
    onHeaderExtrasChange,
    members.length,
    totalMembers,
    isLoading,
    mutate,
    openExportModal,
  ]);

  const hasToolbarFilters =
    Boolean(searchQuery.trim()) ||
    selectedDepartment !== 'all' ||
    selectedRole !== 'all' ||
    selectedStatus !== 'all';

  const clearToolbarFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('all');
    setSelectedRole('all');
    setSelectedStatus('all');
  };

  const activeOnPage = useMemo(() => members.filter((m) => m.status === 'ACTIVE').length, [members]);

  return (
    <div className="space-y-6">
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {isLoading && members.length === 0 ? (
          (['blue', 'green', 'indigo', 'purple'] as SummaryCardColor[]).map((c, i) => <SummaryCardSkeleton key={i} color={c} />)
        ) : (
          <>
            <SummaryCard
              label="Total members"
              count={totalMembers}
              color="blue"
              icon={<Users size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Active on page"
              count={activeOnPage}
              color="green"
              icon={<Target size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Departments"
              count={stats.departments}
              color="indigo"
              icon={<Building2 size={16} strokeWidth={2.35} />}
            />
            <SummaryCard
              label="Role types"
              count={stats.roles}
              color="purple"
              icon={<Key size={16} strokeWidth={2.35} />}
            />
          </>
        )}
      </div>

      <div className={PH2_TABLE_CARD_CLASS}>
        <div className={PH2_TOOLBAR_ROW_CLASS}>
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md lg:flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400"
                strokeWidth={2.25}
              />
              <input
                type="text"
                placeholder="Search name, email, or title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={TEAM_SEARCH_INPUT_CLASS}
                aria-label="Search team members"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
              <TableColumnsMenu
                columns={TEAM_TABLE_COLUMNS}
                isVisible={teamColumnVisibility.isVisible}
                onToggle={teamColumnVisibility.toggle}
                onReset={teamColumnVisibility.resetToDefault}
                unlockedVisibleCount={teamColumnVisibility.unlockedVisibleCount}
              />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className={PH2_TOOLBAR_SELECT_CLASS}
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className={PH2_TOOLBAR_SELECT_CLASS}
              >
                <option value="all">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.roleName}>
                    {role.roleName}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={PH2_TOOLBAR_SELECT_CLASS}
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              {hasToolbarFilters ? (
                <button
                  type="button"
                  onClick={clearToolbarFilters}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                >
                  <XCircle size={15} className="shrink-0 text-rose-500" strokeWidth={2.35} />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="no-scrollbar overflow-x-auto">
            {isLoading && members.length === 0 ? (
              <TableSkeleton rows={8} columns={9} className="border-0 shadow-none rounded-none" />
            ) : members.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-slate-500">No team members found</p>
                <p className="mt-1 text-xs text-slate-400">Try adjusting search or filters.</p>
              </div>
            ) : (
              (() => {
                const show = teamColumnVisibility.isVisible;
                return (
              <table className="w-full min-w-[1160px] text-left">
                <thead>
                  <tr className={TEAM_TABLE_HEAD_ROW}>
                    <th className={TEAM_TH}>Member</th>
                    {show('role') ? <th className={TEAM_TH}>Role</th> : null}
                    {show('department') ? <th className={TEAM_TH}>Department</th> : null}
                    {show('rank') ? <th className={TEAM_TH}>Rank</th> : null}
                    {show('email') ? <th className={TEAM_TH}>Email</th> : null}
                    {show('assignedLeads') ? <th className={TEAM_TH}>Assigned leads</th> : null}
                    {show('credential') ? <th className={TEAM_TH}>Credential</th> : null}
                    {show('status') ? <th className={TEAM_TH}>Status</th> : null}
                    {show('phone') ? <th className={TEAM_TH}>Phone</th> : null}
                    {show('location') ? <th className={TEAM_TH}>Location</th> : null}
                    {show('designation') ? <th className={TEAM_TH}>Designation</th> : null}
                    {show('manager') ? <th className={TEAM_TH}>Manager</th> : null}
                    {show('tasks') ? <th className={TEAM_TH}>Tasks</th> : null}
                    {show('lastLogin') ? <th className={TEAM_TH}>Last login</th> : null}
                    {show('createdAt') ? <th className={TEAM_TH}>Created</th> : null}
                    {showMemberAiAlertColumn ? <WorkspaceAlertTableHeader className={TEAM_TH} /> : null}
                    <th className={`${TEAM_TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {members.map((member) => {
                    const roleColor = member.role?.color || 'gray';
                    const roleName = member.role?.roleName || 'No Role';

                    return (
                      <tr key={member.id} className={TEAM_TR}>
                        <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getRoleColorClass(roleColor)}`}
                            >
                              {getInitials(member.firstName, member.lastName)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-900">
                                {member.firstName} {member.lastName}
                              </div>
                              {member.designation ? (
                                <div className="text-[10px] text-slate-500">{member.designation}</div>
                              ) : null}
                              {member.orgUnit ? (
                                <div className="mt-0.5 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {member.orgUnit.name}
                                  <span className="ml-1 text-slate-400">
                                    {member.orgUnit.kind === 'branch' ? 'branch' : 'company'}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        {show('role') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getRoleColorClass(roleColor)}`}
                            >
                              {roleName}
                            </span>
                          </td>
                        ) : null}
                        {show('department') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.department?.name || '—'}
                          </td>
                        ) : null}
                        {show('rank') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            {formatDepartmentRankLabel(member.departmentRank) ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${getDepartmentRankBadgeClass(member.departmentRank)}`}
                              >
                                {formatDepartmentRankLabel(member.departmentRank)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        ) : null}
                        {show('email') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            <div className="max-w-[200px] truncate" title={member.email}>
                              {member.email}
                            </div>
                          </td>
                        ) : null}
                        {show('assignedLeads') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800 ring-1 ring-indigo-100/80">
                              <Target size={12} />
                              {member._count?.assignedLeads || 0}
                            </span>
                          </td>
                        ) : null}
                        {show('credential') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">{getCredentialBadge(member)}</td>
                        ) : null}
                        {show('status') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            {member.status === 'ACTIVE' ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100/80">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                                Inactive
                              </span>
                            )}
                          </td>
                        ) : null}
                        {show('phone') ? (
                          <td className="px-3 py-3 text-xs tabular-nums text-slate-600 sm:px-4 sm:py-3.5">
                            {member.phone || '—'}
                          </td>
                        ) : null}
                        {show('location') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.location || '—'}
                          </td>
                        ) : null}
                        {show('designation') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.designation || '—'}
                          </td>
                        ) : null}
                        {show('manager') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.manager
                              ? `${member.manager.firstName || ''} ${member.manager.lastName || ''}`.trim() || '—'
                              : '—'}
                          </td>
                        ) : null}
                        {show('tasks') ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                              {member._count?.tasks ?? 0}
                            </span>
                          </td>
                        ) : null}
                        {show('lastLogin') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.credential?.lastLoginAt
                              ? formatDateDMY(member.credential.lastLoginAt)
                              : '—'}
                          </td>
                        ) : null}
                        {show('createdAt') ? (
                          <td className="px-3 py-3 text-xs text-slate-600 sm:px-4 sm:py-3.5">
                            {member.createdAt ? formatDateDMY(member.createdAt) : '—'}
                          </td>
                        ) : null}
                        {showMemberAiAlertColumn ? (
                          <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                            <WorkspaceAlertTableCell alerts={workspaceAlertsByEntityId?.[member.id]} />
                          </td>
                        ) : null}
                        <td className="px-3 py-3 text-right sm:px-4 sm:py-3.5">
                          <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                            {SHOW_TABLE_ROW_EDIT_ICON && hasPermission('edit_team_member') ? (
                              <button
                                type="button"
                                onClick={() => handleEdit(member)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 transition-all hover:bg-white hover:text-amber-800 hover:shadow-sm"
                                title="Edit"
                              >
                                <Edit size={16} strokeWidth={2.25} />
                              </button>
                            ) : null}
                            {canOpenMemberAccount(member) ? (
                              <button
                                type="button"
                                onClick={() => void handleOpenAccount(member)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-indigo-600 transition-all hover:bg-white hover:text-indigo-800 hover:shadow-sm"
                                title="Open account"
                              >
                                <LogIn size={16} strokeWidth={2.25} />
                              </button>
                            ) : null}
                            <TeamMemberRowActionsMenu
                              member={member}
                              open={openActionsMenuMemberId === member.id}
                              onOpenChange={(isOpen) =>
                                setOpenActionsMenuMemberId(isOpen ? member.id : null)
                              }
                              canGenerateCredentials={hasPermission('generate_credentials')}
                              canDeactivate={hasPermission('deactivate_team_member')}
                              canOpenAccount={canOpenMemberAccount(member)}
                              onOpenAccount={(m) => void handleOpenAccount(m)}
                              onGenerateCredentials={handleGenerateCredentials}
                              onResetPassword={handleResetPassword}
                              onResendInvite={handleResendInvite}
                              onLockToggle={(m) =>
                                m.credential?.isLocked ? void handleUnlock(m) : void handleLock(m)
                              }
                              onActivateDeactivate={(m) =>
                                m.status === 'ACTIVE' ? void handleDeactivate(m) : void handleActivate(m)
                              }
                              onDelete={handleDelete}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                );
              })()
            )}
          </div>
        </div>

        {!isLoading && members.length > 0 ? (
          <div className={PH2_TABLE_CARD_FOOTER_CLASS}>
            <PaginationAll
              initialPage={currentPage}
              totalPages={Math.max(1, Math.ceil(totalMembers / pageSize))}
              totalCount={totalMembers}
              pageSize={pageSize}
              pageSizeOptions={[...TABLE_PAGE_SIZE_OPTIONS]}
              onPageSizeChange={(n) => {
                if (!(TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return;
                setPageSize(n as TablePageSize);
                setCurrentPage(1);
              }}
              itemLabel="members"
              onPageChange={setCurrentPage}
            />
          </div>
        ) : null}
      </div>

      {/* Drawers */}
      <AddMemberDrawer
        isOpen={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onSuccess={(createdMember) => {
          setShowAddDrawer(false);
          if (createdMember) {
            upsertMemberLocal(createdMember);
            setSelectedMember(createdMember);
            setSelectedMemberTempPassword(createdMember.credentialData?.tempPassword || null);
            setShowProfileDrawer(true);
          }
          mutate();
        }}
      />

      {selectedMember && (
        <>
          <EditMemberDrawer
            isOpen={showEditDrawer}
            member={selectedMember}
            onClose={() => {
              setShowEditDrawer(false);
              setSelectedMember(null);
            }}
            onSuccess={(updatedMember) => {
              setShowEditDrawer(false);
              if (updatedMember) {
                setSelectedMember(updatedMember);
                upsertMemberLocal(updatedMember);
              }
              if (!updatedMember) {
                setSelectedMember(null);
              }
            }}
          />

          <MemberProfileDrawer
            isOpen={showProfileDrawer}
            memberId={selectedMember.id}
            initialTempPassword={selectedMemberTempPassword}
            onClose={() => {
              setShowProfileDrawer(false);
              setSelectedMember(null);
              setSelectedMemberTempPassword(null);
            }}
            onEdit={(memberData) => {
              setSelectedMember(memberData as TeamMember);
              setShowProfileDrawer(false);
              setShowEditDrawer(true);
            }}
            onDelete={async () => {
              if (!(await requestConfirm(`Are you sure you want to permanently delete ${selectedMember.firstName} ${selectedMember.lastName}? This action cannot be undone and will remove all associated data.`))) {
                return;
              }
              try {
                await deleteTeamMember(selectedMember.id);
                toast.success('Team member deleted successfully');
                removeMemberLocal(selectedMember.id);
                setShowProfileDrawer(false);
                setSelectedMember(null);
                // Also refresh from server
                mutate();
              } catch (error: any) {
                toast.error(error.message || 'Failed to delete team member');
              }
            }}
          />
        </>
      )}

      <ExportColumnsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export team members"
        rowCount={members.length}
        rowLabelSingular="member"
        rowLabelPlural="members"
        columns={TEAM_EXPORT_COLUMNS}
        rows={members}
        getRowKey={(member) => member.id}
        onExport={handleExportMembersCsv}
      />
    </div>
  );
};
