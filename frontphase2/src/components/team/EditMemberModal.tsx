'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, AlertCircle } from 'lucide-react';
import { updateTeamMember, getRoles, getDepartments } from '../../lib/api/teamApi';
import { PortalAccessPreview } from './PortalAccessPreview';
import { toast } from 'sonner';
import type { UpdateMemberPayload, SystemRole, Department, TeamMember, UserStatus } from '../../types/team';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  onSuccess?: () => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({ isOpen, onClose, member, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRoleWarning, setShowRoleWarning] = useState(false);
  const [originalRoleId, setOriginalRoleId] = useState<string>('');

  const [formData, setFormData] = useState<UpdateMemberPayload>({
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
  });

  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);

  useEffect(() => {
    if (isOpen && member) {
      loadOptions();
      setFormData({
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
      setOriginalRoleId(member.role?.id || '');
      setShowRoleWarning(false);
    }
  }, [isOpen, member]);

  useEffect(() => {
    if (formData.roleId && roles.length > 0) {
      const role = roles.find((r) => r.id === formData.roleId);
      setSelectedRole(role || null);
      
      // Show warning if role changed
      if (formData.roleId !== originalRoleId && originalRoleId) {
        setShowRoleWarning(true);
      } else {
        setShowRoleWarning(false);
      }
    }
  }, [formData.roleId, roles, originalRoleId]);

  const loadOptions = async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        getRoles(),
        getDepartments(),
      ]);
      setRoles(rolesRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const handleChange = (field: keyof UpdateMemberPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !member) {
      return;
    }

    setLoading(true);
    try {
      await updateTeamMember(member.id, formData);
      toast.success('Team member updated successfully');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update team member');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setShowRoleWarning(false);
    onClose();
  };

  if (!isOpen || !member) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[60] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit Team Member</h2>
                <p className="text-sm text-slate-500 mt-1">Update team member information</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="size-5 text-slate-500" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Section 1: Basic Information */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Basic Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.firstName ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-600">{errors.firstName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.lastName ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-600">{errors.lastName}</p>
                    )}
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.email ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={formData.designation || ''}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Role & Access */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Role & Access</h3>
                </div>

                {showRoleWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Changing this member's role will update their portal access immediately upon save.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <select
                      value={formData.departmentId || ''}
                      onChange={(e) => handleChange('departmentId', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select department...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">System Role</label>
                    <select
                      value={formData.roleId || ''}
                      onChange={(e) => handleChange('roleId', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select role...</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Reports To / Manager</label>
                    <select
                      value={formData.managerId || ''}
                      onChange={(e) => handleChange('managerId', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select manager...</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Location</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleChange('location', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleChange('status', 'ACTIVE')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700 border-2 border-green-500'
                            : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('status', 'INACTIVE')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.status === 'INACTIVE'
                            ? 'bg-slate-100 text-slate-600 border-2 border-slate-500'
                            : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                        }`}
                      >
                        Inactive
                      </button>
                    </div>
                  </div>
                </div>

                {selectedRole && (
                  <div className="mt-4">
                    <PortalAccessPreview role={selectedRole} />
                  </div>
                )}
              </section>
            </form>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-white flex items-center justify-between sticky bottom-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
