'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Shield, Key, AlertCircle, Check } from 'lucide-react';
import { createTeamMember, getRoles, getDepartments } from '../../lib/api/teamApi';
import { PortalAccessPreview } from './PortalAccessPreview';
import { toast } from 'sonner';
import type { CreateMemberPayload, SystemRole, Department, UserStatus } from '../../types/team';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTeamMembers, setActiveTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailError, setEmailError] = useState<string>('');

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
    loginIdOption: 'auto',
    customLoginId: '',
  });

  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        getRoles(),
        getDepartments(),
      ]);
      setRoles(rolesRes.data || []);
      setDepartments(deptsRes.data || []);
      
      // Load active team members for manager dropdown
      // This would need a separate API call or we can fetch from the team list
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const handleChange = (field: keyof CreateMemberPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'email') {
      setEmailError('');
    }

    if (field === 'roleId') {
      const role = roles.find((r) => r.id === value);
      setSelectedRole(role || null);
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

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const response = await createTeamMember(formData);
      const data = response.data as any;

      if (data.credentialData) {
        toast.success(
          `Team member created and invite sent! Login ID: ${data.credentialData.loginId}`,
          { duration: 5000 }
        );
      } else {
        toast.success('Team member created successfully');
      }

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to create team member';
      if (errorMessage.includes('email') || errorMessage.includes('Email')) {
        setEmailError(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
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
      loginIdOption: 'auto',
      customLoginId: '',
    });
    setErrors({});
    setEmailError('');
    setSelectedRole(null);
    onClose();
  };

  if (!isOpen) return null;

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
                <h2 className="text-xl font-bold text-slate-900">Add Team Member</h2>
                <p className="text-sm text-slate-500 mt-1">Create a new team member account</p>
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
                  <UserPlus className="size-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Basic Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.firstName ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      placeholder="John"
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
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.lastName ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      placeholder="Doe"
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
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.email || emailError ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      placeholder="john.doe@company.com"
                    />
                    {(errors.email || emailError) && (
                      <p className="text-xs text-red-600">{errors.email || emailError}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Senior Recruiter"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Department
                    </label>
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
                    <label className="text-xs font-semibold text-slate-700">
                      System Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.roleId || ''}
                      onChange={(e) => handleChange('roleId', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errors.roleId ? 'border-red-300' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value="">Select role...</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName}
                        </option>
                      ))}
                    </select>
                    {errors.roleId && (
                      <p className="text-xs text-red-600">{errors.roleId}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Reports To / Manager
                    </label>
                    <select
                      value={formData.managerId || ''}
                      onChange={(e) => handleChange('managerId', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select manager...</option>
                      {/* Would load from active team members */}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Location</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleChange('location', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City, Country"
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

                {/* Portal Access Preview */}
                {selectedRole && (
                  <div className="mt-4">
                    <PortalAccessPreview role={selectedRole} />
                  </div>
                )}
              </section>

              {/* Section 3: Login Credentials */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="size-5 text-amber-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Login Credentials</h3>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.generateCredentials}
                      onChange={(e) => handleChange('generateCredentials', e.target.checked)}
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Generate login credentials on creation
                    </span>
                  </label>

                  {formData.generateCredentials && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Login ID Format
                        </label>
                        <select
                          value={formData.loginIdOption || 'auto'}
                          onChange={(e) => handleChange('loginIdOption', e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="auto">Auto-generate (firstname.lastname@saasa)</option>
                          <option value="email">Use work email</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      {formData.loginIdOption === 'custom' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-700">
                            Custom Login ID
                          </label>
                          <input
                            type="text"
                            value={formData.customLoginId || ''}
                            onChange={(e) => handleChange('customLoginId', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="custom.login@saasa"
                          />
                        </div>
                      )}

                      {selectedRole && (
                        <div className="mt-2">
                          <PortalAccessPreview role={selectedRole} />
                        </div>
                      )}

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sendInvite}
                          onChange={(e) => handleChange('sendInvite', e.target.checked)}
                          className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Send invite email immediately
                        </span>
                      </label>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertCircle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-800">
                          The user will be required to set a new password on first login.
                        </p>
                      </div>
                    </>
                  )}
                </div>
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
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
