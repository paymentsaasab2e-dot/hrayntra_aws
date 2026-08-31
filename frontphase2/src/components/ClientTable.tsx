import React, { useRef, useState } from 'react';
import { Pencil, Briefcase, Check, Trash2, Upload, ArrowUp, ArrowDown, ArrowRightLeft, RefreshCcw, Send } from 'lucide-react';
import { SHOW_TABLE_ROW_EDIT_ICON } from '../constants/tableUi';
import { TableBrandAvatar } from './ui/TableBrandAvatar';
import type { Client } from '@/app/client/types';
import type { AiWorkspaceBriefAlert } from '@/lib/apiAiWorkspaceBrief';
import { WorkspaceAlertTableCell, WorkspaceAlertTableHeader } from './ai/WorkspaceAlertTableCell';
import { apiUpdateClient, filesApiUpload } from '../lib/api';
import { requestError, requestWarning } from '../lib/appDialog';
import { TableAuditColumnHeader, TableAuditCell } from './table/TableAuditCell';
import {
  clientStatusBadgeClass,
  resolveClientStatusLabel,
} from '../lib/clientLifecycleStatus';
import type { ClientHandoffRequestInfo } from '../lib/clientHandoffStatus';
import { canInitiateClientHandoff } from '../lib/clientHandoffStatus';

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
  canSendToRecruitment?: boolean;
  sendingToRecruitmentIds?: string[];
  onSendToRecruitment?: (client: Client) => void;
  /** @deprecated Prefer passing `onHandoffClient` only when the user may hand off. */
  canHandoffClient?: boolean;
  /** When provided, shows the hand-off action in the row toolbar. */
  onHandoffClient?: (client: Client) => void;
  /** Latest cross-dept handoff state per client for the current sender. */
  getClientHandoffStatus?: (clientId: string) => ClientHandoffRequestInfo | undefined;
  /** Org status catalog (defaults + custom). */
  clientStatusOptions?: string[];
  /** When true, client status is editable inline in the table. */
  canUpdateClientStatus?: boolean;
  onClientStatusChange?: (clientId: string, newStatus: string) => void;
  clientNameSortOrder: 'asc' | 'desc';
  /** Default is recent activity; name sort activates when the Client Name header is clicked. */
  clientSortBy?: 'activity' | 'name';
  onToggleClientNameSortOrder: () => void;
  showStatusColumn?: boolean;
  showRecruiterColumn?: boolean;
  /** Latest AI workspace brief alerts keyed by entity id (from Analyze). */
  workspaceAlertsByEntityId?: Record<string, AiWorkspaceBriefAlert[]>;
  /** @deprecated Use workspaceAlertsByEntityId */
  workspaceAlertsByClientId?: Record<string, AiWorkspaceBriefAlert[]>;
  /** When true, omit overflow wrappers so a parent scroll region owns scrolling. */
  fillScrollParent?: boolean;
  /** Persistable column visibility; locked columns (select/client/actions) stay shown. */
  isColumnVisible?: (id: string) => boolean;
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
  canSendToRecruitment = false,
  sendingToRecruitmentIds = [],
  onSendToRecruitment,
  onHandoffClient,
  getClientHandoffStatus,
  clientStatusOptions = [],
  canUpdateClientStatus = false,
  onClientStatusChange,
  clientNameSortOrder,
  clientSortBy = 'activity',
  onToggleClientNameSortOrder,
  showStatusColumn = false,
  showRecruiterColumn = false,
  workspaceAlertsByEntityId,
  workspaceAlertsByClientId,
  fillScrollParent = false,
  isColumnVisible = () => true,
}: ClientTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
  const [pendingUploadClientId, setPendingUploadClientId] = useState<string | null>(null);
  const show = isColumnVisible;

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

  const resolvedWorkspaceAlerts =
    workspaceAlertsByEntityId ?? workspaceAlertsByClientId ?? undefined;

  const showAiAlertColumn = Boolean(
    resolvedWorkspaceAlerts &&
      Object.values(resolvedWorkspaceAlerts).some((alerts) => alerts.length > 0),
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoFileChange}
        className="hidden"
      />
      <div className={fillScrollParent ? 'contents' : 'no-scrollbar overflow-x-auto'}>
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-50/95 via-indigo-50/50 to-violet-50/40 border-b border-indigo-100/50 text-indigo-950/45 uppercase text-[9px] font-bold tracking-[0.12em] backdrop-blur-sm">
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
                  title={
                    clientSortBy === 'name'
                      ? `Sort client names ${clientNameSortOrder === 'asc' ? 'descending' : 'ascending'}`
                      : 'Sort by client name'
                  }
                >
                  <span>Client Name</span>
                  {clientSortBy === 'name' ? (
                    clientNameSortOrder === 'asc' ? (
                      <ArrowUp className="h-3 w-3 text-indigo-400/90" strokeWidth={2.5} />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-indigo-400/90" strokeWidth={2.5} />
                    )
                  ) : null}
                </button>
              </th>
              {show('industry') ? <th className="px-3 sm:px-4 py-2">Industry</th> : null}
              {show('location') ? <th className="px-3 sm:px-4 py-2">Location</th> : null}
              {dynamicColumnLabels.map((label) => (
                <th key={label} className="px-3 sm:px-4 py-2">
                  {label}
                </th>
              ))}
              {showStatusColumn && show('status') ? <th className="px-3 sm:px-4 py-2">Status</th> : null}
              {showRecruiterColumn && show('owner') ? (
                <th className="px-3 sm:px-4 py-2">Team Member</th>
              ) : null}
              {show('openJobs') ? <th className="px-3 sm:px-4 py-2">Open jobs</th> : null}
              {show('placements') ? <th className="px-3 sm:px-4 py-2">Placements</th> : null}
              {show('lastActivity') ? <th className="px-3 sm:px-4 py-2">Last activity</th> : null}
              {show('priority') ? <th className="px-3 sm:px-4 py-2">Priority</th> : null}
              {show('companySize') ? <th className="px-3 sm:px-4 py-2">Company size</th> : null}
              {show('revenue') ? <th className="px-3 sm:px-4 py-2">Revenue</th> : null}
              {show('nextFollowUp') ? <th className="px-3 sm:px-4 py-2">Next follow-up</th> : null}
              {show('clientSince') ? <th className="px-3 sm:px-4 py-2">Client since</th> : null}
              {show('website') ? <th className="px-3 sm:px-4 py-2">Website</th> : null}
              {show('timezone') ? <th className="px-3 sm:px-4 py-2">Timezone</th> : null}
              {show('sla') ? <th className="px-3 sm:px-4 py-2">SLA</th> : null}
              {showAiAlertColumn ? <WorkspaceAlertTableHeader /> : null}
              {show('audit') ? <TableAuditColumnHeader /> : null}
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
                      {client.recruitmentEnabled ? (
                        <span className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                          In Recruitment
                        </span>
                      ) : null}
                      {(() => {
                        const handoff = getClientHandoffStatus?.(client.id);
                        if (!handoff || handoff.status === 'none') return null;
                        if (handoff.status === 'pending') {
                          return (
                            <span className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                              Handoff pending
                            </span>
                          );
                        }
                        if (handoff.status === 'accepted') {
                          return (
                            <span className="mt-0.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                              Handed off
                            </span>
                          );
                        }
                        return (
                          <span
                            className="mt-0.5 inline-flex max-w-full truncate rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 ring-1 ring-rose-200/80"
                            title={handoff.reviewNote || 'Handoff request was rejected'}
                          >
                            Handoff rejected
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                {show('industry') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">{client.industry}</td>
                ) : null}
                {show('location') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">{client.location}</td>
                ) : null}
                {dynamicColumnLabels.map((label) => {
                  const value = getDynamicFieldValue?.(client, label) ?? '';
                  return (
                    <td key={`${client.id}-${label}`} className="px-3 sm:px-4 py-2">
                      <span className="line-clamp-2 text-xs text-slate-700">{value || '—'}</span>
                    </td>
                  );
                })}
                {showStatusColumn && show('status') ? (
                  <td className="px-3 sm:px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    {canUpdateClientStatus && onClientStatusChange ? (
                      <select
                        className="max-w-[10rem] cursor-pointer rounded-full border-0 bg-slate-100/80 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/90 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        value={resolveClientStatusLabel(client)}
                        onChange={(e) => onClientStatusChange(client.id, e.target.value)}
                      >
                        {clientStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : resolveClientStatusLabel(client) ? (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${clientStatusBadgeClass(
                          resolveClientStatusLabel(client),
                        )}`}
                      >
                        {resolveClientStatusLabel(client)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">-</span>
                    )}
                  </td>
                ) : null}
                {showRecruiterColumn && show('owner') ? (
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
                ) : null}
                {show('openJobs') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.openJobs ?? '—'}
                  </td>
                ) : null}
                {show('placements') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.placements ?? '—'}
                  </td>
                ) : null}
                {show('lastActivity') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.lastActivity || '—'}
                  </td>
                ) : null}
                {show('priority') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.priority || '—'}
                  </td>
                ) : null}
                {show('companySize') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.companySize || '—'}
                  </td>
                ) : null}
                {show('revenue') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.revenue || '—'}
                  </td>
                ) : null}
                {show('nextFollowUp') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.nextFollowUpDue || '—'}
                  </td>
                ) : null}
                {show('clientSince') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.clientSince || '—'}
                  </td>
                ) : null}
                {show('website') ? (
                  <td className="px-3 sm:px-4 py-2">
                    {client.website ? (
                      <a
                        href={
                          /^https?:\/\//i.test(client.website)
                            ? client.website
                            : `https://${client.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-[10rem] truncate text-xs text-indigo-600 hover:underline"
                        title={client.website}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {client.website.replace(/^https?:\/\//i, '')}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                ) : null}
                {show('timezone') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.timezone || '—'}
                  </td>
                ) : null}
                {show('sla') ? (
                  <td className="px-3 sm:px-4 py-2 text-xs text-slate-600">
                    {client.sla || '—'}
                  </td>
                ) : null}
                {showAiAlertColumn ? (
                  <td className="px-3 sm:px-4 py-2">
                    <WorkspaceAlertTableCell alerts={resolvedWorkspaceAlerts?.[client.id]} />
                  </td>
                ) : null}
                {show('audit') ? <TableAuditCell audit={client.auditMeta} /> : null}
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
                    {onSendToRecruitment ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!canSendToRecruitment) return;
                          onSendToRecruitment(client);
                        }}
                        disabled={
                          !canSendToRecruitment || sendingToRecruitmentIds.includes(client.id)
                        }
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                          client.recruitmentEnabled
                            ? 'text-sky-500 hover:bg-white hover:text-sky-800 hover:shadow-sm'
                            : canSendToRecruitment
                              ? 'text-sky-600 hover:bg-white hover:text-sky-800 hover:shadow-sm'
                              : 'cursor-not-allowed text-slate-300'
                        }`}
                        title={
                          !canSendToRecruitment
                            ? "You don't have permission to send clients to Recruitment"
                            : client.recruitmentEnabled
                              ? 'Forward to more members in Recruitment'
                              : 'Send to Recruitment'
                        }
                        aria-disabled={!canSendToRecruitment}
                      >
                        <Send size={15} strokeWidth={2.35} />
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
                    {onHandoffClient ? (
                      (() => {
                        const handoff = getClientHandoffStatus?.(client.id);
                        const canSend = canInitiateClientHandoff(handoff);
                        const isResend = handoff?.status === 'rejected';

                        if (isResend) {
                          return (
                            <button
                              type="button"
                              onClick={() => onHandoffClient(client)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-violet-600 hover:bg-white hover:text-violet-800 hover:shadow-sm transition-all"
                              title="Resend handoff request"
                            >
                              <RefreshCcw size={15} strokeWidth={2.35} />
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (!canSend) return;
                              onHandoffClient(client);
                            }}
                            disabled={!canSend}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                              canSend
                                ? 'text-violet-600 hover:bg-white hover:text-violet-800 hover:shadow-sm'
                                : 'cursor-not-allowed text-slate-300'
                            }`}
                            title={
                              handoff?.status === 'pending'
                                ? 'Handoff request is pending approval'
                                : handoff?.status === 'accepted'
                                  ? 'Client has already been handed off'
                                  : 'Hand off to another department'
                            }
                            aria-disabled={!canSend}
                          >
                            <ArrowRightLeft size={15} strokeWidth={2.35} />
                          </button>
                        );
                      })()
                    ) : null}
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
