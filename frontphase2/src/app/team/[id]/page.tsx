'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Edit,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Users,
  Calendar,
  DollarSign,
  Target,
  Activity,
  Key,
  Lock,
  Unlock,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { getTeamMemberById, resetPassword, resendInvite, lockAccount, unlockAccount } from '../../../lib/api/teamApi';
import { ImageWithFallback } from '../../../components/ImageWithFallback';
import { ContactTypeBadge } from '../../contacts/ContactTypeBadge';
import { toast } from 'sonner';
import { EditMemberModal } from '../../../components/team/EditMemberModal';
import { GenerateCredentialsModal } from '../../../components/team/GenerateCredentialsModal';
import { LoginHistoryDrawer } from '../../../components/team/LoginHistoryDrawer';
import type { TeamMemberDetail } from '../../../types/team';

export default function TeamMemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<TeamMemberDetail | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [loginHistoryOpen, setLoginHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tasks' | 'targets'>('overview');

  useEffect(() => {
    if (memberId) {
      loadMember();
    }
  }, [memberId]);

  const loadMember = async () => {
    setLoading(true);
    try {
      const response = await getTeamMemberById(memberId);
      setMember(response.data as any);
    } catch (error) {
      console.error('Failed to load member:', error);
      toast.error('Failed to load team member');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!member) return;
    try {
      switch (action) {
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
          loadMember();
          break;
        case 'unlock':
          await unlockAccount(member.id);
          toast.success('Account unlocked');
          loadMember();
          break;
      }
    } catch (error: any) {
      toast.error(error?.message || 'Action failed');
    }
  };

  const getInitials = (member: TeamMemberDetail) => {
    const first = member.firstName?.[0] || member.email[0];
    const last = member.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Team member not found</p>
          <button
            onClick={() => router.push('/team')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/team')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            ← Back to Team
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="size-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
                {getInitials(member)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {member.firstName} {member.lastName}
                </h1>
                <p className="text-slate-600 mt-1">{member.designation || 'Team Member'}</p>
                <div className="flex items-center gap-4 mt-2">
                  {member.department && (
                    <span className="text-sm text-slate-500">{member.department.name}</span>
                  )}
                  {member.role && (
                    <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                      {member.role.roleName}
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      member.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditModalOpen(true)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit className="size-4" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Metrics */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{member.assignedJobs || 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Jobs Assigned</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">{member.placements || 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Placements Made</p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-900">
                    ${(member.revenueGenerated || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Revenue Generated</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 flex gap-4 px-6">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'activity', label: 'Activity' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'targets', label: 'Targets' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Contact Information</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="size-4" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="size-4" />
                            {member.phone}
                          </div>
                        )}
                        {member.location && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="size-4" />
                            {member.location}
                          </div>
                        )}
                      </div>
                    </div>
                    {member.manager && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Reports To</h3>
                        <p className="text-sm text-slate-600">{member.manager.name}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-3">
                    {member.activities && member.activities.length > 0 ? (
                      member.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                              <p className="text-xs text-slate-500 mt-1">{activity.module}</p>
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(activity.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-8">No activity found</p>
                    )}
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {member.tasks && member.tasks.length > 0 ? (
                      member.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{task.taskTitle}</p>
                              {task.description && (
                                <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                task.status === 'DONE'
                                  ? 'bg-green-100 text-green-700'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-8">No tasks found</p>
                    )}
                  </div>
                )}

                {activeTab === 'targets' && (
                  <div className="space-y-3">
                    {member.targets && member.targets.length > 0 ? (
                      member.targets.map((target) => (
                        <div
                          key={target.id}
                          className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{target.targetType}</p>
                              <p className="text-xs text-slate-500 mt-1">Period: {target.period}</p>
                            </div>
                            <p className="text-lg font-bold text-slate-900">{target.targetValue}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-8">No targets found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Credential Status Panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Credential Status</h3>
              {!member.credential ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-4">No login credentials generated yet</p>
                  <button
                    onClick={() => setCredentialsModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 mx-auto"
                  >
                    <Key className="size-4" />
                    Generate Credentials
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Login ID</label>
                    <p className="text-sm font-mono text-slate-900 mt-1 bg-slate-50 p-2 rounded">
                      {member.credential.loginId}
                    </p>
                  </div>
                  {member.credential.lastLoginAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Last Login</label>
                      <p className="text-sm text-slate-600 mt-1">
                        {new Date(member.credential.lastLoginAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        member.credential.tempPasswordFlag
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {member.credential.tempPasswordFlag ? 'Temporary' : 'Active'}
                    </span>
                    {member.credential.isLocked && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                        Locked
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAction('reset-password')}
                      className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                      <Key className="size-4" />
                      Reset Password
                    </button>
                    <button
                      onClick={() => handleAction('resend-invite')}
                      className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                      <Mail className="size-4" />
                      Resend Invite
                    </button>
                    <button
                      onClick={() => setLoginHistoryOpen(true)}
                      className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                      <Eye className="size-4" />
                      View Login History
                    </button>
                    {member.credential.isLocked ? (
                      <button
                        onClick={() => handleAction('unlock')}
                        className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-200 flex items-center justify-center gap-2"
                      >
                        <Unlock className="size-4" />
                        Unlock Account
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction('lock')}
                        className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 flex items-center justify-center gap-2"
                      >
                        <Lock className="size-4" />
                        Lock Account
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditMemberModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        member={member}
        onSuccess={loadMember}
      />
      <GenerateCredentialsModal
        isOpen={credentialsModalOpen}
        onClose={() => setCredentialsModalOpen(false)}
        memberId={member.id}
        onSuccess={loadMember}
      />
      <LoginHistoryDrawer
        isOpen={loginHistoryOpen}
        onClose={() => setLoginHistoryOpen(false)}
        memberId={member.id}
      />
    </div>
  );
}
