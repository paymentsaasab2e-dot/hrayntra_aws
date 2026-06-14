'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  createTeamMember,
  getRoles,
  getDepartments,
  getDepartmentReportingManagers,
  getAllTeamMembersForDirectory,
} from '../../lib/api/teamApi';
import type { Role, Department, CreateMemberPayload, TeamMember } from '../../types/team';
import {
  filterReportingManagers,
  getRoleRankInDepartment,
  getRolesForDepartment,
  getMemberRoleId,
  pickDefaultManagerId,
  mergeReportingManagerLists,
  type DepartmentWithRoles,
} from '../../lib/teamReporting';

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

interface AddMemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member?: TeamMember) => void;
}

export const AddMemberDrawer: React.FC<AddMemberDrawerProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<CreateMemberPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    designation: '',
    location: '',
    departmentId: '',
    roleId: '',
    managerId: '',
    status: 'ACTIVE',
    generateCredentials: true,
    sendInvite: true,
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithRoles[]>([]);
  const [teamDirectory, setTeamDirectory] = useState<TeamMember[]>([]);
  const [reportingManagers, setReportingManagers] = useState<TeamMember[]>([]);
  const [loadingReporting, setLoadingReporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [createdMember, setCreatedMember] = useState<TeamMember | null>(null);

  // Load options
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const [rolesRes, deptsRes, directory] = await Promise.all([
        getRoles(),
        getDepartments(),
        getAllTeamMembersForDirectory(),
      ]);

      setRoles(rolesRes.data || []);
      setDepartments(deptsRes.data || []);
      setTeamDirectory(directory);
      setReportingManagers([]);
    } catch (error: any) {
      toast.error('Failed to load options');
    } finally {
      setLoadingOptions(false);
    }
  };

  // Generate loginId preview
  const loginIdPreview = formData.firstName && formData.lastName
    ? `${formData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${formData.lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}@saasa`
    : '';

  const availableRoles = useMemo(
    () => getRolesForDepartment(formData.departmentId, departments, roles),
    [formData.departmentId, departments, roles],
  );

  // Get selected role (includes rank from department config)
  const selectedRole =
    availableRoles.find((r) => String(r.id) === String(formData.roleId)) ||
    roles.find((r) => String(r.id) === String(formData.roleId));

  useEffect(() => {
    if (!formData.departmentId) {
      setReportingManagers([]);
      return;
    }
    if (
      formData.roleId &&
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
        memberRank,
        departmentRoleOptions: availableRoles,
      });
    };

    setLoadingReporting(true);
    getDepartmentReportingManagers(formData.departmentId, formData.roleId)
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
    formData.departmentId,
    formData.roleId,
    availableRoles,
    departments,
    teamDirectory,
    selectedRole?.rank,
  ]);

  // Get modules from role permissions
  const getModules = () => {
    if (!selectedRole || !('rolePermissions' in selectedRole)) return [];
    const roleWithPerms = selectedRole as any;
    if (!roleWithPerms.rolePermissions) return [];
    const modules = new Set<string>();
    roleWithPerms.rolePermissions.forEach((rp: any) => {
      if (rp.permission?.module) {
        modules.add(rp.permission.module);
      }
    });
    return Array.from(modules).sort();
  };

  const modules = getModules();

  const handleChange = (field: keyof CreateMemberPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
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
      const payload: CreateMemberPayload = {
        ...formData,
        departmentId: formData.departmentId || undefined,
        managerId: formData.managerId || undefined,
        phone: formData.phone || undefined,
        designation: formData.designation || undefined,
        location: formData.location || undefined,
      };

      const response = await createTeamMember(payload);
      const member = response.data as TeamMember;
      setCreatedMember(member);
      toast.success(
        member?.credentialData?.loginId
          ? 'Team member created and credentials generated successfully'
          : 'Team member created successfully'
      );
      onSuccess(member);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to create team member';
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
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      designation: '',
      location: '',
      departmentId: '',
      roleId: '',
      managerId: '',
      status: 'ACTIVE',
      generateCredentials: true,
      sendInvite: true,
    });
    setErrors({});
    setCreatedMember(null);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full w-3/4 max-w-6xl bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Add Team Member</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Basic Information */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Basic Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">First Name *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.firstName ? 'border-red-300' : 'border-slate-200'
                      }`}
                      placeholder="John"
                    />
                    {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.lastName ? 'border-red-300' : 'border-slate-200'
                      }`}
                      placeholder="Doe"
                    />
                    {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Work Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={() => {
                        if (!formData.email.trim()) {
                          setErrors((prev) => ({ ...prev, email: 'Email is required' }));
                          return;
                        }
                        const result = validateEmail(formData.email);
                        if (!result.valid) {
                          setErrors((prev) => ({ ...prev, email: result.message }));
                        }
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.email ? 'border-red-300' : 'border-slate-200'
                      }`}
                      placeholder="john.doe@company.com"
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="Senior Recruiter"
                    />
                  </div>
                </div>
              </section>

              {/* Role & Access */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Role & Access</h3>
                </div>
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
                      value={formData.roleId}
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
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="New York, USA"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Login Credentials */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Login Credentials</h3>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.generateCredentials}
                      onChange={(e) => handleChange('generateCredentials', e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Generate login credentials</span>
                  </label>

                  {formData.generateCredentials && (
                    <div className="space-y-4 pl-7">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Login ID</label>
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600">
                          {loginIdPreview || 'Will be generated automatically'}
                        </div>
                      </div>

                      {selectedRole && modules.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-700">Portal Access</label>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            {modules.map((module) => (
                              <div key={module} className="flex items-center gap-2 text-sm text-slate-700">
                                <Check size={14} className="text-green-600" />
                                <span>{module}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sendInvite}
                          onChange={(e) => handleChange('sendInvite', e.target.checked)}
                          className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">Send invite email</span>
                      </label>
                    </div>
                  )}

                  {formData.generateCredentials && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-800">
                        User will be required to set a new password on first login.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {createdMember?.credentialData ? (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-green-600 rounded-full" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generated Credentials</h3>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-4">
                    <p className="text-sm font-medium text-green-900">
                      Credentials created for {createdMember.firstName} {createdMember.lastName}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-green-900/80">Login ID</label>
                        <div className="mt-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-mono text-slate-800">
                          {createdMember.credentialData.loginId}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-green-900/80">Temporary Password</label>
                        <div className="mt-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-mono text-slate-800">
                          {createdMember.credentialData.tempPassword}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `Login ID: ${createdMember.credentialData?.loginId}\nTemporary Password: ${createdMember.credentialData?.tempPassword}`
                          );
                          toast.success('Credentials copied');
                        }}
                        className="px-4 py-2 text-sm font-medium text-green-900 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        Copy Credentials
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </form>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {createdMember?.credentialData ? 'Close' : 'Cancel'}
              </button>
                  {createdMember?.credentialData ? (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Done
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    !formData.firstName.trim() ||
                    !formData.lastName.trim() ||
                    !formData.email.trim() ||
                    !validateEmail(formData.email).valid ||
                    !formData.roleId
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Member'
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
