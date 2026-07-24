'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, User, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_FOOTER_CLASS,
  DRAWER_FORM_HEADER_CLASS,
  DRAWER_FORM_INPUT,
  DRAWER_FORM_SCROLL_BG,
} from '../drawers/drawerFormUi';
import {
  updateTeamMember,
  getRoles,
  getDepartments,
  getDepartmentReportingManagers,
  getAllTeamMembersForDirectory,
  deleteTeamMember,
} from '../../lib/api/teamApi';
import { requestConfirm } from '../../lib/appDialog';
import type { TeamMember, Role, UpdateMemberPayload, UserStatus } from '../../types/team';
import {
  filterReportingManagers,
  getRoleRankInDepartment,
  getRolesForDepartment,
  getMemberRoleId,
  pickDefaultManagerId,
  mergeReportingManagerLists,
  mergeRolesWithDepartmentEmbedded,
  type DepartmentWithRoles,
} from '../../lib/teamReporting';
import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
  'mail.com',
  'live.com',
];

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array(n + 1).fill(0).map((_, j) => (j === 0 ? i : 0))
  );

  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[m][n];
}

function validateEmail(email: string) {
  const value = String(email || '').trim();

  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, message: 'Invalid email format' };
  }

  const domain = value.split('@')[1]?.toLowerCase() || '';
  if (!KNOWN_DOMAINS.includes(domain)) {
    let best: string | null = null;
    let bestDist = Infinity;

    for (const known of KNOWN_DOMAINS) {
      const dist = levenshtein(domain, known);
      if (dist < bestDist) {
        bestDist = dist;
        best = known;
      }
    }

    if (bestDist <= 3 && best) {
      return { valid: false, message: `Did you mean @${best}?` };
    }
  }

  return { valid: true, message: 'Valid email' };
}

interface EditMemberDrawerProps {
  isOpen: boolean;
  member: TeamMember;
  onClose: () => void;
  onSuccess: (member?: TeamMember) => void;
}

export const EditMemberDrawer: React.FC<EditMemberDrawerProps> = ({ isOpen, member, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<UpdateMemberPayload>({
    firstName: member.firstName || '',
    lastName: member.lastName || '',
    email: member.email || '',
    phone: member.phone || '',
    designation: member.designation || '',
    location: member.location || '',
    departmentId: member.department?.id || '',
    roleId: member.role?.id || '',
    managerId: member.manager?.id || '',
    status: member.status || 'ACTIVE',
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithRoles[]>([]);
  const [teamDirectory, setTeamDirectory] = useState<TeamMember[]>([]);
  const [reportingManagers, setReportingManagers] = useState<TeamMember[]>([]);
  const [loadingReporting, setLoadingReporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [roleChanged, setRoleChanged] = useState(false);

  // Load options
  useEffect(() => {
    if (isOpen && member) {
      console.log('📋 Loading member data for edit:', {
        member,
        department: member.department,
        role: member.role,
        manager: member.manager,
        location: member.location,
      });
      loadOptions();
      setFormData({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        email: member.email || '',
        phone: member.phone || '',
        designation: member.designation || '',
        location: member.location || '',
        departmentId: member.department?.id || '',
        roleId: getMemberRoleId(member) || '',
        managerId: member.manager?.id || member.managerRelation?.id || '',
        status: member.status || 'ACTIVE',
      });
      setRoleChanged(false);
    }
  }, [isOpen, member]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const [rolesRes, deptsRes] = await Promise.all([getRoles(), getDepartments()]);
      const departmentList = deptsRes.data || [];
      const mergedRoles = mergeRolesWithDepartmentEmbedded(rolesRes.data || [], departmentList);

      setRoles(mergedRoles);
      setDepartments(departmentList);
      setReportingManagers([]);
    } catch (error: any) {
      toast.error('Failed to load options');
    } finally {
      setLoadingOptions(false);
    }
  };

  const availableRoles = useMemo(
    () => getRolesForDepartment(formData.departmentId, departments, roles),
    [formData.departmentId, departments, roles],
  );

  const selectedRole =
    availableRoles.find((r) => String(r.id) === String(formData.roleId)) ||
    roles.find((r) => String(r.id) === String(formData.roleId));

  useEffect(() => {
    if (loadingOptions) return;
    if (!formData.departmentId) {
      setReportingManagers([]);
      return;
    }
    if (
      formData.roleId &&
      availableRoles.length > 0 &&
      !availableRoles.some((r) => String(r.id) === String(formData.roleId))
    ) {
      setFormData((prev) => ({ ...prev, roleId: '', managerId: '' }));
      setReportingManagers([]);
      return;
    }
    if (!formData.roleId) {
      setReportingManagers([]);
      return;
    }

    let cancelled = false;
    const memberRank = selectedRole?.rank ?? null;

    const applyList = (list: TeamMember[], defaultId?: string) => {
      setReportingManagers(list);
      const resolvedDefault = defaultId || pickDefaultManagerId(list, formData.managerId);
      if (resolvedDefault) {
        setFormData((prev) => ({
          ...prev,
          managerId:
            prev.managerId && list.some((m) => m.id === prev.managerId)
              ? prev.managerId
              : resolvedDefault,
        }));
      }
    };

    const clientFallback = async () => {
      let directory = teamDirectory;
      if (!directory.length) {
        directory = await getAllTeamMembersForDirectory();
        if (!cancelled) setTeamDirectory(directory);
      }
      return filterReportingManagers({
        managers: directory,
        departmentId: formData.departmentId,
        roleId: formData.roleId,
        departments,
        excludeMemberId: member.id,
        memberRank,
        departmentRoleOptions: availableRoles,
      });
    };

    setLoadingReporting(true);
    getDepartmentReportingManagers(formData.departmentId, formData.roleId, member.id)
      .then(async (res) => {
        if (cancelled) return;
        const apiList = res.data || [];
        const fallback = await clientFallback();
        const list = mergeReportingManagerLists(apiList, fallback);
        applyList(list, res.defaultManagerId || pickDefaultManagerId(list));
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          applyList(await clientFallback());
        } catch {
          if (!cancelled) setReportingManagers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReporting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    loadingOptions,
    formData.departmentId,
    formData.roleId,
    availableRoles,
    departments,
    teamDirectory,
    member.id,
    selectedRole?.rank,
  ]);

  const handleChange = (field: keyof UpdateMemberPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'roleId') {
      setRoleChanged(value !== (member.role?.id || ''));
    }
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const result = validateEmail(formData.email);
      if (!result.valid) {
        newErrors.email = result.message;
      }
    }
    if (!formData.roleId) newErrors.roleId = 'Role is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Build payload - always include all fields so backend can clear them if needed
      const payload: UpdateMemberPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        status: formData.status,
        phone: formData.phone?.trim() || undefined,
        designation: formData.designation?.trim() || undefined,
        location: formData.location?.trim() || undefined,
        departmentId: formData.departmentId || undefined,
        roleId: formData.roleId || undefined,
        managerId: formData.managerId || undefined,
      };

      console.log('📝 Updating team member:', member.id, payload);
      const result = await updateTeamMember(member.id, payload);
      console.log('✅ Update result:', result);
      toast.success('Team member updated successfully');
      onSuccess((result as any)?.data || member);
      markClean();
      handleClose();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update team member';
      if (errorMessage.toLowerCase().includes('email')) {
        setErrors({ email: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setRoleChanged(false);
    onClose();
  };

  const { panelRef, requestClose, markClean } = useDrawerUnsavedGuard<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
  });

  const handleDelete = async () => {
    if (!(await requestConfirm(`Are you sure you want to permanently delete ${member.firstName} ${member.lastName}? This action cannot be undone and will remove all associated data.`))) {
      return;
    }
    try {
      setIsSubmitting(true);
      await deleteTeamMember(member.id);
      toast.success('Team member deleted successfully');
      onSuccess();
      markClean();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => void requestClose()}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
            data-drawer-skip-dirty="true"
          />

          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full w-3/4 max-w-6xl bg-white shadow-2xl z-[70] flex flex-col"
          >
            <div className={DRAWER_FORM_HEADER_CLASS}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Edit Team Member</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {member.firstName} {member.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void requestClose()}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
                data-drawer-skip-dirty="true"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG} p-6 space-y-5`}>
              <DrawerSectionCard title="Basic Information" subtitle="Name and contact details" icon={User} accent="blue">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <DrawerFieldLabel label="First Name" required />
                    <input
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`${DRAWER_FORM_INPUT} ${errors.firstName ? 'border-red-300' : ''}`}
                    />
                    {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
                  </div>
                  <div>
                    <DrawerFieldLabel label="Last Name" required />
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`${DRAWER_FORM_INPUT} ${errors.lastName ? 'border-red-300' : ''}`}
                    />
                    {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <DrawerFieldLabel label="Work Email" required />
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={() => {
                        if (!formData.email?.trim()) {
                          setErrors((prev) => ({ ...prev, email: 'Email is required' }));
                          return;
                        }
                        const result = validateEmail(formData.email);
                        if (!result.valid) {
                          setErrors((prev) => ({ ...prev, email: result.message }));
                        }
                      }}
                      className={`${DRAWER_FORM_INPUT} ${errors.email ? 'border-red-300' : ''}`}
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <DrawerFieldLabel label="Phone" />
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={DRAWER_FORM_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <DrawerFieldLabel label="Designation" />
                    <input
                      type="text"
                      value={formData.designation || ''}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className={DRAWER_FORM_INPUT}
                    />
                  </div>
                </div>
              </DrawerSectionCard>

              <DrawerSectionCard title="Role & Access" subtitle="Department, role, and reporting line" icon={Shield} accent="violet">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <select
                      value={formData.departmentId || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          departmentId: e.target.value || '',
                          roleId: '',
                          managerId: '',
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      disabled={loadingOptions}
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Department Role *</label>
                    <select
                      value={formData.roleId || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          roleId: e.target.value,
                          managerId: '',
                        }))
                      }
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.roleId ? 'border-red-300' : 'border-slate-200'
                      }`}
                      disabled={loadingOptions || !formData.departmentId}
                    >
                      <option value="">
                        {formData.departmentId ? 'Select role' : 'Select department first'}
                      </option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName}
                          {'rank' in role && role.rank != null ? ` (Rank ${role.rank})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.roleId && <p className="text-xs text-red-600">{errors.roleId}</p>}
                    {roleChanged && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                        <p className="text-xs text-amber-800">
                          Changing this role will update the member's portal access immediately.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Reports To</label>
                    <select
                      value={formData.managerId || ''}
                      onChange={(e) => handleChange('managerId', e.target.value || '')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      disabled={loadingOptions || loadingReporting || !formData.roleId}
                    >
                      <option value="">
                        {formData.roleId ? 'Select manager' : 'Select role first'}
                      </option>
                      {reportingManagers.map((mgr) => {
                        const mgrRank = getRoleRankInDepartment(
                          formData.departmentId,
                          getMemberRoleId(mgr),
                          departments,
                          mgr.role?.roleName,
                        );
                        return (
                          <option key={mgr.id} value={mgr.id}>
                            {mgr.firstName} {mgr.lastName}
                            {mgr.role?.roleName ? ` — ${mgr.role.roleName}` : ''}
                            {mgrRank != null ? ` (Rank ${mgrRank})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Shows members with a higher rank (lower rank number). Super Admin is always available if no one else qualifies yet.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Location</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => handleChange('status', e.target.value as UserStatus)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              </DrawerSectionCard>
            </form>

            <div className={`${DRAWER_FORM_FOOTER_CLASS} justify-between`}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Member
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void requestClose()}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  data-drawer-skip-dirty="true"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
