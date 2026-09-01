'use client';

import React, { useMemo } from 'react';
import { X, Edit, Users, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SystemRole } from '../../types/team';
import { PortalHost } from './PortalHost';
import {
  formatPermissionLabel,
  formatModuleLabel,
  mergePermissionMaps,
  RBAC_CATALOG_TOTAL,
  sortModules,
} from './permissionCatalog';
import type { Permission } from '../../types/team';

interface RoleDetailDrawerProps {
  isOpen: boolean;
  role: SystemRole | null;
  permissions: Record<string, Permission[]>;
  onClose: () => void;
  onEdit: (role: SystemRole) => void;
  onMembers: (role: SystemRole) => void;
}

export const RoleDetailDrawer: React.FC<RoleDetailDrawerProps> = ({
  isOpen,
  role,
  permissions,
  onClose,
  onEdit,
  onMembers,
}) => {
  const isSuperAdmin = role?.roleName === 'Super Admin';
  const effectivePermissions = useMemo(() => mergePermissionMaps(permissions), [permissions]);

  const assignedByModule = useMemo(() => {
    if (!role) return {};
    if (isSuperAdmin) return effectivePermissions;

    const map: Record<string, Permission[]> = {};
    (role.rolePermissions || []).forEach((rp) => {
      const p = rp.permission;
      if (!p?.module) return;
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push({
        ...p,
        id: p.id || p.permissionName,
        permissionName: p.permissionName,
        module: p.module,
      });
    });
    return map;
  }, [role, isSuperAdmin, effectivePermissions]);

  const assignedCount = isSuperAdmin
    ? RBAC_CATALOG_TOTAL
    : role?.rolePermissions?.length || 0;

  const modules = sortModules(Object.keys(assignedByModule));

  if (!role) return null;

  return (
    <PortalHost open={isOpen}>
      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{role.roleName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{role.description || 'No description'}</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {isSuperAdmin ? (
                <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                  <Shield className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    Super Admin always has all <strong>{RBAC_CATALOG_TOTAL}</strong> permissions. This role cannot be edited.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-slate-50">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{assignedCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Permissions</p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <p className="text-xl font-bold text-indigo-800">{role._count?.users ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">Members</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Permission list</p>
                {modules.map((module) => {
                  const perms = assignedByModule[module] || [];
                  if (!perms.length) return null;
                  return (
                    <div key={module} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-sm font-semibold text-slate-900 mb-2">{formatModuleLabel(module)}</p>
                      <ul className="space-y-1.5">
                        {perms.map((p) => (
                          <li key={p.id} className="text-xs text-slate-600">
                            {formatPermissionLabel(p.permissionName)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 px-6 py-4 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onMembers(role)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-4 w-4" />
                  Members
                </button>
                {!isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => onEdit(role)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4" />
                    Edit role
                  </button>
                ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </PortalHost>
  );
};
