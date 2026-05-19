'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, MoreVertical, Eye, Edit, Key, UserX, Lock, Unlock, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../constants/tableUi';
import { getTeamMembers, deleteTeamMember, lockAccount, unlockAccount, resetPassword, resendInvite } from '../../lib/api/teamApi';
import { ImageWithFallback } from '../ImageWithFallback';
import { toast } from 'sonner';
import { requestConfirm } from '../../lib/appDialog';
import type { TeamMember, TeamMemberFilters, UserStatus } from '../../types/team';
import { EditMemberModal } from './EditMemberModal';
import { GenerateCredentialsModal } from './GenerateCredentialsModal';
import { LoginHistoryDrawer } from './LoginHistoryDrawer';

interface TeamTableProps {
  onSelectMember: (member: TeamMember) => void;
}

export const TeamTable: React.FC<TeamTableProps> = ({ onSelectMember }) => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TeamMemberFilters>({
    page: 1,
    limit: 20,
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [loginHistoryOpen, setLoginHistoryOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTeamMembers({
        ...filters,
        search: searchQuery || undefined,
      });
      const data = response.data;
      setMembers(data?.data || []);
      setTotal(data?.total || 0);
    } catch (error) {
      console.error('Failed to load team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key: keyof TeamMemberFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleAction = async (action: string, member: TeamMember) => {
    setActionMenuOpen(null);
    setActionMenuPos(null);
    try {
      switch (action) {
        case 'edit':
          setSelectedMember(member);
          setEditModalOpen(true);
          break;
        case 'generate-credentials':
          setSelectedMember(member);
          setCredentialsModalOpen(true);
          break;
        case 'reset-password':
          await resetPassword(member.id);
          toast.success('Password reset email sent');
          break;
        case 'resend-invite':
          await resendInvite(member.id);
          toast.success('Invite email sent');
          break;
        case 'lock':
          await lockAccount(member.id);
          toast.success('Account locked');
          loadMembers();
          break;
        case 'unlock':
          await unlockAccount(member.id);
          toast.success('Account unlocked');
          loadMembers();
          break;
        case 'deactivate':
          if (await requestConfirm('Are you sure you want to deactivate this member?')) {
            await deleteTeamMember(member.id);
            toast.success('Member deactivated');
            loadMembers();
          }
          break;
        case 'activate':
          // Would need an activate endpoint or update status
          toast.info('Activate functionality coming soon');
          break;
        case 'login-history':
          setSelectedMember(member);
          setLoginHistoryOpen(true);
          break;
      }
    } catch (error: any) {
      toast.error(error?.message || 'Action failed');
    }
  };

  const openActionMenu = (member: TeamMember, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const menuWidth = 224;
    const estimatedMenuHeight = 360;
    const gap = 8;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal: align the menu's right edge to the trigger's right edge so it
    // doesn't escape to the right; clamp to viewport with a small margin.
    let left = rect.right - menuWidth;
    left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));

    // Vertical: open below the trigger when there is room, otherwise above.
    // Always clamp `top` so the menu can never extend past the viewport
    // (previous logic let the menu overflow past the bottom of the page,
    // making the lower items unreachable in tables near the bottom).
    const spaceBelow = viewportHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const fitsBelow = spaceBelow >= estimatedMenuHeight;
    const fitsAbove = spaceAbove >= estimatedMenuHeight;

    let top: number;
    if (fitsBelow) {
      top = rect.bottom + gap;
    } else if (fitsAbove) {
      top = rect.top - estimatedMenuHeight - gap;
    } else {
      // Doesn't fully fit either side — pick the larger half and clamp.
      top = spaceBelow >= spaceAbove ? rect.bottom + gap : margin;
    }
    top = Math.max(margin, Math.min(top, viewportHeight - estimatedMenuHeight - margin));
    if (top < margin) top = margin;

    setActionMenuOpen(member.id);
    setActionMenuPos({ top, left });
  };

  // Recalculate menu position on resize / scroll while the menu is open so it
  // doesn't drift away from the trigger or escape the viewport.
  useEffect(() => {
    if (!actionMenuOpen) return;
    const reposition = () => {
      const trigger = document.querySelector<HTMLButtonElement>(
        `[data-team-actions-trigger][data-member-id="${CSS.escape(actionMenuOpen)}"]`
      );
      if (!trigger) return;
      const member = members.find((m) => m.id === actionMenuOpen);
      if (!member) return;
      openActionMenu(member, trigger);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionMenuOpen]);

  const getStatusBadge = (status: UserStatus) => {
    if (status === 'ACTIVE') {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          Active
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
        Inactive
      </span>
    );
  };

  const getInitials = (member: TeamMember) => {
    const first = member.firstName?.[0] || member.email[0];
    const last = member.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filters.department || ''}
              onChange={(e) => handleFilterChange('department', e.target.value || undefined)}
              className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition-all"
            >
              <option value="">All Departments</option>
            </select>
            <select
              value={filters.role || ''}
              onChange={(e) => handleFilterChange('role', e.target.value || undefined)}
              className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition-all"
            >
              <option value="">All Roles</option>
            </select>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleFilterChange('status', e.target.value === 'all' ? undefined : e.target.value)}
              className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition-all"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block size-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No team members found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Recruiter</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-center">Jobs</th>
                  <th className="px-6 py-4 text-center">Placements</th>
                  <th className="px-6 py-4 text-center">Revenue</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => onSelectMember(member)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                          {getInitials(member)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {member.firstName} {member.lastName}
                            </p>
                            {member.credential?.isLocked && (
                              <Lock className="size-4 text-red-600" />
                            )}
                            {member.credential?.tempPasswordFlag && (
                              <AlertCircle className="size-4 text-amber-600" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{member.designation || 'Team Member'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.role ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                          {member.role.roleName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No role</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">
                        {member.department?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{member.email}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-slate-700">
                        {member.assignedJobs || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-slate-700">
                        {member.placements || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-slate-700">
                        ${(member.revenueGenerated || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(member.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember(member);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="size-4 text-slate-600" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const target = e.currentTarget as HTMLButtonElement;
                              if (actionMenuOpen === member.id) {
                                setActionMenuOpen(null);
                                setActionMenuPos(null);
                                return;
                              }
                              openActionMenu(member, target);
                            }}
                            type="button"
                            data-team-actions-trigger
                            data-member-id={member.id}
                            aria-haspopup="menu"
                            aria-expanded={actionMenuOpen === member.id}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="size-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing {members.length} of {total} members
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                disabled={filters.page === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {filters.page || 1}
              </span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                disabled={members.length < (filters.limit || 20)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedMember && (
        <>
          <EditMemberModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedMember(null);
            }}
            member={selectedMember}
            onSuccess={loadMembers}
          />
          <GenerateCredentialsModal
            isOpen={credentialsModalOpen}
            onClose={() => {
              setCredentialsModalOpen(false);
              setSelectedMember(null);
            }}
            memberId={selectedMember.id}
            onSuccess={loadMembers}
          />
          <LoginHistoryDrawer
            isOpen={loginHistoryOpen}
            onClose={() => {
              setLoginHistoryOpen(false);
              setSelectedMember(null);
            }}
            memberId={selectedMember.id}
          />
        </>
      )}

      {typeof window !== 'undefined' && actionMenuOpen && actionMenuPos && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setActionMenuOpen(null);
              setActionMenuPos(null);
            }}
          />
          <div
            role="menu"
            className="fixed z-50 w-56 max-h-[calc(100vh-24px)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl py-2"
            style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {SHOW_TABLE_ROW_EDIT_ICON ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('edit', members.find((m) => m.id === actionMenuOpen)!);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit className="size-4" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('generate-credentials', members.find((m) => m.id === actionMenuOpen)!);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Key className="size-4" />
              Generate Credentials
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('reset-password', members.find((m) => m.id === actionMenuOpen)!);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Key className="size-4" />
              Reset Password
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('resend-invite', members.find((m) => m.id === actionMenuOpen)!);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Mail className="size-4" />
              Resend Invite
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('login-history', members.find((m) => m.id === actionMenuOpen)!);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Eye className="size-4" />
              View Login History
            </button>
            {members.find((m) => m.id === actionMenuOpen)?.credential?.isLocked ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('unlock', members.find((m) => m.id === actionMenuOpen)!);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Unlock className="size-4" />
                Unlock Account
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('lock', members.find((m) => m.id === actionMenuOpen)!);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Lock className="size-4" />
                Lock Account
              </button>
            )}
            {members.find((m) => m.id === actionMenuOpen)?.status === 'ACTIVE' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('deactivate', members.find((m) => m.id === actionMenuOpen)!);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <UserX className="size-4" />
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('activate', members.find((m) => m.id === actionMenuOpen)!);
                }}
                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
              >
                <CheckCircle className="size-4" />
                Activate
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
};
