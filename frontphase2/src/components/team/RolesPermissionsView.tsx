'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';
import { getRoles } from '../../lib/api/teamApi';
import type { SystemRole, Permission } from '../../types/team';

export const RolesPermissionsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await getRoles();
      const rolesData = response.data || [];
      setRoles(rolesData);

      // Group permissions by module
      const grouped: Record<string, Permission[]> = {};
      rolesData.forEach((role) => {
        role.permissions.forEach((perm) => {
          if (!grouped[perm.module]) {
            grouped[perm.module] = [];
          }
          // Avoid duplicates
          if (!grouped[perm.module].find((p) => p.id === perm.id)) {
            grouped[perm.module].push(perm);
          }
        });
      });
      setPermissionsByModule(grouped);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (role: SystemRole, permissionName: string): boolean => {
    return role.permissions.some((p) => p.permissionName === permissionName);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-block size-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Get all unique permissions across all roles
  const allPermissions: Permission[] = [];
  Object.values(permissionsByModule).forEach((perms) => {
    perms.forEach((perm) => {
      if (!allPermissions.find((p) => p.id === perm.id)) {
        allPermissions.push(perm);
      }
    });
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Roles & Permissions Matrix</h2>
        <p className="text-sm text-slate-500 mt-1">View permissions assigned to each role</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">
                Permission
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[150px]"
                >
                  {role.roleName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(permissionsByModule).map(([module, permissions]) => (
              <React.Fragment key={module}>
                {/* Module Header Row */}
                <tr className="bg-slate-100">
                  <td
                    colSpan={roles.length + 1}
                    className="px-6 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    {module}
                  </td>
                </tr>
                {/* Permissions in this module */}
                {permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900 sticky left-0 bg-white z-10">
                      <div>
                        <p className="font-medium">{permission.permissionName}</p>
                        {permission.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{permission.description}</p>
                        )}
                      </div>
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-6 py-4 text-center">
                        {hasPermission(role, permission.permissionName) ? (
                          <Check className="size-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="size-5 text-slate-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
