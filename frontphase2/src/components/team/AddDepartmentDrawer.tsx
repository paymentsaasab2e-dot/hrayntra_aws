'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Shield, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { createDepartment, updateDepartment, getRoles, getAllPermissions } from '../../lib/api/teamApi';
import type { Department, Permission, Role } from '../../types/team';
import { PortalHost } from './PortalHost';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_FOOTER_CLASS,
  DRAWER_FORM_HEADER_CLASS,
  DRAWER_FORM_INPUT,
  DRAWER_FORM_SCROLL_BG,
} from '../drawers/drawerFormUi';
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
  allowsCrossDepartmentRequests: false,
};

export const AddDepartmentDrawer: React.FC<AddDepartmentDrawerProps> = ({ isOpen, onClose, onSuccess, department = null }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [roleDrafts, setRoleDrafts] = useState<DepartmentRoleDraft[]>([]);
  const [predefinedRoles, setPredefinedRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);

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
        allowsCrossDepartmentRequests: Boolean(formData.allowsCrossDepartmentRequests),
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
    setActiveRoleKey(null);
    setErrors({});
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    loadRoleOptions();
    setFormData({
      name: department?.name || '',
      description: department?.description || '',
      allowsCrossDepartmentRequests: Boolean(department?.allowsCrossDepartmentRequests),
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
            <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-2rem)] flex-col">
                <div className={DRAWER_FORM_HEADER_CLASS}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isEditMode ? 'Modify Department' : 'Add Department'}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">Configure department details and roles</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className={`flex-1 overflow-y-auto px-6 py-6 ${DRAWER_FORM_SCROLL_BG}`}>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
                    <div className="space-y-5">
                      <DrawerSectionCard
                        title="Department Details"
                        subtitle="Name, description, and cross-dept access"
                        icon={Building2}
                        accent="blue"
                      >
                        <div className="space-y-4">
                          <div>
                            <DrawerFieldLabel label="Department Name" required />
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => handleChange('name', e.target.value)}
                              className={`${DRAWER_FORM_INPUT} ${errors.name ? 'border-red-300' : ''}`}
                              placeholder="e.g. Sales, Engineering"
                            />
                            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                          </div>

                          <div>
                            <DrawerFieldLabel label="Description" />
                            <textarea
                              value={formData.description}
                              onChange={(e) => handleChange('description', e.target.value)}
                              rows={3}
                              className={`${DRAWER_FORM_INPUT} resize-none`}
                              placeholder="Brief description of this department"
                            />
                          </div>

                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                            <input
                              type="checkbox"
                              checked={Boolean(formData.allowsCrossDepartmentRequests)}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  allowsCrossDepartmentRequests: e.target.checked,
                                }))
                              }
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">
                                Allow cross-department requests
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-600">
                                Other department heads can send work requests to this department.
                              </span>
                            </span>
                          </label>
                        </div>
                      </DrawerSectionCard>

                      <DrawerSectionCard
                        title="Department Roles"
                        subtitle="Define roles and rank for this department"
                        icon={Users}
                        accent="violet"
                      >
                        <div className={loadingRoles ? 'pointer-events-none opacity-60' : ''}>
                          <DepartmentRolesEditor
                            panel="list"
                            value={roleDrafts}
                            onChange={setRoleDrafts}
                            predefinedRoles={predefinedRoles}
                            permissions={permissions}
                            error={errors.roles}
                            activeKey={activeRoleKey}
                            onActiveKeyChange={setActiveRoleKey}
                          />
                        </div>
                      </DrawerSectionCard>
                    </div>

                    <div className={`lg:sticky lg:top-0 ${loadingRoles ? 'pointer-events-none opacity-60' : ''}`}>
                      <DrawerSectionCard
                        title="Role Permissions"
                        subtitle="Assign module access for the selected role"
                        icon={Shield}
                        accent="indigo"
                      >
                        <DepartmentRolesEditor
                          panel="permissions"
                          value={roleDrafts}
                          onChange={setRoleDrafts}
                          predefinedRoles={predefinedRoles}
                          permissions={permissions}
                          activeKey={activeRoleKey}
                          onActiveKeyChange={setActiveRoleKey}
                        />
                      </DrawerSectionCard>
                    </div>
                  </div>
                </div>

                <div className={DRAWER_FORM_FOOTER_CLASS}>
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
