import React from 'react';
import { MoreHorizontal, Eye, Briefcase, Mail, ChevronDown, ArrowUpDown, Check, Trash2 } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import type { Client, ClientStage } from '@/app/client/types';

const stageColors: Record<ClientStage, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Prospect: 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Inactive: 'bg-slate-100 text-slate-700',
};

interface ClientTableProps {
  clients: Client[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onSelectClient?: (client: Client) => void;
  onDeleteClient?: (id: string) => void;
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

export function ClientTable({ clients, selectedIds, onSelectionChange, onSelectClient, onDeleteClient }: ClientTableProps) {
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

  const handleRowClick = (client: Client) => (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('input')) return;
    onSelectClient?.(client);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
                  Client Name <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Open Jobs</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Candidates</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Placements</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recruiter</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Activity</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client, index) => (
              <tr
                key={`${client.id}-${index}`}
                onClick={handleRowClick(client)}
                className={`hover:bg-blue-50/50 transition-colors group cursor-pointer ${selectedIds.includes(client.id) ? 'bg-blue-50/80' : ''}`}
              >
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  <CustomCheckbox
                    checked={selectedIds.includes(client.id)}
                    onChange={() => toggleSelect(client.id)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 bg-white">
                      <ImageWithFallback src={client.logo} alt={client.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{client.name}</div>
                      <div className="text-xs text-slate-500">ID: {client.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">{client.industry}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{client.location}</td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {client.openJobs}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    {client.activeCandidates}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {client.placements}
                  </span>
                </td>
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
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-emerald-600 transition-all"
                      title="Create Job"
                    >
                      <Briefcase className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-indigo-600 transition-all"
                      title="Email Client"
                    >
                      <Mail className="w-4 h-4" />
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
                    <button
                      type="button"
                      className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-white text-sm text-slate-500">
        <div>Showing 5 of 124 clients</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded bg-blue-600 text-white font-medium">1</button>
            <button className="w-8 h-8 rounded hover:bg-slate-50 transition-colors">2</button>
            <button className="w-8 h-8 rounded hover:bg-slate-50 transition-colors">3</button>
          </div>
          <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">Next</button>
        </div>
      </div>
    </div>
  );
}
