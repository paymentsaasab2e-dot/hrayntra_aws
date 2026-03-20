'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { createTeamMember, getRoles, getDepartments, getTeamMembers } from '../../lib/api/teamApi';
import type { Role, Department, CreateMemberPayload } from '../../types/team';

interface AddMemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Load options
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const [rolesRes, deptsRes, membersRes] = await Promise.all([
        getRoles(),
        getDepartments(),
        getTeamMembers({ status: 'ACTIVE' }),
      ]);

      setRoles(rolesRes.data || []);
      setDepartments(deptsRes.data || []);
      setManagers(membersRes.data || []);
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

  // Get selected role
  const selectedRole = roles.find((r) => r.id === formData.roleId);

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
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
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

      await createTeamMember(payload);
      toast.success('Team member created successfully');
      onSuccess();
      handleClose();
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
            className="fixed right-0 top-0 h-full max-w-lg w-full bg-white shadow-2xl z-[70] flex flex-col"
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
                      onChange={(e) => handleChange('departmentId', e.target.value || '')}
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
                    <label className="text-xs font-semibold text-slate-700">System Role *</label>
                    <select
                      value={formData.roleId}
                      onChange={(e) => handleChange('roleId', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.roleId ? 'border-red-300' : 'border-slate-200'
                      }`}
                      disabled={loadingOptions}
                    >
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName}
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
                      disabled={loadingOptions}
                    >
                      <option value="">Select manager</option>
                      {managers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.firstName} {mgr.lastName}
                        </option>
                      ))}
                    </select>
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
            </form>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
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
                    Creating...
                  </>
                ) : (
                  'Create Member'
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
