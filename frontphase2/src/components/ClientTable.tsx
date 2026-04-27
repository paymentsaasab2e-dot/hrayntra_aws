import React, { useRef, useState } from 'react';
import { Eye, Pencil, Briefcase, Check, Trash2, Upload } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { Client, ClientStage } from '@/app/client/types';
import { apiUpdateClient, filesApiUpload } from '../lib/api';
import { requestError, requestWarning } from '../lib/appDialog';

const stageColors: Record<ClientStage, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Inactive: 'bg-slate-100 text-slate-700',
  'Hot Clients 🔥': 'bg-red-100 text-red-700',
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
}

// Custom Checkbox Component for better design tool compatibility
const CustomCheckbox = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
  <div 
    onClick={onChange}
    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
      checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
    }`}
  >
    {checked && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
  </div>
);

export function ClientTable({ clients, selectedIds, onSelectionChange, onSelectClient, onEditClient, onDeleteClient, onLogoUpdated, onCreateJob }: ClientTableProps) {
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoFileChange}
        className="hidden"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <CustomCheckbox 
                  checked={selectedIds.length === clients.length && clients.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">Client Name</div>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recruiter</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Activity</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr
                key={client.id}
                className={`hover:bg-blue-50/50 transition-colors group ${selectedIds.includes(client.id) ? 'bg-blue-50/80' : ''}`}
              >
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  <CustomCheckbox
                    checked={selectedIds.includes(client.id)}
                    onChange={() => toggleSelect(client.id)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 bg-white group/logo">
                      <ImageWithFallback src={client.logo} alt={client.name} className="w-full h-full object-cover" />
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
                          <Upload className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectClient?.(client)}
                        className="font-semibold text-slate-900 text-left hover:text-blue-600 transition-colors"
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
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${stageColors[client.stage] ?? 'bg-slate-100 text-slate-600'}`}>
                    {client.stage}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <ImageWithFallback src={client.owner.avatar} alt={client.owner.name} className="w-6 h-6 rounded-full border border-slate-200" />
                    <span className="text-xs font-medium text-slate-700">{client.owner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-slate-500">{client.lastActivity}</td>
                <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-100">
                    <button
                      type="button"
                      onClick={() => onSelectClient?.(client)}
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-all"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditClient?.(client)}
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-amber-600 transition-all"
                      title="Edit Client"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateJob?.(client)}
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-emerald-600 transition-all"
                      title="Create Job for Client"
                    >
                      <Briefcase className="w-4 h-4" />
                    </button>
                    {onDeleteClient && (
                      <button
                        type="button"
                        onClick={() => onDeleteClient(client.id)}
                        className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-red-600 transition-all"
                        title="Delete Client"
                      >
                        <Trash2 className="w-4 h-4" />
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
