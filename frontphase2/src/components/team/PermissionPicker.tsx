'use client';

import React, { useMemo } from 'react';
import type { Permission } from '../../types/team';
import {
  applyDashboardLevelToSelectedIds,
  dashboardLevelFromSelectedIds,
  findPermissionIdsByNames,
  DASHBOARD_LEVEL_PERMISSIONS,
  DASHBOARD_PEOPLE_FOLLOW_TEAM,
  formatPermissionLabel,
  isDashboardHiddenTickPermission,
  sortModules,
  type RoleDashboardLevelChoice,
} from './permissionCatalog';

type PermissionPickerProps = {
  permissionsByModule: Record<string, Permission[]>;
  selectedIds: Set<string>;
  onToggle: (permissionId: string) => void;
  onModuleSelectAll: (module: string) => void;
  /** When set, Dashboard level dropdown replaces the selected set. */
  onSelectionChange?: (next: Set<string>) => void;
  disabled?: boolean;
  maxHeightClass?: string;
  /** Optional module order (HQ Team uses sidebar-aligned order). */
  moduleOrder?: string[];
};

export function PermissionPicker({
  permissionsByModule,
  selectedIds,
  onToggle,
  onModuleSelectAll,
  onSelectionChange,
  disabled = false,
  maxHeightClass = 'max-h-[420px]',
  moduleOrder,
}: PermissionPickerProps) {
  const modules = moduleOrder?.length
    ? [...Object.keys(permissionsByModule)].sort((a, b) => {
        const aIndex = moduleOrder.indexOf(a);
        const bIndex = moduleOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
    : sortModules(Object.keys(permissionsByModule));

  const levelIdByName = useMemo(
    () => findPermissionIdsByNames(permissionsByModule, DASHBOARD_LEVEL_PERMISSIONS),
    [permissionsByModule],
  );

  const dashboardLevel = dashboardLevelFromSelectedIds(selectedIds, levelIdByName);

  const filteredByModule = useMemo(() => {
    const out: Record<string, Permission[]> = {};
    for (const [module, list] of Object.entries(permissionsByModule)) {
      out[module] = (list || []).filter((p) => !isDashboardHiddenTickPermission(p.permissionName));
    }
    return out;
  }, [permissionsByModule]);

  const syncPeopleWithTeam = (next: Set<string>) => {
    const nameToId = findPermissionIdsByNames(permissionsByModule, [
      ...Object.keys(DASHBOARD_PEOPLE_FOLLOW_TEAM),
      ...Object.values(DASHBOARD_PEOPLE_FOLLOW_TEAM),
    ]);
    for (const [teamName, peopleName] of Object.entries(DASHBOARD_PEOPLE_FOLLOW_TEAM)) {
      const teamId = nameToId[teamName] || teamName;
      const peopleId = nameToId[peopleName] || peopleName;
      if (next.has(teamId) || next.has(teamName)) next.add(peopleId);
      else {
        next.delete(peopleId);
        next.delete(peopleName);
      }
    }
    return next;
  };

  const handleToggle = (permissionId: string) => {
    if (disabled) return;
    if (!onSelectionChange) {
      onToggle(permissionId);
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    onSelectionChange(syncPeopleWithTeam(next));
  };

  const handleModuleSelectAll = (module: string) => {
    if (disabled) return;
    if (!onSelectionChange) {
      onModuleSelectAll(module);
      return;
    }
    const modulePermissions = filteredByModule[module] || [];
    const allSelected =
      modulePermissions.length > 0 &&
      modulePermissions.every((p) => selectedIds.has(p.id));
    const next = new Set(selectedIds);
    modulePermissions.forEach((p) => {
      if (allSelected) next.delete(p.id);
      else next.add(p.id);
    });
    onSelectionChange(syncPeopleWithTeam(next));
  };

  const setDashboardLevel = (level: RoleDashboardLevelChoice) => {
    if (disabled) return;
    const next = applyDashboardLevelToSelectedIds(selectedIds, level, levelIdByName);
    if (onSelectionChange) {
      onSelectionChange(syncPeopleWithTeam(next));
      return;
    }
    const before = dashboardLevelFromSelectedIds(selectedIds, levelIdByName);
    if (before === level) return;
    const prevId =
      before === 'tenant'
        ? levelIdByName.dash_full_scope
        : before === 'company'
          ? levelIdByName.dash_company_scope
          : before === 'department'
            ? levelIdByName.dash_dept_scope
            : null;
    const nextId =
      level === 'tenant'
        ? levelIdByName.dash_full_scope
        : level === 'company'
          ? levelIdByName.dash_company_scope
          : level === 'department'
            ? levelIdByName.dash_dept_scope
            : null;
    if (prevId) onToggle(prevId);
    if (nextId) onToggle(nextId);
  };

  if (!modules.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Loading permissions…</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 overflow-y-auto ${maxHeightClass}`}>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Dashboard level</h4>
        <select
          value={dashboardLevel}
          onChange={(e) => setDashboardLevel(e.target.value as RoleDashboardLevelChoice)}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="self">My work — assigned records only</option>
          <option value="department">My department — everyone in the department</option>
          <option value="company">This company — company / branch records</option>
          <option value="tenant">Whole tenant — all companies</option>
        </select>
      </div>

      {modules.map((module) => {
        const modulePermissions = filteredByModule[module] || [];
        if (!modulePermissions.length) return null;
        const allSelected =
          modulePermissions.length > 0 &&
          modulePermissions.every((p) => selectedIds.has(p.id));

        return (
          <div key={module} className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{module}</h4>
                <p className="text-[10px] text-slate-400">
                  {modulePermissions.filter((p) => selectedIds.has(p.id)).length} /{' '}
                  {modulePermissions.length} selected
                </p>
              </div>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => handleModuleSelectAll(module)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {modulePermissions.map((permission) => (
                <label
                  key={permission.id}
                  className={`flex items-start gap-2 rounded-lg p-2 transition-colors ${
                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(permission.id)}
                    onChange={() => handleToggle(permission.id)}
                    disabled={disabled}
                    className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800">
                      {formatPermissionLabel(permission.permissionName)}
                    </span>
                    {permission.description ? (
                      <span className="block text-[11px] text-slate-500">{permission.description}</span>
                    ) : null}
                    <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                      {permission.permissionName}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
