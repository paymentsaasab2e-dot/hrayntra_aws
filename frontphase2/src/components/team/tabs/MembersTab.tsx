'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MoreVertical, Eye, Edit, Key, Lock, Unlock, Mail, UserMinus, UserPlus, X, Target, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
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
} from '../../../lib/api/teamApi';
import type { TeamMember, Role, Department, UserStatus } from '../../../types/team';
import { AddMemberDrawer } from '../AddMemberDrawer';
import { EditMemberDrawer } from '../EditMemberDrawer';
import { MemberProfileDrawer } from '../MemberProfileDrawer';
import { usePermissions } from '../../../hooks/usePermissions';

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

export const MembersTab: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, rolesRes, deptsRes] = await Promise.all([
        getTeamMembers({
          search: debouncedSearch || undefined,
          departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
          roleName: selectedRole !== 'all' ? selectedRole : undefined,
          status: selectedStatus !== 'all' ? (selectedStatus as UserStatus) : undefined,
        }),
        getRoles(),
        getDepartments(),
      ]);

      setMembers(membersRes.data || []);
      setRoles(rolesRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDepartment, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats
  const stats = useMemo(() => {
    const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
    return {
      total: members.length,
      active: activeCount,
      departments: departments.length,
      roles: roles.length,
    };
  }, [members, departments, roles]);

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
    setShowProfileDrawer(true);
    setMenuOpen(null);
  };

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setShowEditDrawer(true);
    setMenuOpen(null);
  };

  const handleDeactivate = async (member: TeamMember) => {
    try {
      await deactivateTeamMember(member.id);
      toast.success('Member deactivated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate member');
    }
    setMenuOpen(null);
  };

  const handleActivate = async (member: TeamMember) => {
    try {
      await activateTeamMember(member.id);
      toast.success('Member activated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate member');
    }
    setMenuOpen(null);
  };

  const handleGenerateCredentials = async (member: TeamMember) => {
    try {
      const res = await generateCredentials(member.id, { sendInvite: true });
      toast.success(`Credentials generated. Login ID: ${res.data?.loginId || 'N/A'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate credentials');
    }
    setMenuOpen(null);
  };

  const handleResetPassword = async (member: TeamMember) => {
    try {
      await resetPassword(member.id);
      toast.success('Password reset email sent');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
    setMenuOpen(null);
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      await resendInvite(member.id);
      toast.success('Invite email resent');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invite');
    }
    setMenuOpen(null);
  };

  const handleLock = async (member: TeamMember) => {
    try {
      await lockAccount(member.id);
      toast.success('Account locked');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to lock account');
    }
    setMenuOpen(null);
  };

  const handleUnlock = async (member: TeamMember) => {
    try {
      await unlockAccount(member.id);
      toast.success('Account unlocked');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock account');
    }
    setMenuOpen(null);
  };

  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to permanently delete ${member.firstName} ${member.lastName}? This action cannot be undone and will remove all associated data.`)) {
      return;
    }
    try {
      await deleteTeamMember(member.id);
      toast.success('Team member deleted successfully');
      // Remove from local state immediately for instant UI update
      setMembers(prev => prev.filter(m => m.id !== member.id));
      // Also refresh from server to ensure consistency
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team member');
    }
    setMenuOpen(null);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Department */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Role */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="all">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.roleName}>
                {role.roleName}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Total Members</div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Departments</div>
          <div className="text-2xl font-bold text-slate-900">{stats.departments}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500 mb-1">Roles</div>
          <div className="text-2xl font-bold text-slate-900">{stats.roles}</div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-4">No team members found</p>
            <button
              onClick={() => setShowAddDrawer(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Credential</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((member) => {
                  const roleColor = member.role?.color || 'gray';
                  const roleName = member.role?.roleName || 'No Role';
                  
                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-full flex items-center justify-center font-semibold text-sm ${getRoleColorClass(roleColor)}`}>
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
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleColorClass(roleColor)}`}>
                          {roleName}
                        </span>
                      </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {member.department?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="max-w-[200px] truncate" title={member.email}>
                        {member.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        <Target size={12} />
                        {member._count?.assignedLeads || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getCredentialBadge(member)}
                    </td>
                    <td className="px-6 py-4">
                      {member.status === 'ACTIVE' ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(member)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        {hasPermission('edit_team_member') && (
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                            title="More options"
                          >
                            <MoreVertical size={16} />
                          </button>
                          <AnimatePresence>
                            {menuOpen === member.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10 py-1"
                              >
                                {hasPermission('generate_credentials') && (
                                  <>
                                    <button
                                      onClick={() => handleGenerateCredentials(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Key size={14} />
                                      Generate Credentials
                                    </button>
                                    <button
                                      onClick={() => handleResetPassword(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Key size={14} />
                                      Reset Password
                                    </button>
                                    <button
                                      onClick={() => handleResendInvite(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Mail size={14} />
                                      Resend Invite
                                    </button>
                                    <button
                                      onClick={() => member.credential?.isLocked ? handleUnlock(member) : handleLock(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      {member.credential?.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                                      {member.credential?.isLocked ? 'Unlock Account' : 'Lock Account'}
                                    </button>
                                  </>
                                )}
                                {hasPermission('deactivate_team_member') && (
                                  <>
                                    {hasPermission('generate_credentials') && <div className="border-t border-slate-200 my-1" />}
                                    <button
                                      onClick={() => member.status === 'ACTIVE' ? handleDeactivate(member) : handleActivate(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      {member.status === 'ACTIVE' ? <UserMinus size={14} /> : <UserPlus size={14} />}
                                      {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <div className="border-t border-slate-200 my-1" />
                                    <button
                                      onClick={() => handleDelete(member)}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} />
                                      Delete Member
                                    </button>
                                  </>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers */}
      <AddMemberDrawer
        isOpen={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onSuccess={() => {
          setShowAddDrawer(false);
          fetchData();
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
            onSuccess={() => {
              setShowEditDrawer(false);
              setSelectedMember(null);
              fetchData();
            }}
          />

          <MemberProfileDrawer
            isOpen={showProfileDrawer}
            memberId={selectedMember.id}
            onClose={() => {
              setShowProfileDrawer(false);
              setSelectedMember(null);
            }}
            onEdit={() => {
              setShowProfileDrawer(false);
              setShowEditDrawer(true);
            }}
            onDelete={async () => {
              if (!confirm(`Are you sure you want to permanently delete ${selectedMember.firstName} ${selectedMember.lastName}? This action cannot be undone and will remove all associated data.`)) {
                return;
              }
              try {
                await deleteTeamMember(selectedMember.id);
                toast.success('Team member deleted successfully');
                // Remove from local state immediately
                setMembers(prev => prev.filter(m => m.id !== selectedMember.id));
                setShowProfileDrawer(false);
                setSelectedMember(null);
                // Also refresh from server
                fetchData();
              } catch (error: any) {
                toast.error(error.message || 'Failed to delete team member');
              }
            }}
          />
        </>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
};
