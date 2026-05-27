'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Key, Lock, Unlock, Mail, History, Pencil, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTeamMembers,
  generateCredentials,
  resetPassword,
  resendInvite,
  lockAccount,
  unlockAccount,
} from '../../../lib/api/teamApi';
import { requestConfirm } from '../../../lib/appDialog';
import type { TeamMember } from '../../../types/team';
import { EditMemberDrawer } from '../EditMemberDrawer';
import { LoginHistoryDrawer } from '../LoginHistoryDrawer';
import { GenerateCredentialsDrawer } from '../GenerateCredentialsDrawer';
import PaginationAll from '../../../components/PaginationAll';
import { TABLE_PAGE_SIZE_OPTIONS, type TablePageSize } from '../../../constants/tablePagination';
import { formatDateDMY } from '../../../utils/dateDisplay';

// Color mapping for role colors
const roleColorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-600',
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const getRoleChipClass = (member: TeamMember) => {
  const colorKey = String((member as any)?.role?.color || 'gray').toLowerCase();
  return roleColorMap[colorKey] || 'bg-gray-100 text-gray-600';
};

const getRoleLabel = (member: TeamMember) => {
  return (member as any)?.role?.roleName || 'Unassigned';
};

const getAccountStatus = (member: TeamMember) => {
  const backendStatus = String(member.status || '').trim().toUpperCase();

  if (backendStatus === 'INACTIVE') {
    return {
      label: 'Inactive',
      className: 'bg-slate-100 text-slate-600',
    };
  }

  if (!member.credential) {
    return {
      label: 'No Login',
      className: 'bg-slate-100 text-slate-600',
    };
  }

  if (member.credential.isLocked) {
    return {
      label: 'Locked',
      className: 'bg-red-100 text-red-700',
    };
  }

  if (member.credential.tempPasswordFlag) {
    return {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    label: backendStatus === 'ACTIVE' ? 'Active' : backendStatus || 'Active',
    className: 'bg-green-100 text-green-700',
  };
};

const formatRelativeTime = (dateString: string | null | undefined) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateDMY(date);
};

// Check if user is Super Admin
const isSuperAdmin = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return false;
    const user = JSON.parse(currentUser);
    return user?.roleName === 'Super Admin';
  } catch {
    return false;
  }
};

export const CredentialsTab: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [showGenerateDrawer, setShowGenerateDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);

  const userIsSuperAdmin = isSuperAdmin();

  const fetchData = useCallback(async () => {
    if (!userIsSuperAdmin) return;
    
    setLoading(true);
    try {
      const res = await getTeamMembers({ limit: 100 });
      setMembers(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [userIsSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return members.filter((member) => {
      const backendStatus = String(member.status || '').trim().toUpperCase();
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase();
      const roleName = String((member as any)?.role?.roleName || '').toLowerCase();
      const departmentName = String((member as any)?.department?.name || '').toLowerCase();
      const loginId = String(member.credential?.loginId || '').toLowerCase();
      const designation = String(member.designation || '').toLowerCase();
      const location = String(member.location || '').toLowerCase();
      const email = String(member.email || '').toLowerCase();
      const phone = String(member.phone || '').toLowerCase();
      const statusKey = backendStatus === 'INACTIVE'
        ? 'inactive'
        : !member.credential
        ? 'no_credentials'
        : member.credential.isLocked
          ? 'locked'
          : member.credential.tempPasswordFlag
            ? 'pending'
            : 'active';

      if (query) {
        const matchesSearch =
          fullName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          designation.includes(query) ||
          location.includes(query) ||
          roleName.includes(query) ||
          departmentName.includes(query) ||
          loginId.includes(query) ||
          statusKey.includes(query);

        if (!matchesSearch) return false;
      }

      if (statusFilter !== 'all' && statusKey !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [members, searchQuery, statusFilter]);

  const pagedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleBulkGenerate = async () => {
    const membersToGenerate = filteredMembers.filter(
      (m) => selectedMembers.has(m.id) && !m.credential
    );

    if (membersToGenerate.length === 0) {
      toast.error('No members selected without credentials');
      return;
    }

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: membersToGenerate.length });

    for (let i = 0; i < membersToGenerate.length; i++) {
      const member = membersToGenerate[i];
      setBulkProgress({ current: i + 1, total: membersToGenerate.length });
      try {
        await generateCredentials(member.id, { sendInvite: true });
      } catch (error: any) {
        console.error(`Failed to generate credentials for ${member.firstName}:`, error);
      }
    }

    setBulkGenerating(false);
    setSelectedMembers(new Set());
    toast.success(`Generated credentials for ${membersToGenerate.length} member(s)`);
    fetchData();
  };

  const handleResetPassword = async (member: TeamMember) => {
    if (!(await requestConfirm('Are you sure you want to reset the password for this member?'))) return;
    
    try {
      await resetPassword(member.id);
      toast.success('Password reset email sent');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await resendInvite(member.id);
      toast.success('Invite email resent');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invite');
    }
  };

  const handleLock = async (member: TeamMember) => {
    try {
      await lockAccount(member.id);
      toast.success('Account locked');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to lock account');
    }
  };

  const handleUnlock = async (member: TeamMember) => {
    try {
      await unlockAccount(member.id);
      toast.success('Account unlocked');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock account');
    }
  };

  if (!userIsSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200">
        <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Lock className="size-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h3>
        <p className="text-sm text-slate-600 text-center max-w-md">
          Only Super Admins can view login credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
            <option value="no_credentials">No Credentials</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedMembers.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-blue-900">
            {selectedMembers.size} member{selectedMembers.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {bulkGenerating ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating {bulkProgress.current} of {bulkProgress.total}...
              </>
            ) : (
              `Generate Credentials for ${selectedMembers.size} selected`
            )}
          </button>
        </div>
      )}

      {/* Credentials Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500">No members found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers(new Set(filteredMembers.map((m) => m.id)));
                        } else {
                          setSelectedMembers(new Set());
                        }
                      }}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Login ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedMembers);
                          if (e.target.checked) {
                            newSet.add(member.id);
                          } else {
                            newSet.delete(member.id);
                          }
                          setSelectedMembers(newSet);
                        }}
                        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center font-semibold text-sm ${getRoleChipClass(member)}`}>
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {member.firstName} {member.lastName}
                          </div>
                          {member.designation && (
                            <div className="text-xs text-slate-500">{member.designation}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleChipClass(member)}`}>
                        {getRoleLabel(member)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.credential ? (
                        <span className="font-mono text-sm text-slate-900">{member.credential.loginId}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {member.credential ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-600">••••••••••••</span>
                          {member.credential.tempPasswordFlag ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Temp</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Set by user</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatRelativeTime(member.credential?.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const status = getAccountStatus(member);
                        return (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                            {status.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(member);
                            setShowEditDrawer(true);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          title="Edit Member Details"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(member);
                            if (!member.credential) {
                              setShowGenerateDrawer(true);
                            } else {
                              void handleResetPassword(member);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          title="Reset Password"
                        >
                          <Key size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!member.credential?.tempPasswordFlag) return;
                            void handleResendInvite(member);
                          }}
                          disabled={!member.credential?.tempPasswordFlag}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Resend Invite"
                        >
                          <Mail size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!member.credential) return;
                            if (member.credential.isLocked) {
                              void handleUnlock(member);
                            } else {
                              void handleLock(member);
                            }
                          }}
                          disabled={!member.credential}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          title={member.credential?.isLocked ? 'Unlock Account' : 'Lock Account'}
                        >
                          {member.credential?.isLocked ? <Unlock size={15} /> : <Lock size={15} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(member);
                            setShowLoginHistory(true);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          title="Login History"
                        >
                          <History size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <div className="mt-4 w-full">
              <PaginationAll
                initialPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredMembers.length / pageSize))}
                totalCount={filteredMembers.length}
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
          </>
        )}
      </div>

      {/* Drawers */}
      {selectedMember && (
        <>
          <EditMemberDrawer
            isOpen={showEditDrawer}
            member={selectedMember}
            onClose={() => {
              setShowEditDrawer(false);
              setSelectedMember(null);
            }}
            onSuccess={() => {
              setShowEditDrawer(false);
              setSelectedMember(null);
              fetchData();
            }}
          />

          <LoginHistoryDrawer
            isOpen={showLoginHistory}
            memberId={selectedMember.id}
            onClose={() => {
              setShowLoginHistory(false);
              setSelectedMember(null);
            }}
          />

          <GenerateCredentialsDrawer
            isOpen={showGenerateDrawer}
            member={selectedMember}
            onClose={() => {
              setShowGenerateDrawer(false);
              setSelectedMember(null);
            }}
            onSuccess={() => {
              setShowGenerateDrawer(false);
              setSelectedMember(null);
              fetchData();
            }}
          />
        </>
      )}
    </div>
  );
};
