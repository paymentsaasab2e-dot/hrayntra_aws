import React from 'react';
import { Check, X } from 'lucide-react';
import type { SystemRole } from '../../types/team';

interface PortalAccessPreviewProps {
  role?: SystemRole | null;
}

export const PortalAccessPreview: React.FC<PortalAccessPreviewProps> = ({ role }) => {
  if (!role || !role.permissions || role.permissions.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">No role selected</p>
      </div>
    );
  }

  // Group permissions by module
  const modules = role.permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, typeof role.permissions>);

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">Portal Access Preview</h4>
      <div className="space-y-3">
        {Object.entries(modules).map(([module, permissions]) => (
          <div key={module} className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">{module}</p>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <span className="text-sm text-slate-700">
                {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
