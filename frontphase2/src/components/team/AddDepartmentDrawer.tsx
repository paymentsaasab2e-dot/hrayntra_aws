'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { createDepartment, updateDepartment, getRoles, getAllPermissions } from '../../lib/api/teamApi';
import type { Department, Permission, Role } from '../../types/team';
import { PortalHost } from './PortalHost';
import {
  DepartmentRolesEditor,
  departmentRoleDraftsToPayload,
  departmentRolesToDrafts,
  validateDepartmentRoleDrafts,
  type DepartmentRoleDraft,
} from './DepartmentRolesEditor';
import { mergePermissionMaps } from './permissionCatalog';

interface AddDepartmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (department?: Department) => void;
  department?: Department | null;
}

const EMPTY_FORM = {
  name: '',
  description: '',
};

export const AddDepartmentDrawer: React.FC<AddDepartmentDrawerProps> = ({ isOpen, onClose, onSuccess, department = null }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [roleDrafts, setRoleDrafts] = useState<DepartmentRoleDraft[]>([]);
  const [predefinedRoles, setPredefinedRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = useMemo(() => Boolean(department?.id), [department]);

  const handleChange = (field: string, value: string) => {
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

    if (!formData.name.trim()) {
      newErrors.name = 'Department name is required';
    }

    const roleError = validateDepartmentRoleDrafts(roleDrafts);
    if (roleError) {
      newErrors.roles = roleError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadRoleOptions = async () => {
    setLoadingRoles(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([getRoles(), getAllPermissions()]);
      setPredefinedRoles(rolesRes.data || []);
      setPermissions(mergePermissionMaps(permsRes.data || {}));
    } catch {
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        roles: departmentRoleDraftsToPayload(roleDrafts),
      };

      if (isEditMode && department?.id) {
        const response = await updateDepartment(department.id, payload);
        toast.success('Department updated');
        onSuccess((response as { data?: Department })?.data || { ...department, ...payload });
      } else {
        const response = await createDepartment(payload);
        toast.success('Department created');
        onSuccess((response as { data?: Department })?.data);
      }

      handleClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} department`;
      if (errorMessage.toLowerCase().includes('name') || errorMessage.toLowerCase().includes('already')) {
        setErrors({ name: errorMessage });
      } else if (errorMessage.toLowerCase().includes('rank') || errorMessage.toLowerCase().includes('role')) {
        setErrors({ roles: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setRoleDrafts([]);
    setErrors({});
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    loadRoleOptions();
    setFormData({
      name: department?.name || '',
      description: department?.description || '',
    });
    setRoleDrafts(departmentRolesToDrafts(department?.departmentRoles));
    setErrors({});
  }, [department, isOpen]);

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
    <PortalHost open={isOpen}>
      <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-2rem)] flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-900">{isEditMode ? 'Modify Department' : 'Add Department'}</h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Department Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                          errors.name ? 'border-red-300' : 'border-slate-200'
                        }`}
                        placeholder="e.g. Sales, Engineering"
                      />
                      {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Brief description of this department"
                      />
                    </div>

                    <div className={loadingRoles ? 'pointer-events-none opacity-60' : ''}>
                      <DepartmentRolesEditor
                        value={roleDrafts}
                        onChange={setRoleDrafts}
                        predefinedRoles={predefinedRoles}
                        permissions={permissions}
                        error={errors.roles}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || loadingRoles}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {isEditMode ? 'Saving...' : 'Creating...'}
                        </>
                      ) : (
                        isEditMode ? 'Save Changes' : 'Add Department'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </PortalHost>
  );
};
