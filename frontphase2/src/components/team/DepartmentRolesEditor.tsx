'use client';

import React, { useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DepartmentRoleInput, Permission, Role } from '../../types/team';
import { PermissionPicker } from './PermissionPicker';
import {
  buildFallbackPermissionsMap,
  defaultEveryonePermissionIds,
  isDashboardHiddenTickPermission,
  mergePermissionMaps,
} from './permissionCatalog';

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

function roleLabel(draft: DepartmentRoleDraft) {
  if (draft.mode === 'existing') {
    return draft.roleName?.trim() || 'Predefined role';
  }
  return draft.roleName?.trim() || 'New role';
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
  panel?: 'list' | 'permissions' | 'combined';
  activeKey?: string | null;
  onActiveKeyChange?: (key: string | null) => void;
}

export const DepartmentRolesEditor: React.FC<DepartmentRolesEditorProps> = ({
  value,
  onChange,
  predefinedRoles,
  permissions,
  error,
  panel = 'combined',
  activeKey = null,
  onActiveKeyChange,
}) => {
  const effectivePermissions = useMemo(
    () => mergePermissionMaps(Object.keys(permissions || {}).length > 0 ? permissions : buildFallbackPermissionsMap()),
    [permissions],
  );

  const usedRoleIds = useMemo(
    () => new Set(value.filter((d) => d.mode === 'existing' && d.roleId).map((d) => d.roleId as string)),
    [value],
  );

  const sortedDrafts = useMemo(
    () => [...value].sort((a, b) => a.rank - b.rank),
    [value],
  );

  const activeDraft = useMemo(
    () => value.find((draft) => draft.key === activeKey) || null,
    [value, activeKey],
  );

  useEffect(() => {
    if (!onActiveKeyChange) return;
    if (value.length === 0) {
      if (activeKey) onActiveKeyChange(null);
      return;
    }
    if (!activeKey || !value.some((draft) => draft.key === activeKey)) {
      onActiveKeyChange(value[value.length - 1].key);
    }
  }, [value, activeKey, onActiveKeyChange]);

  const addExisting = () => {
    const nextRank = value.length > 0 ? Math.max(...value.map((d) => d.rank)) + 1 : 1;
    const key = newDraftKey();
    onChange([
      ...value,
      {
        key,
        mode: 'existing',
        roleId: '',
        color: 'blue',
        permissionIds: new Set(),
        rank: nextRank,
        expanded: true,
      },
    ]);
    onActiveKeyChange?.(key);
  };

  const addNew = () => {
    const nextRank = value.length > 0 ? Math.max(...value.map((d) => d.rank)) + 1 : 1;
    const key = newDraftKey();
    onChange([
      ...value,
      {
        key,
        mode: 'new',
        roleName: '',
        description: '',
        color: 'blue',
        permissionIds: new Set(defaultEveryonePermissionIds(effectivePermissions)),
        rank: nextRank,
        expanded: true,
      },
    ]);
    onActiveKeyChange?.(key);
  };

  const updateDraft = (key: string, patch: Partial<DepartmentRoleDraft>) => {
    onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDraft = (key: string) => {
    onChange(value.filter((d) => d.key !== key));
    if (activeKey === key) {
      const remaining = value.filter((d) => d.key !== key);
      onActiveKeyChange?.(remaining.length > 0 ? remaining[remaining.length - 1].key : null);
    }
  };

  if (panel === 'permissions') {
    return (
      <div className="flex h-full min-h-[min(28rem,calc(100vh-14rem))] flex-col rounded-xl border border-slate-200 bg-slate-50/40">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Permissions</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Select what this role can access in the platform.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {!activeDraft ? (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 text-center">
              <p className="text-sm font-semibold text-slate-800">No role selected</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Select a new role on the left to assign permissions here.
              </p>
            </div>
          ) : activeDraft.mode === 'existing' ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
              Permissions for predefined roles are managed in the Roles section. On the left, set
              rank and which existing role belongs to this department.
            </div>
          ) : (
            <DepartmentRolePermissionsPanel
              draft={activeDraft}
              effectivePermissions={effectivePermissions}
              onUpdate={(patch) => updateDraft(activeDraft.key, patch)}
            />
          )}
        </div>
      </div>
    );
  }

  const listSection = (
    <>
      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">Department roles & hierarchy</p>
          <p className="text-xs text-slate-500">
            Rank 1 is the highest authority. Members report to roles with a lower rank number.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {sortedDrafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Add at least one role for this department. New team members will only see these roles.
        </p>
      ) : (
        <div className="space-y-2">
          {sortedDrafts.map((draft) => {
            const isActive = draft.key === activeKey;
            return (
              <div
                key={draft.key}
                role="button"
                tabIndex={0}
                onClick={() => onActiveKeyChange?.(draft.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActiveKeyChange?.(draft.key);
                  }
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-200/80'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                  {draft.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {roleLabel(draft)}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {draft.mode === 'new' ? 'New role' : 'Existing role'} · Rank {draft.rank}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDraft(draft.key);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  title="Remove role"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const detailSection = (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Permissions</p>
        <p className="mt-0.5 text-xs text-slate-500">Select what this role can access.</p>
      </div>
      <div className="p-4">
        {!activeDraft || activeDraft.mode !== 'new' ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-xs text-slate-500">
            {activeDraft?.mode === 'existing'
              ? 'Predefined roles use permissions from the Roles section.'
              : 'Create and select a new role on the left to assign permissions.'}
          </div>
        ) : (
          <DepartmentRolePermissionsPanel
            draft={activeDraft}
            effectivePermissions={effectivePermissions}
            onUpdate={(patch) => updateDraft(activeDraft.key, patch)}
          />
        )}
      </div>
    </div>
  );

  if (panel === 'combined') {
    return (
      <div className="space-y-5">
        {listSection}
        {activeDraft ? (
          <DepartmentRoleFieldsPanel
            draft={activeDraft}
            predefinedRoles={predefinedRoles}
            usedRoleIds={usedRoleIds}
            onUpdate={(patch) => updateDraft(activeDraft.key, patch)}
            onRemove={() => removeDraft(activeDraft.key)}
          />
        ) : null}
        {detailSection}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {listSection}

      {activeDraft ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <DepartmentRoleFieldsPanel
            draft={activeDraft}
            predefinedRoles={predefinedRoles}
            usedRoleIds={usedRoleIds}
            onUpdate={(patch) => updateDraft(activeDraft.key, patch)}
            onRemove={() => removeDraft(activeDraft.key)}
          />
        </div>
      ) : null}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

function DepartmentRoleFieldsPanel({
  draft,
  predefinedRoles,
  usedRoleIds,
  onUpdate,
  onRemove,
}: {
  draft: DepartmentRoleDraft;
  predefinedRoles: Role[];
  usedRoleIds: Set<string>;
  onUpdate: (patch: Partial<DepartmentRoleDraft>) => void;
  onRemove: () => void;
}) {
  const availableRoles = predefinedRoles.filter(
    (r) => r.roleName !== 'Super Admin' && (!usedRoleIds.has(r.id) || r.id === draft.roleId),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {draft.mode === 'new' ? 'New role' : 'Existing role'}
          </p>
          <p className="text-xs text-slate-500">
            {draft.mode === 'new'
              ? 'Define name, color, and description for this department role.'
              : 'Link a predefined role and set its rank in this department.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[5rem_1fr]">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">Rank</label>
          <input
            type="number"
            min={1}
            value={draft.rank}
            onChange={(e) => onUpdate({ rank: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <p className="text-[10px] leading-snug text-slate-400">
            Unique per department. Rank 1 = full dashboard stats + My work (approvals on by default). Rank 2+ = own records unless Complete dashboard stats. Tick My work: approvals on a role that has Approvals / tasks.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
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
      </div>

      {draft.mode === 'new' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Color</label>
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
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Description</label>
            <input
              type="text"
              value={draft.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DepartmentRolePermissionsPanel({
  draft,
  effectivePermissions,
  onUpdate,
}: {
  draft: DepartmentRoleDraft;
  effectivePermissions: Record<string, Permission[]>;
  onUpdate: (patch: Partial<DepartmentRoleDraft>) => void;
}) {
  const togglePermission = (permissionId: string) => {
    const next = new Set(draft.permissionIds);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    onUpdate({ permissionIds: next });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <PermissionPicker
        permissionsByModule={effectivePermissions}
        selectedIds={draft.permissionIds}
        onToggle={togglePermission}
        onModuleSelectAll={(module) => {
          const modulePermissions = (effectivePermissions[module] || []).filter(
            (p) => !isDashboardHiddenTickPermission(p.permissionName),
          );
          const allSelected = modulePermissions.every((p) => draft.permissionIds.has(p.id));
          const next = new Set(draft.permissionIds);
          modulePermissions.forEach((p) => {
            if (allSelected) next.delete(p.id);
            else next.add(p.id);
          });
          onUpdate({ permissionIds: next });
        }}
        onSelectionChange={(next) => onUpdate({ permissionIds: next })}
        maxHeightClass="max-h-[min(36rem,calc(100vh-14rem))]"
      />
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
