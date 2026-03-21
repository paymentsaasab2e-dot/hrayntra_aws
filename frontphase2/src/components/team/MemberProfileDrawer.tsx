'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, UserMinus, UserPlus, Mail, Phone, MapPin, Key, Lock, Unlock, Clock, History, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  getTeamMemberById,
  deactivateTeamMember,
  activateTeamMember,
  generateCredentials,
  resetPassword,
  resendInvite,
  lockAccount,
  unlockAccount,
} from '../../lib/api/teamApi';
import type { TeamMemberDetail, UserActivity, TeamTask } from '../../types/team';
import { LoginHistoryDrawer } from './LoginHistoryDrawer';

interface MemberProfileDrawerProps {
  isOpen: boolean;
  memberId: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void | Promise<void>;
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
  return date.toLocaleDateString();
};

export const MemberProfileDrawer: React.FC<MemberProfileDrawerProps> = ({
  isOpen,
  memberId,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [member, setMember] = useState<TeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  useEffect(() => {
    if (isOpen && memberId) {
      loadMember();
    }
  }, [isOpen, memberId]);

  const loadMember = async () => {
    setLoading(true);
    try {
      const res = await getTeamMemberById(memberId);
      setMember(res.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load member details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!member) return;
    try {
      await deactivateTeamMember(member.id);
      toast.success('Member deactivated');
      loadMember();
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
      toast.success(`Credentials generated. Login ID: ${res.data?.loginId || 'N/A'}`);
      loadMember();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate credentials');
    }
  };

  const handleResetPassword = async () => {
    if (!member) return;
    try {
      await resetPassword(member.id);
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

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed right-0 top-0 h-full max-w-2xl w-full bg-white shadow-2xl z-[70] flex flex-col"
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
                      <button
                        onClick={onEdit}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              await onDelete();
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

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                                      Due: {new Date(task.dueDate).toLocaleDateString()}
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
            </motion.div>
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
  );
};
