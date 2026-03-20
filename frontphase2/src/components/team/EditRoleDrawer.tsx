'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { updateRole } from '../../lib/api/teamApi';
import type { SystemRole, Permission } from '../../types/team';

interface EditRoleDrawerProps {
  isOpen: boolean;
  role: SystemRole;
  permissions: Record<string, Permission[]>;
  onClose: () => void;
  onSuccess: () => void;
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

// Format permission name to human-readable
const formatPermissionName = (name: string): string => {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const EditRoleDrawer: React.FC<EditRoleDrawerProps> = ({ isOpen, role, permissions, onClose, onSuccess }) => {
  const isSuperAdmin = role.roleName === 'Super Admin';
  
  const [formData, setFormData] = useState({
    roleName: role.roleName,
    description: role.description || '',
    color: role.color,
    selectedPermissions: new Set<string>(),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected permissions from role
  useEffect(() => {
    if (isOpen && role.rolePermissions) {
      const selected = new Set<string>();
      role.rolePermissions.forEach((rp) => {
        if (rp.permission?.id) {
          selected.add(rp.permission.id);
        }
      });
      setFormData((prev) => ({ ...prev, selectedPermissions: selected }));
    }
  }, [isOpen, role]);

  // Calculate selected permission count
  const selectedCount = formData.selectedPermissions.size;

  // Get modules in sorted order
  const modules = Object.keys(permissions).sort();

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
    const modulePermissions = permissions[module] || [];
    const allSelected = modulePermissions.length > 0 && modulePermissions.every((p) => formData.selectedPermissions.has(p.id));

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
    if (isSuperAdmin) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await updateRole(role.id, {
        roleName: formData.roleName.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        permissionIds: Array.from(formData.selectedPermissions),
      });

      toast.success('Role updated successfully');
      handleClose();
      onSuccess();
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
            className="fixed right-0 top-0 h-full max-w-xl w-full bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Edit Role</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Super Admin Notice */}
            {isSuperAdmin && (
              <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  The Super Admin role cannot be modified.
                </p>
              </div>
            )}

            {/* Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Role Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Role Name *</label>
                <input
                  type="text"
                  value={formData.roleName}
                  onChange={(e) => handleChange('roleName', e.target.value)}
                  disabled={isSuperAdmin}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                    errors.roleName ? 'border-red-300' : 'border-slate-200'
                  } ${isSuperAdmin ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                />
                {errors.roleName && <p className="text-xs text-red-600">{errors.roleName}</p>}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={isSuperAdmin}
                  className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                    isSuperAdmin ? 'bg-slate-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Color *</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => handleChange('color', color.name)}
                      disabled={isSuperAdmin}
                      className={`size-6 rounded-full ${colorClassMap[color.name]} transition-all ${
                        formData.color === color.name
                          ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                          : isSuperAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
                {errors.color && <p className="text-xs text-red-600">{errors.color}</p>}
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Permissions *</label>
                  <span className="text-xs text-slate-500">{selectedCount} permission{selectedCount !== 1 ? 's' : ''} selected</span>
                </div>
                {errors.permissions && <p className="text-xs text-red-600">{errors.permissions}</p>}

                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {modules.map((module) => {
                    const modulePermissions = permissions[module] || [];
                    const allSelected = modulePermissions.length > 0 && modulePermissions.every((p) => formData.selectedPermissions.has(p.id));

                    return (
                      <div key={module} className="border border-slate-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-900">{module}</h4>
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleModuleSelectAll(module)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {modulePermissions.map((permission) => (
                            <label
                              key={permission.id}
                              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                isSuperAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.selectedPermissions.has(permission.id)}
                                onChange={() => handlePermissionToggle(permission.id)}
                                disabled={isSuperAdmin}
                                className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                              />
                              <span className="text-sm text-slate-700 flex-1">
                                {formatPermissionName(permission.permissionName)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
              {!isSuperAdmin && (
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
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
