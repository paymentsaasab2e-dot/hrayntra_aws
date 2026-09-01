'use client';

import React, { useState, useEffect } from 'react';
import { Shield, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { updateRole } from '../../lib/api/teamApi';
import type { SystemRole, Permission, RoleCompanyAccess } from '../../types/team';
import { emptyRoleCompanyAccess } from '../../types/team';
import {
  buildFallbackPermissionsMap,
  isDashboardHiddenTickPermission,
  mergePermissionMaps,
  RBAC_CATALOG_TOTAL,
} from './permissionCatalog';
import { PermissionPicker } from './PermissionPicker';
import { DrawerFormShell, DrawerFormCancelButton } from '../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DRAWER_FORM_INPUT,
} from '../drawers/drawerFormUi';

interface EditRoleDrawerProps {
  isOpen: boolean;
  role: SystemRole;
  permissions: Record<string, Permission[]>;
  onClose: () => void;
  onSuccess: (role?: SystemRole) => void;
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

export const EditRoleDrawer: React.FC<EditRoleDrawerProps> = ({ isOpen, role, permissions, onClose, onSuccess }) => {
  const isSuperAdmin = role.roleName === 'Super Admin';
  const effectivePermissions = React.useMemo(
    () => mergePermissionMaps(Object.keys(permissions || {}).length > 0 ? permissions : buildFallbackPermissionsMap()),
    [permissions]
  );
  
  const [formData, setFormData] = useState({
    roleName: role.roleName,
    description: role.description || '',
    color: role.color,
    selectedPermissions: new Set<string>(),
    companyAccess: emptyRoleCompanyAccess() as RoleCompanyAccess,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected permissions from role (Super Admin = all catalog permissions)
  useEffect(() => {
    if (!isOpen) return;
    const selected = new Set<string>();
    if (isSuperAdmin) {
      Object.values(effectivePermissions).forEach((list) => {
        list.forEach((p) => selected.add(p.id));
      });
    } else if (role.rolePermissions) {
      role.rolePermissions.forEach((rp) => {
        if (rp.permission?.id) selected.add(rp.permission.id);
      });
    }
    setFormData((prev) => ({
      ...prev,
      roleName: role.roleName,
      description: role.description || '',
      color: role.color,
      selectedPermissions: selected,
      companyAccess: role.companyAccess
        ? {
            crm: [...(role.companyAccess.crm || [])],
            recruitment: [...(role.companyAccess.recruitment || [])],
          }
        : emptyRoleCompanyAccess(),
    }));
  }, [isOpen, role, isSuperAdmin, effectivePermissions]);

  // Calculate selected permission count
  const selectedCount = formData.selectedPermissions.size;

  const handleChange = (field: string, value: any) => {
    if (isSuperAdmin) return; // Prevent changes for Super Admin
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
    if (isSuperAdmin) return; // Prevent changes for Super Admin
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
    if (isSuperAdmin) return; // Prevent changes for Super Admin
    const modulePermissions = (effectivePermissions[module] || []).filter(
      (p) => !isDashboardHiddenTickPermission(p.permissionName),
    );
    const allSelected =
      modulePermissions.length > 0 &&
      modulePermissions.every((p) => formData.selectedPermissions.has(p.id));

    setFormData((prev) => {
      const newSet = new Set(prev.selectedPermissions);
      if (allSelected) {
        modulePermissions.forEach((p) => newSet.delete(p.id));
      } else {
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
    if (isSuperAdmin) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await updateRole(role.id, {
        roleName: formData.roleName.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        permissionIds: Array.from(formData.selectedPermissions),
        companyAccess: formData.companyAccess,
      });

      toast.success('Role updated successfully');
      handleClose();
      onSuccess((response as any)?.data || role);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update role';
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
    setErrors({});
    onClose();
  };

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Role"
      subtitle={role.roleName}
      headerIcon={UserCog}
      footer={
        <>
          <DrawerFormCancelButton />
          {!isSuperAdmin ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          ) : null}
        </>
      }
    >
      {isSuperAdmin ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Super Admin has all <strong>{RBAC_CATALOG_TOTAL}</strong> permissions and cannot be modified.
          </p>
        </div>
      ) : null}

      <DrawerSectionCard title="Role Details" subtitle="Name, description, and badge color" icon={UserCog} accent="blue">
        <div className="space-y-4">
          <div>
            <DrawerFieldLabel label="Role Name" required />
            <input
              type="text"
              value={formData.roleName}
              onChange={(e) => handleChange('roleName', e.target.value)}
              disabled={isSuperAdmin}
              className={`${DRAWER_FORM_INPUT} ${errors.roleName ? 'border-red-300' : ''} ${isSuperAdmin ? 'cursor-not-allowed bg-slate-50' : ''}`}
            />
            {errors.roleName && <p className="text-xs text-red-600">{errors.roleName}</p>}
          </div>
          <div>
            <DrawerFieldLabel label="Description" />
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={isSuperAdmin}
              className={`${DRAWER_FORM_INPUT} ${isSuperAdmin ? 'cursor-not-allowed bg-slate-50' : ''}`}
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
                  disabled={isSuperAdmin}
                  className={`size-6 rounded-full ${colorClassMap[color.name]} transition-all ${
                    formData.color === color.name
                      ? 'scale-110 ring-2 ring-blue-500 ring-offset-2'
                      : isSuperAdmin
                        ? 'cursor-not-allowed opacity-50'
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
            onSelectionChange={(next) =>
              setFormData((prev) => ({ ...prev, selectedPermissions: next }))
            }
            companyAccess={formData.companyAccess}
            onCompanyAccessChange={(next) =>
              setFormData((prev) => ({ ...prev, companyAccess: next }))
            }
            disabled={isSuperAdmin}
          />
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
};
