'use client';

import React, { useState, useEffect } from 'react';
import { Shield, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { createRole } from '../../lib/api/teamApi';
import type { Permission } from '../../types/team';
import { buildFallbackPermissionsMap, mergePermissionMaps } from './permissionCatalog';
import { PermissionPicker } from './PermissionPicker';
import { DrawerFormShell } from '../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../drawers/drawerFormUi';

interface AddRoleDrawerProps {
  isOpen: boolean;
  permissions: Record<string, Permission[]>;
  onClose: () => void;
  onSuccess: (role?: any) => void;
}

// Available colors
const colors = [
  { name: 'purple', label: 'Purple' },
  { name: 'blue', label: 'Blue' },
  { name: 'teal', label: 'Teal' },
  { name: 'green', label: 'Green' },
  { name: 'amber', label: 'Amber' },
  { name: 'orange', label: 'Orange' },
  { name: 'red', label: 'Red' },
  { name: 'gray', label: 'Gray' },
];

const colorClassMap: Record<string, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  gray: 'bg-gray-500',
};

export const AddRoleDrawer: React.FC<AddRoleDrawerProps> = ({ isOpen, permissions, onClose, onSuccess }) => {
  const effectivePermissions = React.useMemo(
    () => mergePermissionMaps(Object.keys(permissions || {}).length > 0 ? permissions : buildFallbackPermissionsMap()),
    [permissions]
  );
  const [formData, setFormData] = useState({
    roleName: '',
    description: '',
    color: '',
    selectedPermissions: new Set<string>(),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moduleSelectAll, setModuleSelectAll] = useState<Record<string, boolean>>({});

  // Initialize module select all state
  useEffect(() => {
    const moduleStates: Record<string, boolean> = {};
    Object.keys(effectivePermissions).forEach((module) => {
      moduleStates[module] = false;
    });
    setModuleSelectAll(moduleStates);
  }, [effectivePermissions]);

  // Calculate selected permission count
  const selectedCount = formData.selectedPermissions.size;

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => {
      const newSet = new Set(prev.selectedPermissions);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return { ...prev, selectedPermissions: newSet };
    });
  };

  const handleModuleSelectAll = (module: string) => {
    const modulePermissions = effectivePermissions[module] || [];
    const allSelected = modulePermissions.every((p) => formData.selectedPermissions.has(p.id));

    setFormData((prev) => {
      const newSet = new Set(prev.selectedPermissions);
      if (allSelected) {
        // Deselect all
        modulePermissions.forEach((p) => newSet.delete(p.id));
      } else {
        // Select all
        modulePermissions.forEach((p) => newSet.add(p.id));
      }
      return { ...prev, selectedPermissions: newSet };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.roleName.trim()) {
      newErrors.roleName = 'Role name is required';
    }
    if (!formData.color) {
      newErrors.color = 'Color is required';
    }
    if (formData.selectedPermissions.size === 0) {
      newErrors.permissions = 'At least one permission is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await createRole({
        roleName: formData.roleName.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        permissionIds: Array.from(formData.selectedPermissions),
      });

      toast.success('Role created successfully');
      handleClose();
      onSuccess((response as any)?.data);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to create role';
      if (errorMessage.toLowerCase().includes('name') || errorMessage.toLowerCase().includes('already')) {
        setErrors({ roleName: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      roleName: '',
      description: '',
      color: '',
      selectedPermissions: new Set<string>(),
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
    <DrawerFormShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Role"
      subtitle="Define a role name, color, and permissions"
      headerIcon={UserCog}
      panelClassName="fixed right-0 top-0 z-[1010] flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl pointer-events-auto"
      zBackdrop={1000}
      zPanel={1010}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Role'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Role Details" subtitle="Name, description, and badge color" icon={UserCog} accent="blue">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Role Name" required />
            <input
              type="text"
              value={formData.roleName}
              onChange={(e) => handleChange('roleName', e.target.value)}
              className={`${DRAWER_FORM_INPUT} ${errors.roleName ? 'border-red-300' : ''}`}
              placeholder="e.g. Senior Recruiter"
            />
            {errors.roleName && <p className="text-xs text-red-600">{errors.roleName}</p>}
          </div>
          <div>
            <DrawerFieldLabel label="Description" />
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={DRAWER_FORM_INPUT}
              placeholder="Brief description of this role"
            />
          </div>
          <div>
            <DrawerFieldLabel label="Color" required />
            <div className="flex flex-wrap items-center gap-3">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleChange('color', color.name)}
                  className={`size-6 rounded-full ${colorClassMap[color.name]} transition-all ${
                    formData.color === color.name
                      ? 'scale-110 ring-2 ring-blue-500 ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                  title={color.label}
                />
              ))}
            </div>
            {errors.color && <p className="text-xs text-red-600">{errors.color}</p>}
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Permissions" subtitle="Module access for this role" icon={Shield} accent="violet">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <DrawerFieldLabel label="Selected" />
            <span className="text-xs text-slate-500">
              {selectedCount} permission{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>
          {errors.permissions && <p className="text-xs text-red-600">{errors.permissions}</p>}
          <PermissionPicker
            permissionsByModule={effectivePermissions}
            selectedIds={formData.selectedPermissions}
            onToggle={handlePermissionToggle}
            onModuleSelectAll={handleModuleSelectAll}
          />
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
};
