'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSalesGroup,
  deleteSalesGroup,
  getSalesGroups,
  getSalesGroupCandidates,
  updateSalesGroup,
  type SalesGroup,
  type SalesGroupMember,
} from '../../../lib/api/teamApi';
import { apiOrgTree } from '../../../lib/org/orgApi';
import { PH2_TABLE_CARD_CLASS } from '../../../components/layout/Ph2ModulePageLayout';

export const SalesGroupsTab: React.FC = () => {
  const [groups, setGroups] = useState<SalesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<SalesGroupMember[]>([]);
  const [lower, setLower] = useState<SalesGroupMember[]>([]);
  const [showLower, setShowLower] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalesGroups();
      setGroups(res.data || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load sales groups');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const tree = await apiOrgTree();
      const units = (tree.units || [])
        .filter((u) => u.parentId)
        .map((u) => ({ id: String(u.id), name: String(u.name || 'Unit') }));
      setCompanies(units);
    } catch {
      setCompanies([]);
    }
  }, []);

  const loadCandidates = useCallback(async (unitId: string, includeLower: boolean) => {
    try {
      const res = await getSalesGroupCandidates({
        orgUnitId: unitId || undefined,
        includeLowerRanks: includeLower,
        teamId: editingId || undefined,
      });
      setRecommended(res.data?.recommended || []);
      setLower(res.data?.lower || []);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load members');
      setRecommended([]);
      setLower([]);
    }
  }, [editingId]);

  useEffect(() => {
    void loadGroups();
    void loadCompanies();
  }, [loadGroups, loadCompanies]);

  useEffect(() => {
    void loadCandidates(orgUnitId, showLower);
  }, [orgUnitId, showLower, loadCandidates]);

  const pickerMembers = useMemo(() => {
    if (showLower) return [...recommended, ...lower];
    return recommended;
  }, [recommended, lower, showLower]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setOrgUnitId('');
    setSelectedIds([]);
    setShowLower(false);
  };

  const startEdit = (group: SalesGroup) => {
    setEditingId(group.id);
    setName(group.name || '');
    setDescription(group.description || '');
    setOrgUnitId(group.orgUnitId || '');
    setSelectedIds((group.members || []).map((m) => String(m.id)));
    setShowLower(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Enter a sales team name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        kind: 'SALES' as const,
        description: description.trim() || undefined,
        orgUnitId: orgUnitId || undefined,
        memberIds: selectedIds,
        isActive: true,
      };
      if (editingId) {
        await updateSalesGroup(editingId, payload);
        toast.success('Sales team updated');
      } else {
        await createSalesGroup(payload);
        toast.success('Sales team created');
      }
      resetForm();
      await loadGroups();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save sales team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this sales team group? Lead/client assignees will update immediately.')) {
      return;
    }
    try {
      await deleteSalesGroup(id);
      toast.success('Sales team deleted');
      if (editingId === id) resetForm();
      await loadGroups();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
      <div className={`${PH2_TABLE_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">CRM sales teams</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Only members added here appear in lead / client Assign To. Top org ranks (1–2) and company/branch heads are listed by default.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-slate-500">No sales teams yet. Create one on the right.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map((group) => (
                <li
                  key={group.id}
                  className={`rounded-xl border px-3 py-3 ${
                    editingId === group.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => startEdit(group)}>
                      <p className="truncate text-sm font-semibold text-slate-900">{group.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {group.orgUnitName || 'All companies'} · {group.memberCount || group.members?.length || 0} members
                      </p>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => void handleDelete(group.id)}
                      aria-label="Delete sales team"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {(group.members || []).length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(group.members || []).slice(0, 8).map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {m.name}
                        </span>
                      ))}
                      {(group.members || []).length > 8 ? (
                        <span className="text-[10px] text-slate-400">+{(group.members || []).length - 8}</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`${PH2_TABLE_CARD_CLASS} flex min-h-0 w-full flex-col overflow-hidden lg:w-[420px]`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              {editingId ? 'Edit sales team' : 'Create sales team'}
            </h3>
          </div>
          {editingId ? (
            <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={resetForm}>
              New
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Team name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Team"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Company / branch (optional)</label>
            <select
              value={orgUnitId}
              onChange={(e) => {
                setOrgUnitId(e.target.value);
                setSelectedIds([]);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">Notes</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-slate-600">
                Members ({selectedIds.length})
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                onClick={() => setShowLower((v) => !v)}
              >
                <UserPlus size={12} />
                {showLower ? 'Hide lower ranks' : 'Add lower-ranked members'}
              </button>
            </div>
            <p className="mb-2 text-[10px] text-slate-400">
              Default list = org rank 1–2 and company/branch heads. Use the button to add lower ranks.
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {pickerMembers.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">
                  {orgUnitId
                    ? 'No ranked members for this company yet. Set ranks in Organization, or add lower ranks.'
                    : 'No default top-rank members. Pick a company or add lower ranks.'}
                </p>
              ) : (
                pickerMembers.map((m) => {
                  const checked = selectedIds.includes(String(m.id));
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(String(m.id))}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-800">{m.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {m.orgRank != null ? `R${m.orgRank}` : m.hierarchyPurpose === 'company_head' || m.hierarchyPurpose === 'site_head' ? 'Head' : '—'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create sales team'}
          </button>
        </div>
      </div>
    </div>
  );
};
