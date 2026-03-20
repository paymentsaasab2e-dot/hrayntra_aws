'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { updateTeamMember, getRoles, getDepartments, getTeamMembers, deleteTeamMember } from '../../lib/api/teamApi';
import type { TeamMember, Role, Department, UpdateMemberPayload } from '../../types/team';

interface EditMemberDrawerProps {
  isOpen: boolean;
  member: TeamMember;
  onClose: () => void;
  onSuccess: () => void;
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
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
        departmentId: member.department?.id || member.systemRole?.id || '',
        roleId: member.role?.id || member.systemRole?.id || '',
        managerId: member.manager?.id || member.managerRelation?.id || '',
        status: member.status || 'ACTIVE',
      });
      setRoleChanged(false);
    }
  }, [isOpen, member]);

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

  const handleChange = (field: keyof UpdateMemberPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    if (field === 'roleId') {
      setRoleChanged(value !== (member.role?.id || ''));
    }
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
      onSuccess();
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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${member.firstName} ${member.lastName}? This action cannot be undone and will remove all associated data.`)) {
      return;
    }
    try {
      setIsSubmitting(true);
      await deleteTeamMember(member.id);
      toast.success('Team member deleted successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team member');
    } finally {
      setIsSubmitting(false);
    }
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
              <h2 className="text-lg font-bold text-slate-900">Edit Team Member</h2>
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
                      value={formData.firstName || ''}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.firstName ? 'border-red-300' : 'border-slate-200'
                      }`}
                    />
                    {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.lastName ? 'border-red-300' : 'border-slate-200'
                      }`}
                    />
                    {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Work Email *</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                        errors.email ? 'border-red-300' : 'border-slate-200'
                      }`}
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={formData.designation || ''}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                      value={formData.roleId || ''}
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
                      disabled={loadingOptions}
                    >
                      <option value="">Select manager</option>
                      {managers.filter((m) => m.id !== member.id).map((mgr) => (
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
              </section>
            </form>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50/50 flex items-center justify-between">
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
