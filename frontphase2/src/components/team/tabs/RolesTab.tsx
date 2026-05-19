'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, Users } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../../../constants/tableUi';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { getRoles, getAllPermissions, deleteRole } from '../../../lib/api/teamApi';
import type { SystemRole } from '../../../types/team';
import { AddRoleDrawer } from '../AddRoleDrawer';
import { EditRoleDrawer } from '../EditRoleDrawer';
import { RoleMembersDrawer } from '../RoleMembersDrawer';
import { mergePermissionMaps } from '../permissionCatalog';
import { PH2_TABLE_CARD_CLASS } from '../../../components/layout/Ph2ModulePageLayout';
import { TableSkeleton } from '../../../components/ui/Skeleton';

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

const getSafeRoleColorClass = (color?: string | null) => {
  const key = String(color || '').trim().toLowerCase();
  return roleColorMap[key] || 'bg-gray-500';
};

const ROLES_TABLE_HEAD_ROW =
  'bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]';

const ROLES_TH = 'px-3 py-2.5 text-left first:pl-4 sm:px-4 sm:first:pl-6 sm:py-3';

const ROLES_TR =
  'transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45';

export const RolesTab: React.FC = () => {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissions, setPermissions] = useState<Record<string, any[]>>({});
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [rolesRes, permsRes] = await Promise.all([getRoles(), getAllPermissions()]);
    return {
      roles: rolesRes.data || [],
      permissions: mergePermissionMaps(permsRes.data || {}),
    };
  }, []);

  const { data, error, isLoading, mutate } = useSWR('team:roles:permissions', fetchData, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setRoles(data.roles || []);
    setPermissions(data.permissions || {});
  }, [data]);

  useEffect(() => {
    if (!error) return;
    toast.error((error as any)?.message || 'Failed to load roles');
  }, [error]);

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

  const upsertRoleLocal = useCallback((role: SystemRole) => {
    setRoles((prev) => {
      const exists = prev.some((item) => item.id === role.id);
      return exists ? prev.map((item) => (item.id === role.id ? role : item)) : [role, ...prev];
    });
  }, []);

  const removeRoleLocal = useCallback((roleId: string) => {
    setRoles((prev) => prev.filter((role) => role.id !== roleId));
  }, []);

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
      removeRoleLocal(role.id);
      mutate();
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
      <div className={PH2_TABLE_CARD_CLASS}>
        <div className="overflow-hidden">
          <div className="no-scrollbar overflow-x-auto">
            {isLoading ? (
              <TableSkeleton rows={6} columns={5} className="border-0 shadow-none rounded-none" />
            ) : roles.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-slate-500">No roles found</p>
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(true)}
                  className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Create your first role
                </button>
              </div>
            ) : (
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className={ROLES_TABLE_HEAD_ROW}>
                    <th className={ROLES_TH}>Role</th>
                    <th className={ROLES_TH}>Color</th>
                    <th className={ROLES_TH}>Members</th>
                    <th className={ROLES_TH}>Permissions</th>
                    <th className={`${ROLES_TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {roles.map((role) => {
                    const modules = getModulesForRole(role);
                    const permCount = getPermissionCount(role);
                    const memberCount = role._count?.users || 0;
                    const isSuperAdmin = role.roleName === 'Super Admin';

                    return (
                      <tr key={role.id} className={ROLES_TR}>
                        <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`size-2 shrink-0 rounded-full ${getSafeRoleColorClass(role.color)}`} />
                            <div>
                              <div className="text-xs font-semibold text-slate-900">{role.roleName}</div>
                              {role.description ? (
                                <div className="mt-0.5 text-[10px] text-slate-500">{role.description}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                          <div className={`size-6 rounded-full ${getSafeRoleColorClass(role.color)}`} />
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                          <button
                            type="button"
                            onClick={() => handleMembersClick(role)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800 ring-1 ring-indigo-100/80 transition-colors hover:bg-indigo-100/80"
                          >
                            <Users size={12} />
                            {memberCount}
                          </button>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-3.5">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-900">
                              {permCount} permission{permCount !== 1 ? 's' : ''}
                            </div>
                            {modules.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {modules.map((module) => (
                                  <span
                                    key={module}
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                                  >
                                    {module}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right sm:px-4 sm:py-3.5">
                          <div className="inline-flex items-center justify-end gap-0.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
                            {SHOW_TABLE_ROW_EDIT_ICON ? (
                              <button
                                type="button"
                                onClick={() => handleEdit(role)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 transition-all hover:bg-white hover:text-amber-800 hover:shadow-sm"
                                title="Edit"
                              >
                                <Edit size={16} strokeWidth={2.25} />
                              </button>
                            ) : null}
                            {!isSuperAdmin ? (
                              <>
                                {deleteConfirm === role.id ? (
                                  <div className="flex items-center gap-1 pl-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(role)}
                                      className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-700"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirm(null)}
                                      className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(role)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition-all hover:bg-white hover:text-rose-700 hover:shadow-sm"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} strokeWidth={2.25} />
                                  </button>
                                )}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Drawers */}
      <AddRoleDrawer
        isOpen={showAddDrawer}
        permissions={permissions}
        onClose={() => setShowAddDrawer(false)}
        onSuccess={(createdRole) => {
          setShowAddDrawer(false);
          if (createdRole) {
            upsertRoleLocal(createdRole);
          }
          mutate();
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
            onSuccess={(updatedRole) => {
              setShowEditDrawer(false);
              setSelectedRole(null);
              if (updatedRole) {
                upsertRoleLocal(updatedRole);
              }
              mutate();
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
              mutate();
            }}
          />
        </>
      )}
    </div>
  );
};
