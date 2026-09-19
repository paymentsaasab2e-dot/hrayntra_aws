'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  ASSIGNMENT_RULE_MODULE_OPTIONS,
  getAllTeamMembersForDirectory,
  getAssignmentRules,
  saveAssignmentRules,
  type TeamMember,
} from '../../../lib/api/teamApi';
import { apiGetAssignCompanies } from '../../../lib/org/orgApi';
import { formatAssigneeDisplayName } from '../../../lib/assigneeDisplay';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../../../lib/quickSearch';
import { PH2_TABLE_CARD_CLASS } from '../../../components/layout/Ph2ModulePageLayout';
import { getActiveOrgUnitId } from '../../../lib/org/orgWorkspaceStorage';

function memberLabel(member: TeamMember) {
  return (
    formatAssigneeDisplayName(member) ||
    [member.firstName, member.lastName].filter(Boolean).join(' ').trim() ||
    member.email ||
    'Member'
  );
}

function withAssignorChecked(ids: string[], assignorUserId: string) {
  const assignorId = String(assignorUserId || '').trim();
  const next = [...new Set((ids || []).map(String).filter(Boolean))];
  if (assignorId && !next.includes(assignorId)) next.unshift(assignorId);
  return next;
}

function moduleLabel(value: string) {
  return ASSIGNMENT_RULE_MODULE_OPTIONS.find((o) => o.value === value)?.label || value;
}

function ColumnShell({
  step,
  title,
  subtitle,
  active,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-1 flex-col rounded-2xl border shadow-sm ${
        active ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
              active ? 'bg-indigo-600' : 'bg-slate-400'
            }`}
          >
            {step}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </section>
  );
}

export const AssignmentRulesTab: React.FC = () => {
  const [assignorUserId, setAssignorUserId] = useState('');
  const [module, setModule] = useState<string>(ASSIGNMENT_RULE_MODULE_OPTIONS[0]?.value || '');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [eligibleAssigneeIds, setEligibleAssigneeIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const [usingHierarchyDefault, setUsingHierarchyDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectionTouched, setSelectionTouched] = useState(false);

  const loadMembersAndCompanies = useCallback(async () => {
    setLoading(true);
    try {
      // Full directory — not /team/assignable — so "Can assign to" lists everyone,
      // not only who the current admin can already assign to.
      const companyFilter = orgUnitId || getActiveOrgUnitId() || undefined;
      const [teamMembers, assignCompanies] = await Promise.all([
        getAllTeamMembersForDirectory(companyFilter || undefined),
        apiGetAssignCompanies(module).catch(() => [] as Array<{ id: string; name?: string }>),
      ]);
      setMembers(teamMembers || []);
      const units = (Array.isArray(assignCompanies) ? assignCompanies : [])
        .filter((row) => row?.id)
        .map((row) => ({ id: String(row.id), name: String(row.name || 'Company') }));
      setCompanies(units);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load team members');
      setMembers([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [orgUnitId, module]);

  useEffect(() => {
    void loadMembersAndCompanies();
  }, [loadMembersAndCompanies]);

  useEffect(() => {
    if (!orgUnitId) return;
    if (companies.some((company) => company.id === orgUnitId)) return;
    setOrgUnitId('');
    setAssignorUserId('');
    setSelectedIds([]);
    setSuggestedIds([]);
    setEligibleAssigneeIds(null);
    setConfigured(false);
    setUsingHierarchyDefault(true);
    setSelectionTouched(false);
  }, [companies, orgUnitId]);

  const loadRules = useCallback(async () => {
    if (!module || !assignorUserId) {
      setConfigured(false);
      setUsingHierarchyDefault(true);
      setSelectedIds([]);
      setSuggestedIds([]);
      setEligibleAssigneeIds(null);
      return;
    }
    setLoadingRules(true);
    try {
      const data = await getAssignmentRules({
        module,
        assignorUserId,
        orgUnitId: orgUnitId || undefined,
      });
      const hierarchy = (data.suggestedAssigneeIds || []).map(String);
      const eligible = Array.isArray(data.eligibleAssigneeUserIds)
        ? data.eligibleAssigneeUserIds.map(String)
        : null;
      const isCustom = Boolean(data.configured);
      setConfigured(isCustom);
      setUsingHierarchyDefault(!isCustom);
      setSuggestedIds(hierarchy);
      setEligibleAssigneeIds(eligible);
      setSelectedIds(withAssignorChecked(data.assigneeUserIds || [], assignorUserId));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load assignment rules');
      setConfigured(false);
      setUsingHierarchyDefault(true);
      setSelectedIds([]);
      setSuggestedIds([]);
      setEligibleAssigneeIds(null);
    } finally {
      setLoadingRules(false);
    }
  }, [module, assignorUserId, orgUnitId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  // Full-access default: when API returned an empty list and not custom-saved, tick everyone with module access.
  useEffect(() => {
    if (selectionTouched || loadingRules || configured || !usingHierarchyDefault) return;
    if (!module || !assignorUserId) return;
    if (selectedIds.length > 0) return;
    if (!eligibleAssigneeIds?.length) return;
    setSelectedIds(withAssignorChecked(eligibleAssigneeIds, assignorUserId));
  }, [
    selectionTouched,
    loadingRules,
    configured,
    usingHierarchyDefault,
    module,
    assignorUserId,
    selectedIds.length,
    eligibleAssigneeIds,
  ]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => memberLabel(a).localeCompare(memberLabel(b))),
    [members],
  );

  const eligibleAssigneeSet = useMemo(
    () => (eligibleAssigneeIds ? new Set(eligibleAssigneeIds.map(String)) : null),
    [eligibleAssigneeIds],
  );

  /** “Can assign to” only lists people who have access to the selected module. Assignor first. */
  const assigneePool = useMemo(() => {
    if (!module || !assignorUserId) return [];
    const pool = eligibleAssigneeSet
      ? sortedMembers.filter((member) => eligibleAssigneeSet.has(String(member.id)))
      : sortedMembers;
    const self = pool.filter((member) => String(member.id) === String(assignorUserId));
    const rest = pool.filter((member) => String(member.id) !== String(assignorUserId));
    return [...self, ...rest];
  }, [assignorUserId, eligibleAssigneeSet, module, sortedMembers]);

  const selectedAssignor = useMemo(
    () => sortedMembers.find((m) => String(m.id) === String(assignorUserId)) || null,
    [sortedMembers, assignorUserId],
  );

  const selectedModuleLabel = moduleLabel(module);

  const isFullAccessDefault = Boolean(
    assignorUserId &&
      module &&
      usingHierarchyDefault &&
      !configured &&
      assigneePool.length > 0 &&
      selectedIds.length >= assigneePool.length,
  );

  const canAssignSummary = (() => {
    if (!assignorUserId || !module) return 'Can assign to…';
    if (loadingRules) return '…';
    if (!selectedIds.length) return configured ? 'Themselves only' : 'Nobody';
    if (isFullAccessDefault || (assigneePool.length > 0 && selectedIds.length >= assigneePool.length)) {
      return `Everyone with access (${selectedIds.length})`;
    }
    return `${selectedIds.length} people`;
  })();

  const statusBadge = (() => {
    if (!assignorUserId || !module || loadingRules) return null;
    if (configured) {
      return {
        className: 'bg-emerald-100 text-emerald-800',
        label: selectedIds.length ? 'Custom saved' : 'Saved · themselves only',
      };
    }
    if (suggestedIds.length > 0 && !isFullAccessDefault) {
      return {
        className: 'bg-sky-100 text-sky-800',
        label: 'Default · self + hierarchy',
      };
    }
    return {
      className: 'bg-sky-100 text-sky-800',
      label: 'Default · full access',
    };
  })();

  const filteredMemberPicker = useMemo(() => {
    const q = memberSearch.trim();
    if (!q) return sortedMembers;
    return sortedMembers.filter((member) =>
      matchesQuickSearch(
        buildQuickSearchHaystack(
          memberLabel(member),
          member.email,
          member.role?.roleName,
          member.department?.name,
        ),
        q,
      ),
    );
  }, [sortedMembers, memberSearch]);

  const filteredAssignees = useMemo(() => {
    const q = assigneeSearch.trim();
    return assigneePool.filter((member) => {
      if (!q) return true;
      return matchesQuickSearch(
        buildQuickSearchHaystack(
          memberLabel(member),
          member.email,
          member.role?.roleName,
          member.department?.name,
        ),
        q,
      );
    });
  }, [assigneePool, assigneeSearch]);

  const suggestedSet = useMemo(() => new Set(suggestedIds.map(String)), [suggestedIds]);

  const handlePickModule = (value: string) => {
    setModule(value);
    setAssignorUserId('');
    setSelectedIds([]);
    setSuggestedIds([]);
    setEligibleAssigneeIds(null);
    setConfigured(false);
    setUsingHierarchyDefault(true);
    setSelectionTouched(false);
    setMemberSearch('');
    setAssigneeSearch('');
  };

  const handlePickMember = (id: string) => {
    setAssignorUserId(id);
    setSelectionTouched(false);
    setAssigneeSearch('');
  };

  const toggleId = (id: string) => {
    if (id === String(assignorUserId)) return;
    setSelectionTouched(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectSuggested = () => {
    setSelectionTouched(true);
    if (suggestedIds.length > 0) {
      setSelectedIds(withAssignorChecked(suggestedIds, assignorUserId));
      return;
    }
    setSelectedIds(withAssignorChecked(assigneePool.map((m) => String(m.id)), assignorUserId));
  };

  const clearAll = () => {
    setSelectionTouched(true);
    setSelectedIds(assignorUserId ? [String(assignorUserId)] : []);
  };

  const persistRules = useCallback(
    async (ids: string[], { silent = false }: { silent?: boolean } = {}) => {
      if (!module) {
        if (!silent) toast.error('Select a module first');
        return;
      }
      if (!assignorUserId) {
        if (!silent) toast.error('Select who assigns');
        return;
      }
      if (silent) setAutoSaving(true);
      else setSaving(true);
      try {
        const data = await saveAssignmentRules({
          module,
          assignorUserId,
          assigneeUserIds: withAssignorChecked(ids, assignorUserId),
          orgUnitId: orgUnitId || null,
        });
        setConfigured(Boolean(data.configured));
        setUsingHierarchyDefault(false);
        setSelectedIds(withAssignorChecked(data.assigneeUserIds || [], assignorUserId));
        setSuggestedIds((data.suggestedAssigneeIds || []).map(String));
        setEligibleAssigneeIds(
          Array.isArray(data.eligibleAssigneeUserIds)
            ? data.eligibleAssigneeUserIds.map(String)
            : null,
        );
        setSelectionTouched(false);
        if (!silent) {
          const count = (data.assigneeUserIds || []).length;
          toast.success(
            count
              ? `Saved: ${selectedAssignor ? memberLabel(selectedAssignor) : 'Member'} can assign ${selectedModuleLabel} to ${count} people. Assigned to lists on their account update now.`
              : `Saved: ${selectedAssignor ? memberLabel(selectedAssignor) : 'Member'} can only assign ${selectedModuleLabel} to themselves.`,
          );
        }
      } catch (error: any) {
        toast.error(error?.message || 'Failed to save assignment rules');
      } finally {
        setSaving(false);
        setAutoSaving(false);
      }
    },
    [assignorUserId, module, orgUnitId, selectedAssignor, selectedModuleLabel],
  );

  useEffect(() => {
    if (!selectionTouched || !assignorUserId || !module || loadingRules || saving) return;
    const timer = window.setTimeout(() => {
      void persistRules(selectedIds, { silent: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    assignorUserId,
    loadingRules,
    module,
    persistRules,
    saving,
    selectedIds,
    selectionTouched,
  ]);

  const handleSave = () => {
    void persistRules(selectedIds, { silent: false });
  };

  return (
    <div className={`${PH2_TABLE_CARD_CLASS} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className="shrink-0 border-b border-indigo-100/60 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Assignment Rules</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Who can assign to whom. This list is what appears in Assigned to. Checking or
                unchecking updates that person&apos;s account immediately.
              </p>
            </div>
          </div>

          {companies.length > 0 ? (
            <label className="min-w-[200px] text-sm">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Organization
              </span>
              <select
                value={orgUnitId}
                onChange={(e) => {
                  setOrgUnitId(e.target.value);
                  setAssignorUserId('');
                  setSelectedIds([]);
                  setSuggestedIds([]);
                  setEligibleAssigneeIds(null);
                  setConfigured(false);
                  setUsingHierarchyDefault(true);
                  setSelectionTouched(false);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">All / active company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-white/80 px-3 py-2.5 text-sm">
          <span className="font-semibold text-slate-500">Who → whom:</span>
          <span
            className={`rounded-lg px-2.5 py-1 font-semibold ${
              module ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {module ? selectedModuleLabel : 'Module'}
          </span>
          <ArrowRight size={14} className="text-slate-400" />
          <span
            className={`rounded-lg px-2.5 py-1 font-semibold ${
              selectedAssignor ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {selectedAssignor ? memberLabel(selectedAssignor) : 'Who assigns'}
          </span>
          <ArrowRight size={14} className="text-slate-400" />
          <span
            className={`rounded-lg px-2.5 py-1 font-semibold ${
              assignorUserId && module ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {canAssignSummary}
          </span>
          {statusBadge ? (
            <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-3 lg:min-h-[420px]">
          <ColumnShell step={1} title="Module" subtitle="Which Assign To?" active={Boolean(module)}>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {ASSIGNMENT_RULE_MODULE_OPTIONS.map((opt) => {
                const active = module === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePickModule(opt.value)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    {active ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">Selected</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ColumnShell>

          <ColumnShell
            step={2}
            title="Who assigns"
            subtitle={module ? 'Pick the person' : 'Select module first'}
            active={Boolean(assignorUserId)}
          >
            {!module ? (
              <p className="py-8 text-center text-sm text-slate-500">← Choose a module</p>
            ) : (
              <>
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search member…"
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-1">
                  {loading ? (
                    <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
                  ) : filteredMemberPicker.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No members</p>
                  ) : (
                    filteredMemberPicker.map((member) => {
                      const id = String(member.id);
                      const active = id === String(assignorUserId);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handlePickMember(id)}
                          className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left last:mb-0 ${
                            active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-indigo-50'
                          }`}
                        >
                          <span className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>
                            {memberLabel(member)}
                          </span>
                          <span className={`truncate text-[11px] ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {member.role?.roleName || '—'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </ColumnShell>

          <ColumnShell
            step={3}
            title="Can assign to"
            subtitle={
              assignorUserId && module
                ? configured
                  ? `Custom list for ${memberLabel(selectedAssignor!)}`
                  : suggestedIds.filter((id) => id !== String(assignorUserId)).length > 0
                    ? `Default: themselves + reports with ${selectedModuleLabel} access`
                    : `Default: themselves and everyone with ${selectedModuleLabel} access — uncheck to restrict`
                : 'Select module + who assigns'
            }
            active={Boolean(assignorUserId && module)}
          >
            {!module || !assignorUserId ? (
              <p className="py-8 text-center text-sm text-slate-500">← Choose module & who assigns</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={selectSuggested}
                    className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    {suggestedIds.length > 0
                      ? `Use self + hierarchy (${suggestedIds.length})`
                      : `Select everyone with access (${assigneePool.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <span
                    className={`ml-auto self-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      configured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {loadingRules
                      ? '…'
                      : configured
                        ? selectedIds.length
                          ? 'Saved custom'
                          : 'Saved · nobody'
                        : suggestedIds.length
                          ? 'Default · works without save'
                          : 'Default · module access'}
                  </span>
                </div>
                <input
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  placeholder="Search assignees…"
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-1">
                  {loadingRules ? (
                    <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
                  ) : filteredAssignees.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      {eligibleAssigneeSet && assigneePool.length === 0
                        ? `No team members have access to ${selectedModuleLabel}`
                        : 'No members match your search'}
                    </p>
                  ) : (
                    filteredAssignees.map((member) => {
                      const id = String(member.id);
                      const checked = selectedIds.includes(id);
                      const suggested = suggestedSet.has(id);
                      return (
                        <label
                          key={id}
                          className={`mb-1 flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 last:mb-0 ${
                            checked ? 'bg-indigo-100' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={id === String(assignorUserId) ? true : checked}
                            disabled={id === String(assignorUserId)}
                            onChange={() => toggleId(id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 disabled:opacity-100"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {memberLabel(member)}
                              {id === String(assignorUserId) ? (
                                <span className="ml-1 text-[9px] font-bold uppercase text-indigo-700">
                                  Self · always
                                </span>
                              ) : suggested ? (
                                <span className="ml-1 text-[9px] font-bold uppercase text-sky-700">Report</span>
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">{member.role?.roleName}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </ColumnShell>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
          <p className="hidden max-w-xl text-xs text-slate-500 sm:block">
            Only people with access to the selected module appear here. Changes apply immediately to
            that person&apos;s Assigned to lists. They can always assign to themselves.
          </p>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || autoSaving || !assignorUserId || !module || loadingRules}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving || autoSaving ? 'Updating…' : 'Save Rules'}
          </button>
        </div>
      </div>
    </div>
  );
};
