'use client';

import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { DepartmentRoleInput, Permission, Role } from '../../types/team';
import { PermissionPicker } from './PermissionPicker';
import { buildFallbackPermissionsMap, mergePermissionMaps } from './permissionCatalog';

export type DepartmentRoleDraft = {
  key: string;
  mode: 'existing' | 'new';
  roleId?: string;
  roleName?: string;
  description?: string;
  color: string;
  permissionIds: Set<string>;
  rank: number;
  expanded?: boolean;
};

const ROLE_COLORS = [
  { name: 'purple', label: 'Purple' },
  { name: 'blue', label: 'Blue' },
  { name: 'teal', label: 'Teal' },
  { name: 'green', label: 'Green' },
  { name: 'amber', label: 'Amber' },
  { name: 'orange', label: 'Orange' },
  { name: 'red', label: 'Red' },
  { name: 'gray', label: 'Gray' },
];

function newDraftKey() {
  return `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function departmentRoleDraftsToPayload(drafts: DepartmentRoleDraft[]): DepartmentRoleInput[] {
  return drafts.map((draft) => ({
    rank: draft.rank,
    ...(draft.mode === 'existing'
      ? { roleId: draft.roleId }
      : {
          roleName: draft.roleName?.trim(),
          description: draft.description?.trim() || undefined,
          color: draft.color,
          permissionIds: Array.from(draft.permissionIds),
        }),
  }));
}

export function departmentRolesToDrafts(
  links: Array<{ rank: number; roleId: string; role?: Role }> | undefined,
): DepartmentRoleDraft[] {
  if (!links?.length) return [];
  return [...links]
    .sort((a, b) => a.rank - b.rank)
    .map((link) => ({
      key: newDraftKey(),
      mode: 'existing' as const,
      roleId: link.roleId,
      roleName: link.role?.roleName,
      color: link.role?.color || 'blue',
      description: link.role?.description || '',
      permissionIds: new Set<string>(),
      rank: link.rank,
      expanded: false,
    }));
}

interface DepartmentRolesEditorProps {
  value: DepartmentRoleDraft[];
  onChange: (next: DepartmentRoleDraft[]) => void;
  predefinedRoles: Role[];
  permissions: Record<string, Permission[]>;
  error?: string;
}

export const DepartmentRolesEditor: React.FC<DepartmentRolesEditorProps> = ({
  value,
  onChange,
  predefinedRoles,
  permissions,
  error,
}) => {
  const effectivePermissions = useMemo(
    () => mergePermissionMaps(Object.keys(permissions || {}).length > 0 ? permissions : buildFallbackPermissionsMap()),
    [permissions],
  );

  const usedRoleIds = useMemo(
    () => new Set(value.filter((d) => d.mode === 'existing' && d.roleId).map((d) => d.roleId as string)),
    [value],
  );

  const addExisting = () => {
    const nextRank = value.length > 0 ? Math.max(...value.map((d) => d.rank)) + 1 : 1;
    onChange([
      ...value,
      {
        key: newDraftKey(),
        mode: 'existing',
        roleId: '',
        color: 'blue',
        permissionIds: new Set(),
        rank: nextRank,
        expanded: true,
      },
    ]);
  };

  const addNew = () => {
    const nextRank = value.length > 0 ? Math.max(...value.map((d) => d.rank)) + 1 : 1;
    onChange([
      ...value,
      {
        key: newDraftKey(),
        mode: 'new',
        roleName: '',
        description: '',
        color: 'blue',
        permissionIds: new Set(),
        rank: nextRank,
        expanded: true,
      },
    ]);
  };

  const updateDraft = (key: string, patch: Partial<DepartmentRoleDraft>) => {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDraft = (key: string) => {
    onChange(value.filter((d) => d.key !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">Department roles & hierarchy</p>
          <p className="text-xs text-slate-500">
            Rank 1 is the highest authority. Members report to roles with a lower rank number.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addExisting}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} />
            Add existing role
          </button>
          <button
            type="button"
            onClick={addNew}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Plus size={14} />
            Create new role
          </button>
        </div>
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Add at least one role for this department. New team members will only see these roles.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((draft) => (
            <DepartmentRoleRow
              key={draft.key}
              draft={draft}
              predefinedRoles={predefinedRoles}
              usedRoleIds={usedRoleIds}
              effectivePermissions={effectivePermissions}
              onUpdate={(patch) => updateDraft(draft.key, patch)}
              onRemove={() => removeDraft(draft.key)}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

function DepartmentRoleRow({
  draft,
  predefinedRoles,
  usedRoleIds,
  effectivePermissions,
  onUpdate,
  onRemove,
}: {
  draft: DepartmentRoleDraft;
  predefinedRoles: Role[];
  usedRoleIds: Set<string>;
  effectivePermissions: Record<string, Permission[]>;
  onUpdate: (patch: Partial<DepartmentRoleDraft>) => void;
  onRemove: () => void;
}) {
  const availableRoles = predefinedRoles.filter(
    (r) => r.roleName !== 'Super Admin' && (!usedRoleIds.has(r.id) || r.id === draft.roleId),
  );

  const togglePermission = (permissionId: string) => {
    const next = new Set(draft.permissionIds);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    onUpdate({ permissionIds: next });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-20 space-y-1">
          <label className="text-[11px] font-semibold text-slate-600">Rank</label>
          <input
            type="number"
            min={1}
            value={draft.rank}
            onChange={(e) => onUpdate({ rank: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          />
        </div>

        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-[11px] font-semibold text-slate-600">
            {draft.mode === 'existing' ? 'Predefined role' : 'New role name'}
          </label>
          {draft.mode === 'existing' ? (
            <select
              value={draft.roleId || ''}
              onChange={(e) => {
                const role = predefinedRoles.find((r) => r.id === e.target.value);
                onUpdate({
                  roleId: e.target.value,
                  roleName: role?.roleName,
                  color: role?.color || 'blue',
                });
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select role</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.roleName}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={draft.roleName || ''}
              onChange={(e) => onUpdate({ roleName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g. Team Lead"
            />
          )}
        </div>

        <div className="flex items-end gap-1 pt-5">
          <button
            type="button"
            onClick={() => onUpdate({ expanded: !draft.expanded })}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
            title={draft.expanded ? 'Collapse' : 'Expand'}
          >
            {draft.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
            title="Remove role"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {draft.expanded && draft.mode === 'new' && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">Color</label>
              <select
                value={draft.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {ROLE_COLORS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] font-semibold text-slate-600">Description</label>
              <input
                type="text"
                value={draft.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Permissions</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
              <PermissionPicker
                permissionsByModule={effectivePermissions}
                selectedIds={draft.permissionIds}
                onToggle={togglePermission}
                onModuleSelectAll={(module) => {
                  const modulePermissions = effectivePermissions[module] || [];
                  const allSelected = modulePermissions.every((p) => draft.permissionIds.has(p.id));
                  const next = new Set(draft.permissionIds);
                  modulePermissions.forEach((p) => {
                    if (allSelected) next.delete(p.id);
                    else next.add(p.id);
                  });
                  onUpdate({ permissionIds: next });
                }}
                maxHeightClass="max-h-40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function validateDepartmentRoleDrafts(drafts: DepartmentRoleDraft[]): string | null {
  if (drafts.length === 0) {
    return 'Add at least one role for this department';
  }

  const ranks = drafts.map((d) => d.rank);
  if (new Set(ranks).size !== ranks.length) {
    return 'Each role must have a unique rank';
  }

  for (const draft of drafts) {
    if (draft.mode === 'existing' && !draft.roleId) {
      return 'Select a role for each predefined entry';
    }
    if (draft.mode === 'new') {
      if (!draft.roleName?.trim()) return 'Enter a name for each new role';
      if (draft.permissionIds.size === 0) return 'Select permissions for each new role';
    }
  }

  return null;
}
