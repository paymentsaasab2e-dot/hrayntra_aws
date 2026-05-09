import React, { useRef, useState } from 'react';
import { Eye, Pencil, Briefcase, Check, Trash2, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { Client, ClientStage } from '@/app/client/types';
import { apiUpdateClient, filesApiUpload } from '../lib/api';
import { requestError, requestWarning } from '../lib/appDialog';

/** Interviews-style pills: light fill + stronger text */
const stageColors: Record<ClientStage, string> = {
  Active: 'bg-emerald-500/15 text-emerald-800',
  'On Hold': 'bg-amber-500/15 text-amber-800',
  Inactive: 'bg-slate-500/15 text-slate-700',
  'Hot Clients 🔥': 'bg-rose-500/15 text-rose-800',
};

interface ClientTableProps {
  clients: Client[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSelectClient?: (client: Client) => void;
  onEditClient?: (client: Client) => void;
  onDeleteClient?: (id: string) => void;
  onLogoUpdated?: () => void;
  onCreateJob?: (client: Client) => void;
  /** When false, the "Create job" button is rendered disabled with a permission tooltip. */
  canCreateJob?: boolean;
  clientNameSortOrder: 'asc' | 'desc';
  onToggleClientNameSortOrder: () => void;
}

// Custom Checkbox Component for better design tool compatibility
const CustomCheckbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div
    onClick={onChange}
    role="checkbox"
    aria-checked={checked}
    className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 transition-colors ${
      checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white hover:border-blue-400'
    }`}
  >
    {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
  </div>
);

export function ClientTable({
  clients,
  selectedIds,
  onSelectionChange,
  onSelectClient,
  onEditClient,
  onDeleteClient,
  onLogoUpdated,
  onCreateJob,
  canCreateJob = true,
  clientNameSortOrder,
  onToggleClientNameSortOrder,
}: ClientTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
  const [pendingUploadClientId, setPendingUploadClientId] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === clients.length) {
      onSelectionChange([]);
    } else {
      const allIds = clients.map(c => c.id);
      onSelectionChange(allIds);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  const openLogoPicker = (clientId: string) => {
    setPendingUploadClientId(clientId);
    fileInputRef.current?.click();
  };

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !pendingUploadClientId) return;

    if (!file.type.startsWith('image/')) {
      void requestWarning('Please choose an image file (PNG, JPG, WebP, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      void requestWarning('Image must be 5MB or smaller.');
      return;
    }

    try {
      setUploadingClientId(pendingUploadClientId);
      const uploadResponse = await filesApiUpload('client', pendingUploadClientId, file, 'LOGO');
      const logoUrl = uploadResponse.data?.fileUrl;
      if (!logoUrl) {
        throw new Error('Upload succeeded but no image URL was returned.');
      }

      await apiUpdateClient(pendingUploadClientId, { logo: logoUrl });
      onLogoUpdated?.();
    } catch (error: any) {
      console.error('Failed to upload client logo:', error);
      void requestError(error.message || 'Failed to upload client logo');
    } finally {
      setUploadingClientId(null);
      setPendingUploadClientId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoFileChange}
        className="hidden"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/50">
              <th className="w-10 px-4 py-4">
                <CustomCheckbox
                  checked={selectedIds.length === clients.length && clients.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                <button
                  type="button"
                  onClick={onToggleClientNameSortOrder}
                  className="flex cursor-pointer items-center gap-1 transition-colors hover:text-slate-800"
                  title={`Sort client names ${clientNameSortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  <span>Client Name</span>
                  {clientNameSortOrder === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Industry</th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Stage</th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Recruiter</th>
              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Last Activity</th>
              <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr
                key={client.id}
                className={`group transition-colors hover:bg-slate-50/90 ${selectedIds.includes(client.id) ? 'bg-blue-50/70' : ''}`}
              >
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  <CustomCheckbox
                    checked={selectedIds.includes(client.id)}
                    onChange={() => toggleSelect(client.id)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-blue-500/10 group/logo">
                      <ImageWithFallback src={client.logo} alt={client.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLogoPicker(client.id);
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-white opacity-0 transition-opacity group-hover/logo:opacity-100"
                        title="Upload client logo"
                      >
                        {uploadingClientId === client.id ? (
                          <span className="text-[10px] font-semibold">...</span>
                        ) : (
                          <Upload className="h-4 w-4" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectClient?.(client)}
                        className="block truncate text-left text-sm font-semibold text-slate-900 transition-colors hover:text-blue-600"
                        title="View client details"
                      >
                        {client.name}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">{client.industry}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{client.location}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageColors[client.stage] ?? 'bg-slate-500/15 text-slate-700'}`}
                  >
                    {client.stage}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ImageWithFallback
                      src={client.owner.avatar}
                      alt={client.owner.name}
                      className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover"
                    />
                    <span className="text-xs font-medium text-slate-700">{client.owner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-500">{client.lastActivity}</td>
                <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center justify-end gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
                    <button
                      type="button"
                      onClick={() => onSelectClient?.(client)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-white text-blue-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditClient?.(client)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-white text-emerald-600 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50"
                      title="Edit Client"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canCreateJob) return;
                        onCreateJob?.(client);
                      }}
                      disabled={!canCreateJob}
                      className={`flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-white shadow-sm transition-colors ${
                        canCreateJob
                          ? 'text-orange-500 hover:border-orange-200 hover:bg-orange-50'
                          : 'cursor-not-allowed text-slate-300'
                      }`}
                      title={canCreateJob ? 'Create Job for Client' : "You don't have permission to create jobs"}
                      aria-disabled={!canCreateJob}
                    >
                      <Briefcase className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    {onDeleteClient && (
                      <button
                        type="button"
                        onClick={() => onDeleteClient(client.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-white text-red-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50"
                        title="Delete Client"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
