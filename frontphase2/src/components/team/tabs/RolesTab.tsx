'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getRoles, getAllPermissions, deleteRole } from '../../../lib/api/teamApi';
import type { SystemRole } from '../../../types/team';
import { AddRoleDrawer } from '../AddRoleDrawer';
import { EditRoleDrawer } from '../EditRoleDrawer';
import { RoleMembersDrawer } from '../RoleMembersDrawer';

// Color mapping for role colors
const roleColorMap: Record<string, string> = {
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

export const RolesTab: React.FC = () => {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        getRoles(),
        getAllPermissions(),
      ]);

      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || {});
    } catch (error: any) {
      toast.error(error.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get modules covered by a role
  const getModulesForRole = (role: SystemRole): string[] => {
    if (!role.rolePermissions) return [];
    const modules = new Set<string>();
    role.rolePermissions.forEach((rp) => {
      if (rp.permission?.module) {
        modules.add(rp.permission.module);
      }
    });
    return Array.from(modules).sort();
  };

  // Get permission count for a role
  const getPermissionCount = (role: SystemRole): number => {
    return role.rolePermissions?.length || 0;
  };

  const handleEdit = (role: SystemRole) => {
    setSelectedRole(role);
    setShowEditDrawer(true);
  };

  const handleDelete = async (role: SystemRole) => {
    if (deleteConfirm !== role.id) {
      setDeleteConfirm(role.id);
      return;
    }

    try {
      await deleteRole(role.id);
      toast.success('Role deleted successfully');
      setDeleteConfirm(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete role');
      setDeleteConfirm(null);
    }
  };

  const handleMembersClick = (role: SystemRole) => {
    setSelectedRole(role);
    setShowMembersDrawer(true);
  };

  // Wire up the Add Role button from parent
  useEffect(() => {
    const handleAddRole = () => {
      setShowAddDrawer(true);
    };

    // Listen for custom event from parent page
    window.addEventListener('addRole', handleAddRole);
    return () => window.removeEventListener('addRole', handleAddRole);
  }, []);

  return (
    <div className="space-y-6">
      {/* Roles Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-4">No roles found</p>
            <button
              onClick={() => setShowAddDrawer(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first role
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Color</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roles.map((role) => {
                  const modules = getModulesForRole(role);
                  const permCount = getPermissionCount(role);
                  const memberCount = role._count?.users || 0;
                  const isSuperAdmin = role.roleName === 'Super Admin';

                  return (
                    <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-2 rounded-full ${roleColorMap[role.color.toLowerCase()] || 'bg-gray-500'}`} />
                          <div>
                            <div className="font-medium text-slate-900">{role.roleName}</div>
                            {role.description && (
                              <div className="text-xs text-slate-500 mt-0.5">{role.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`size-6 rounded-full ${roleColorMap[role.color.toLowerCase()] || 'bg-gray-500'}`} />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleMembersClick(role)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer"
                        >
                          <Users size={12} />
                          {memberCount}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="text-sm text-slate-900 font-medium">
                            {permCount} permission{permCount !== 1 ? 's' : ''}
                          </div>
                          {modules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {modules.map((module) => (
                                <span
                                  key={module}
                                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600"
                                >
                                  {module}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          {!isSuperAdmin && (
                            <>
                              {deleteConfirm === role.id ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleDelete(role)}
                                    className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleDelete(role)}
                                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers */}
      <AddRoleDrawer
        isOpen={showAddDrawer}
        permissions={permissions}
        onClose={() => setShowAddDrawer(false)}
        onSuccess={() => {
          setShowAddDrawer(false);
          fetchData();
        }}
      />

      {selectedRole && (
        <>
          <EditRoleDrawer
            isOpen={showEditDrawer}
            role={selectedRole}
            permissions={permissions}
            onClose={() => {
              setShowEditDrawer(false);
              setSelectedRole(null);
            }}
            onSuccess={() => {
              setShowEditDrawer(false);
              setSelectedRole(null);
              fetchData();
            }}
          />

          <RoleMembersDrawer
            isOpen={showMembersDrawer}
            role={selectedRole}
            onClose={() => {
              setShowMembersDrawer(false);
              setSelectedRole(null);
            }}
            onRoleChange={() => {
              fetchData();
            }}
          />
        </>
      )}
    </div>
  );
};
