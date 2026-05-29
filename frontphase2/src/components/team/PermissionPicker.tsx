'use client';

import React from 'react';
import type { Permission } from '../../types/team';
import { formatPermissionLabel, sortModules } from './permissionCatalog';

type PermissionPickerProps = {
  permissionsByModule: Record<string, Permission[]>;
  selectedIds: Set<string>;
  onToggle: (permissionId: string) => void;
  onModuleSelectAll: (module: string) => void;
  disabled?: boolean;
  maxHeightClass?: string;
};

export function PermissionPicker({
  permissionsByModule,
  selectedIds,
  onToggle,
  onModuleSelectAll,
  disabled = false,
  maxHeightClass = 'max-h-[420px]',
}: PermissionPickerProps) {
  const modules = sortModules(Object.keys(permissionsByModule));

  if (!modules.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Loading permissions…</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 overflow-y-auto ${maxHeightClass}`}>
      {modules.map((module) => {
        const modulePermissions = permissionsByModule[module] || [];
        const allSelected =
          modulePermissions.length > 0 &&
          modulePermissions.every((p) => selectedIds.has(p.id));

        return (
          <div key={module} className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{module}</h4>
                <p className="text-[10px] text-slate-400">
                  {modulePermissions.filter((p) => selectedIds.has(p.id)).length} / {modulePermissions.length} selected
                </p>
              </div>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onModuleSelectAll(module)}
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
                    onChange={() => onToggle(permission.id)}
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
