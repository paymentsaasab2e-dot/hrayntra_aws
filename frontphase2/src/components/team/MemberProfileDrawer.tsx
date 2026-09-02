'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, UserMinus, UserPlus, Mail, Phone, MapPin, Key, Lock, Unlock, Clock, History, Trash2, Eye, EyeOff, Copy, User, MessageSquare } from 'lucide-react';
import { DrawerTabBar } from '../drawers/DrawerTabBar';
import { motion, AnimatePresence } from 'motion/react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import { toast } from 'sonner';
import {
  getTeamMemberById,
  deactivateTeamMember,
  activateTeamMember,
  generateCredentials,
  resetPassword,
  setTeamMemberPassword,
  resendInvite,
  lockAccount,
  unlockAccount,
} from '../../lib/api/teamApi';
import { usePermissions } from '../../hooks/usePermissions';
import { apiGetActivityViewableMembers } from '../../lib/api';
import type { TeamMemberDetail, UserActivity, TeamTask } from '../../types/team';
import { LoginHistoryDrawer } from './LoginHistoryDrawer';
import { PortalHost } from './PortalHost';
import { formatDateDMY } from '../../utils/dateDisplay';
import { DrawerEntityChatTab } from '../drawers/DrawerEntityChatTab';
import { EntityWorkspaceAlertsPanel } from '../ai/EntityWorkspaceAlertsPanel';
import { startAsyncLoad } from '../../lib/asyncLoadGuard';

interface MemberProfileDrawerProps {
  isOpen: boolean;
  memberId: string;
  onClose: () => void;
  onEdit?: (member: TeamMemberDetail) => void;
  onDelete?: () => void | Promise<void>;
  initialTempPassword?: string | null;
}

// Color mapping
const roleColorMap: Record<string, string> = {
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-gray-100 text-gray-600',
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
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

export const MemberProfileDrawer: React.FC<MemberProfileDrawerProps> = ({
  isOpen,
  memberId,
  onClose,
  onEdit,
  onDelete,
  initialTempPassword = null,
}) => {
  const [member, setMember] = useState<TeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [sessionTempPassword, setSessionTempPassword] = useState(initialTempPassword || '');
  const [showTempPassword, setShowTempPassword] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [customPasswordConfirm, setCustomPasswordConfirm] = useState('');
  const [settingCustomPassword, setSettingCustomPassword] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'chat'>('profile');

  const { isSuperAdmin, hasAnyPermission } = usePermissions();
  const userIsSuperAdmin = isSuperAdmin();
  const [canViewMemberActivity, setCanViewMemberActivity] = useState(false);

  useEffect(() => {
    if (!isOpen || !memberId) {
      setCanViewMemberActivity(false);
      return;
    }
    let cancelled = false;
    const resolveActivityAccess = async () => {
      if (userIsSuperAdmin) {
        if (!cancelled) setCanViewMemberActivity(true);
        return;
      }
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
        const currentUser = raw ? JSON.parse(raw) : null;
        if (currentUser?.id === memberId) {
          if (!cancelled) setCanViewMemberActivity(true);
          return;
        }
      } catch {
        /* ignore */
      }
      if (!hasAnyPermission(['view_team_activity', 'view_team', 'add_team_member', 'edit_team_member'])) {
        if (!cancelled) setCanViewMemberActivity(false);
        return;
      }
      try {
        const res = await apiGetActivityViewableMembers();
        const ids = new Set((res.data?.members || []).map((m) => m.id));
        if (!cancelled) setCanViewMemberActivity(ids.has(memberId));
      } catch {
        if (!cancelled) setCanViewMemberActivity(false);
      }
    };
    void resolveActivityAccess();
    return () => {
      cancelled = true;
    };
  }, [isOpen, memberId, userIsSuperAdmin, hasAnyPermission]);

  useEffect(() => {
    if (!isOpen || !memberId) {
      setLoading(false);
      return;
    }
    setSessionTempPassword(initialTempPassword || '');
    setShowTempPassword(true);
    void loadMember();
  }, [isOpen, memberId, initialTempPassword]);

  const loadMember = async () => {
    const load = startAsyncLoad(setLoading);
    try {
      const res = await getTeamMemberById(memberId);
      if (load.isActive()) setMember(res.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load member details');
    } finally {
      load.finish();
    }
  };

  const handleDeactivate = async () => {
    if (!member) return;
    try {
      await deactivateTeamMember(member.id);
      toast.success('Member deactivated');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate member');
    }
  };

  const handleActivate = async () => {
    if (!member) return;
    try {
      await activateTeamMember(member.id);
      toast.success('Member activated');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate member');
    }
  };

  const handleGenerateCredentials = async () => {
    if (!member) return;
    try {
      const res = await generateCredentials(member.id, { sendInvite: true });
      const payload = res.data?.data || res.data || {};
      if (payload?.tempPassword) {
        setSessionTempPassword(payload.tempPassword);
        setShowTempPassword(true);
      }
      toast.success(`Credentials generated. Login ID: ${payload?.loginId || 'N/A'}`);
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate credentials');
    }
  };

  const handleResetPassword = async () => {
    if (!member) return;
    try {
      const res = await resetPassword(member.id);
      const payload = res.data?.data || res.data || {};
      if (payload?.tempPassword) {
        setSessionTempPassword(payload.tempPassword);
        setShowTempPassword(true);
      }
      toast.success('Password reset email sent');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const handleResendInvite = async () => {
    if (!member) return;
    try {
      await resendInvite(member.id);
      toast.success('Invite email resent');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invite');
    }
  };

  const handleLock = async () => {
    if (!member) return;
    try {
      await lockAccount(member.id);
      toast.success('Account locked');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to lock account');
    }
  };

  const handleUnlock = async () => {
    if (!member) return;
    try {
      await unlockAccount(member.id);
      toast.success('Account unlocked');
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock account');
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /** Only Super Admins may reveal a password that exists in this browser session (after reset / generate / set). */
  const canRevealPassword = userIsSuperAdmin && Boolean(sessionTempPassword);

  return (
    <PortalHost open={isOpen}>
      <>
        <AnimatePresence>
        {isOpen && (
          <>
            <DetailsModalShell
              onBackdropClick={onClose}
              size="lg"
              zIndexClass="z-[70]"
              dialogTitleId="member-profile-modal-title"
            >
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="size-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : !member ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-500">Member not found</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="border-b border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`size-14 rounded-full flex items-center justify-center font-bold text-lg ${roleColorMap[member.role?.color?.toLowerCase() || 'gray'] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {getInitials(member.firstName, member.lastName)}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">
                            {member.firstName} {member.lastName}
                          </h2>
                          {member.designation && (
                            <p className="text-sm text-slate-500">{member.designation}</p>
                          )}
                          {member.department && (
                            <p className="text-sm text-slate-500">{member.department.name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} />
                        <span>{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone size={14} />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.location && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin size={14} />
                          <span>{member.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Reports To */}
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">Reports to:</span>{' '}
                      {member.manager ? `${member.manager.firstName} ${member.manager.lastName}` : '—'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(member)}
                          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Edit size={14} />
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              await onDelete();
                              onClose();
                            } catch (error) {
                              console.error('Error in onDelete handler:', error);
                            }
                          }}
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                      {member.status === 'ACTIVE' ? (
                        <button
                          onClick={handleDeactivate}
                          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <UserMinus size={14} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={handleActivate}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <UserPlus size={14} />
                          Activate
                        </button>
                      )}
                    </div>
                  </div>

                  <DrawerTabBar
                    ariaLabel="Member sections"
                    tabs={[
                      { id: 'profile' as const, label: 'Profile', icon: User },
                      { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
                    ]}
                    activeId={profileTab}
                    onChange={setProfileTab}
                  />

                  {profileTab === 'chat' ? (
                    <div className="flex-1 overflow-y-auto p-6">
                      <DrawerEntityChatTab
                        entityType="USER"
                        entityId={member.id}
                        entityLabel={`${member.firstName} ${member.lastName}`.trim()}
                        isActive={profileTab === 'chat'}
                        isOpen={isOpen}
                      />
                    </div>
                  ) : (
                  <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <EntityWorkspaceAlertsPanel
                      entityType="USER"
                      entityId={member.id}
                      entityLabel={`${member.firstName} ${member.lastName}`.trim()}
                    />
                    {/* Credential Snapshot */}
                    <section>
                      <h3 className="text-sm font-bold text-slate-800 mb-3">Credential Snapshot</h3>
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-500">Member ID</span>
                          <span className="text-sm font-mono text-slate-900 break-all">{member.id}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-500">Login ID</span>
                          <span className="text-sm font-mono text-slate-900 break-all">
                            {member.credential?.loginId || 'Not generated'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-500">Password</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-900 font-mono">
                              {sessionTempPassword
                                ? (showTempPassword ? sessionTempPassword : '••••••••••••')
                                : !member.credential
                                  ? 'Not generated'
                                  : userIsSuperAdmin
                                    ? 'Not retrievable (one-way hash)'
                                    : member.credential.tempPasswordFlag
                                      ? 'Temporary password issued'
                                      : 'Hidden for security'}
                            </span>
                            {sessionTempPassword && canRevealPassword && (
                              <button
                                type="button"
                                onClick={() => setShowTempPassword((prev) => !prev)}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                title={showTempPassword ? 'Hide password' : 'Show password'}
                              >
                                {showTempPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                            {sessionTempPassword && canRevealPassword && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(sessionTempPassword);
                                    toast.success('Password copied');
                                  } catch {
                                    toast.error('Failed to copy password');
                                  }
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                title="Copy password"
                              >
                                <Copy size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-500">Credential Status</span>
                          {!member.credential ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                              No Login
                            </span>
                          ) : member.credential.isLocked ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                              Locked
                            </span>
                          ) : member.credential.tempPasswordFlag ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {userIsSuperAdmin
                            ? 'The current login password cannot be read from the database (it is stored as a secure hash). After you reset credentials, reset password, or set a new password below, the value for this session appears above with show/copy.'
                            : 'Passwords are not stored in plain text. Ask a Super Admin or use Reset Password where available.'}
                        </p>
                        {userIsSuperAdmin && member.credential && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                            <p className="text-xs font-semibold text-blue-900">Super Admin — set login password</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="sm:col-span-1">
                                <label className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">New password</label>
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  value={customPassword}
                                  onChange={(e) => setCustomPassword(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="Min. 8 characters"
                                />
                              </div>
                              <div className="sm:col-span-1">
                                <label className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">Confirm</label>
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  value={customPasswordConfirm}
                                  onChange={(e) => setCustomPasswordConfirm(e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="Repeat password"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={settingCustomPassword}
                              onClick={() => void handleSetCustomPassword()}
                              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {settingCustomPassword ? 'Updating…' : 'Set password'}
                            </button>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Jobs Assigned</div>
                        <div className="text-2xl font-bold text-slate-900">0</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Candidates Submitted</div>
                        <div className="text-2xl font-bold text-slate-900">0</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Interviews</div>
                        <div className="text-2xl font-bold text-slate-900">0</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Placements</div>
                        <div className="text-2xl font-bold text-slate-900">0</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Revenue</div>
                        <div className="text-2xl font-bold text-slate-900">$0</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Conversion Rate</div>
                        <div className="text-2xl font-bold text-slate-900">0%</div>
                      </div>
                    </div>

                    {/* Credential Status */}
                    <section>
                      <h3 className="text-sm font-bold text-slate-800 mb-3">Credential Status</h3>
                      {!member.credential ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
                          <p className="text-sm text-amber-800 mb-3">No login credentials generated yet</p>
                          <button
                            onClick={handleGenerateCredentials}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Generate Credentials
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Login ID</span>
                              <span className="text-sm font-mono font-medium text-slate-900">
                                {member.credential.loginId}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Last Login</span>
                              <span className="text-sm text-slate-900 flex items-center gap-2">
                                <Clock size={14} />
                                {formatRelativeTime(member.credential.lastLoginAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Status</span>
                              {member.credential.isLocked ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  Locked
                                </span>
                              ) : member.credential.tempPasswordFlag ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                  Pending
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  Active
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleResetPassword}
                              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <Key size={14} />
                              Reset Password
                            </button>
                            <button
                              onClick={handleResendInvite}
                              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <Mail size={14} />
                              Resend Invite
                            </button>
                            {member.credential.isLocked ? (
                              <button
                                onClick={handleUnlock}
                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <Unlock size={14} />
                                Unlock
                              </button>
                            ) : (
                              <button
                                onClick={handleLock}
                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <Lock size={14} />
                                Lock
                              </button>
                            )}
                            <button
                              onClick={() => setShowLoginHistory(true)}
                              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <History size={14} />
                              View Login History
                            </button>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Activity Timeline */}
                    {canViewMemberActivity ? (
                    <section>
                      <h3 className="text-sm font-bold text-slate-800 mb-3">Recent Activity</h3>
                      {member.activities && member.activities.length > 0 ? (
                        <div className="space-y-3">
                          {member.activities.slice(0, 10).map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 pl-4 border-l-2 border-slate-200">
                              <div className="size-2 rounded-full bg-blue-600 mt-1.5 -ml-[9px]" />
                              <div className="flex-1">
                                <p className="text-sm text-slate-900">{activity.action}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                                    {activity.module}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatRelativeTime(activity.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No recent activity</p>
                      )}
                    </section>
                    ) : null}

                    {/* Tasks */}
                    <section>
                      <h3 className="text-sm font-bold text-slate-800 mb-3">Tasks</h3>
                      {member.tasks && member.tasks.length > 0 ? (
                        <div className="space-y-2">
                          {member.tasks.map((task) => {
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                            return (
                              <div
                                key={task.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{task.taskTitle}</p>
                                  {task.dueDate && (
                                    <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                      Due: {formatDateDMY(task.dueDate)}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    task.status === 'DONE'
                                      ? 'bg-green-100 text-green-700'
                                      : task.status === 'IN_PROGRESS'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {task.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No tasks assigned</p>
                      )}
                    </section>
                  </div>
                  </>
                  )}
                </>
              )}
            </DetailsModalShell>
          </>
        )}
        </AnimatePresence>

      {/* Login History Drawer */}
      {member && (
        <LoginHistoryDrawer
          isOpen={showLoginHistory}
          memberId={member.id}
          onClose={() => setShowLoginHistory(false)}
        />
      )}
      </>
    </PortalHost>
  );
};
