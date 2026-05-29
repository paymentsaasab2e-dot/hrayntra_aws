import React, { useRef, useState } from 'react';
import { Pencil, Briefcase, Check, Trash2, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../constants/tableUi';
import { TableBrandAvatar } from './ui/TableBrandAvatar';
import type { Client } from '@/app/client/types';
import { apiUpdateClient, filesApiUpload } from '../lib/api';
import { requestError, requestWarning } from '../lib/appDialog';
import { TableAuditColumnHeader, TableAuditCell } from './table/TableAuditCell';

const leadStatusColors: Record<string, string> = {
  New: 'bg-blue-500/10 text-blue-800 ring-1 ring-blue-500/20',
  Contacted: 'bg-amber-500/10 text-amber-900 ring-1 ring-amber-500/20',
  Qualified: 'bg-violet-500/10 text-violet-800 ring-1 ring-violet-500/20',
  Converted: 'bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/20',
  Lost: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/25',
};

function mergeStatusOptionsForRow(options: string[], current?: string | null) {
  const normalized = String(current || '').trim();
  if (!normalized) return options;
  if (options.some((option) => option.toLowerCase() === normalized.toLowerCase())) {
    return options;
  }
  return [...options, normalized];
}

interface ClientTableProps {
  clients: Client[];
  dynamicColumnLabels?: string[];
  getDynamicFieldValue?: (client: Client, label: string) => string;
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSelectClient?: (client: Client) => void;
  onEditClient?: (client: Client) => void;
  onDeleteClient?: (id: string) => void;
  onLogoUpdated?: () => void;
  onCreateJob?: (client: Client) => void;
  /** When false, the "Create job" button is rendered disabled with a permission tooltip. */
  canCreateJob?: boolean;
  /** Lead-style status options (defaults + org catalog). */
  clientLeadStatusOptions?: string[];
  /** When true, lead status is editable inline in the table. */
  canUpdateLeadStatus?: boolean;
  onLeadStatusChange?: (clientId: string, newStatus: string) => void;
  /** Inline status change with optional remark (matches Leads table). */
  statusEditClientId?: string | null;
  statusEditRemark?: string;
  onStatusEditRemarkChange?: (remark: string) => void;
  onSaveStatusEdit?: () => void;
  onCancelStatusEdit?: () => void;
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
  dynamicColumnLabels = [],
  getDynamicFieldValue,
  selectedIds,
  onSelectionChange,
  onSelectClient,
  onEditClient,
  onDeleteClient,
  onLogoUpdated,
  onCreateJob,
  canCreateJob = true,
  clientLeadStatusOptions = [],
  canUpdateLeadStatus = false,
  onLeadStatusChange,
  statusEditClientId = null,
  statusEditRemark = '',
  onStatusEditRemarkChange,
  onSaveStatusEdit,
  onCancelStatusEdit,
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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoFileChange}
        className="hidden"
      />
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em]">
              <th className="w-10 px-3 sm:px-4 py-2 first:pl-4">
                <CustomCheckbox
                  checked={selectedIds.length === clients.length && clients.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 sm:px-4 py-2">
                <button
                  type="button"
                  onClick={onToggleClientNameSortOrder}
                  className="flex cursor-pointer items-center gap-1 text-indigo-950/55 transition-colors hover:text-indigo-900"
                  title={`Sort client names ${clientNameSortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  <span>Client Name</span>
                  {clientNameSortOrder === 'asc' ? (
                    <ArrowUp className="h-3 w-3 text-indigo-400/90" strokeWidth={2.5} />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-indigo-400/90" strokeWidth={2.5} />
                  )}
                </button>
              </th>
              <th className="px-3 sm:px-4 py-2">Industry</th>
              <th className="px-3 sm:px-4 py-2">Location</th>
              {dynamicColumnLabels.map((label) => (
                <th key={label} className="px-3 sm:px-4 py-2">
                  {label}
                </th>
              ))}
              <th className="px-3 sm:px-4 py-2">Lead Status</th>
              <th className="px-3 sm:px-4 py-2">Recruiter</th>
              <TableAuditColumnHeader />
              <th className="px-3 sm:px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {clients.map((client) => (
              <tr
                key={client.id}
                className={`group transition-colors duration-200 even:bg-slate-50/35 hover:bg-indigo-50/45 ${
                  selectedIds.includes(client.id) ? 'bg-indigo-50/90 hover:bg-indigo-50/95' : ''
                }`}
              >
                <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <CustomCheckbox
                    checked={selectedIds.includes(client.id)}
                    onChange={() => toggleSelect(client.id)}
                  />
                </td>
                <td className="px-3 sm:px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-8 w-8 shrink-0 overflow-visible rounded-full group/logo">
                      <TableBrandAvatar
                        src={client.logo}
                        name={client.name}
                        size="md"
                        showStatusDot={client.stage === 'Active' || client.stage === 'Hot Clients 🔥'}
                        statusDotTitle={
                          client.stage === 'Hot Clients 🔥'
                            ? 'Hot client'
                            : client.stage === 'Active'
                              ? 'Active client'
                              : 'Active account'
                        }
                      />
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
                        className="block truncate text-left text-xs font-semibold text-slate-900 transition-colors hover:text-indigo-700"
                        title="View client details"
                      >
                        {client.name}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">{client.industry}</td>
                <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">{client.location}</td>
                {dynamicColumnLabels.map((label) => {
                  const value = getDynamicFieldValue?.(client, label) ?? '';
                  return (
                    <td key={`${client.id}-${label}`} className="px-3 sm:px-4 py-2">
                      <span className="line-clamp-2 text-xs text-slate-700">{value || '—'}</span>
                    </td>
                  );
                })}
                <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  {canUpdateLeadStatus && onLeadStatusChange ? (
                    <div className="flex flex-col gap-1.5">
                      <select
                        className="max-w-[10rem] cursor-pointer rounded-full border-0 bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        value={client.leadStatus || 'New'}
                        onChange={(e) => onLeadStatusChange(client.id, e.target.value)}
                      >
                        {mergeStatusOptionsForRow(clientLeadStatusOptions, client.leadStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {statusEditClientId === client.id && onSaveStatusEdit && onCancelStatusEdit ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Add remark for this status change"
                            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={statusEditRemark}
                            onChange={(e) => onStatusEditRemarkChange?.(e.target.value)}
                          />
                          <button
                            type="button"
                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            onClick={onSaveStatusEdit}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                            onClick={onCancelStatusEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : client.leadStatus ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        leadStatusColors[client.leadStatus] ?? 'bg-indigo-500/10 text-indigo-800 ring-1 ring-indigo-500/20'
                      }`}
                    >
                      {client.leadStatus}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-2">
                  <div className="flex items-center gap-2">
                    <TableBrandAvatar
                      src={client.owner.avatar}
                      name={client.owner.name}
                      size="xs"
                      showStatusDot={false}
                      alt={client.owner.name}
                    />
                    <span className="text-[11px] font-medium text-slate-700">{client.owner.name}</span>
                  </div>
                </td>
                <TableAuditCell audit={client.auditMeta} />
                <td className="px-3 sm:px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center justify-end gap-0.5 rounded-xl bg-slate-100/70 p-0.5 ring-1 ring-slate-200/60">
                    {SHOW_TABLE_ROW_EDIT_ICON ? (
                      <button
                        type="button"
                        onClick={() => onEditClient?.(client)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-white hover:text-amber-800 hover:shadow-sm transition-all"
                        title="Edit Client"
                      >
                        <Pencil size={15} strokeWidth={2.35} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!canCreateJob) return;
                        onCreateJob?.(client);
                      }}
                      disabled={!canCreateJob}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                        canCreateJob
                          ? 'text-orange-600 hover:bg-white hover:text-orange-800 hover:shadow-sm'
                          : 'cursor-not-allowed text-slate-300'
                      }`}
                      title={canCreateJob ? 'Create Job for Client' : "You don't have permission to create jobs"}
                      aria-disabled={!canCreateJob}
                    >
                      <Briefcase size={15} strokeWidth={2.35} />
                    </button>
                    {onDeleteClient && (
                      <button
                        type="button"
                        onClick={() => onDeleteClient(client.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-white hover:text-rose-800 hover:shadow-sm transition-all"
                        title="Delete Client"
                      >
                        <Trash2 size={15} strokeWidth={2.35} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
