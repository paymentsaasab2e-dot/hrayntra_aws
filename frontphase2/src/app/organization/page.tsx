'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, MapPin, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import { getDepartments, getRoles, getTeamMembers } from '../../lib/api/teamApi';
import type { Department, Role, TeamMember } from '../../types/team';
import {
  apiAdoptWorkspace,
  apiAssignOrgMember,
  apiCreateOrgUnit,
  apiDeleteOrgUnit,
  apiOrgTree,
  apiStampUntaggedToOrgUnit,
  type OrgUnitNode,
} from '../../lib/org/orgApi';

export const dynamic = 'force-dynamic';

const fieldClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100';
const labelClass = 'mb-1.5 block text-[12px] font-semibold text-slate-600';

function personName(m: TeamMember) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.email;
}

function toastLogin(credentialData?: { loginId?: string; tempPassword?: string } | null) {
  if (!credentialData?.loginId) return;
  toast.success(
    `New login: ${credentialData.loginId}${credentialData.tempPassword ? ` · password ${credentialData.tempPassword}` : ''}`,
    { duration: 14000 },
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}

function WizardDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-4 flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i + 1 <= step ? 'bg-slate-900' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  submit,
  submitLabel,
  saving,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  submit?: boolean;
  submitLabel?: string;
  saving?: boolean;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      ) : null}
      {onNext && !submit ? (
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {nextLabel}
        </button>
      ) : null}
      {submit ? (
        <button
          type="button"
          disabled={nextDisabled || saving}
          onClick={onNext}
          className="h-11 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      ) : null}
    </div>
  );
}

function Choice({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition ${
        active ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-sky-900' : 'text-slate-900'}`}>{title}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{hint}</p>
    </button>
  );
}

function UnitCard({
  unit,
  canWrite,
  isTenantAdmin,
  unassignedCount,
  onAddChild,
  onDelete,
  onAdopt,
  onStampData,
}: {
  unit: OrgUnitNode;
  canWrite: boolean;
  isTenantAdmin: boolean;
  unassignedCount: number;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onAdopt: (id: string) => void;
  onStampData: (id: string) => void;
}) {
  const isHq = !unit.parentId;
  const isCompany = unit.levelOrder === 2 && !unit.isLeaf;
  const Icon = isHq ? Building2 : unit.isLeaf ? MapPin : Building2;

  return (
    <div className={`${isHq ? '' : 'rounded-xl border border-slate-200 bg-slate-50/80 p-3'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 rounded-lg bg-white p-1.5 text-slate-600 ring-1 ring-slate-200">
            <Icon size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isHq ? 'HQ' : unit.isLeaf ? 'Branch' : 'Company'}
            </p>
            <h3 className="text-[15px] font-bold text-slate-900">{unit.name}</h3>
            <p className="text-[12px] text-slate-500">
              {unit.subtreePeople ?? unit.peopleCount ?? 0} people
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {canWrite && (isHq || isCompany) ? (
            <button
              type="button"
              onClick={() => onAddChild(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={12} /> {isHq ? 'Add company' : 'Add branch'}
            </button>
          ) : null}
          {isTenantAdmin && !isHq && unassignedCount > 0 ? (
            <button
              type="button"
              onClick={() => onAdopt(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-medium text-sky-800 hover:bg-sky-100"
            >
              Move leftover team here
            </button>
          ) : null}
          {isTenantAdmin && !isHq ? (
            <button
              type="button"
              onClick={() => onStampData(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Assign existing users & data here
            </button>
          ) : null}
          {isTenantAdmin && !isHq ? (
            <button
              type="button"
              onClick={() => onDelete(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
            >
              <Trash2 size={12} /> Remove
            </button>
          ) : null}
        </div>
      </div>

      {(unit.people || []).length ? (
        <ul className="mt-3 space-y-1">
          {(unit.people || []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[13px] ring-1 ring-slate-100">
              <span className="truncate font-medium text-slate-800">{p.name}</span>
              <span className="shrink-0 text-[11px] text-slate-500">
                {p.unassigned ? 'Not in a company yet' : `${p.roleName || 'No role'} · ${p.purposeLabel || 'Member'}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-slate-400">No one here yet.</p>
      )}

      {(unit.children || []).length ? (
        <div className="mt-3 space-y-3 pl-2">
          {unit.children!.map((child) => (
            <UnitCard
              key={child.id}
              unit={child}
              canWrite={canWrite}
              isTenantAdmin={isTenantAdmin}
              unassignedCount={unassignedCount}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onAdopt={onAdopt}
              onStampData={onStampData}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function OrganizationPage() {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canWrite = isSuperAdmin() || hasPermission('org_structure') || hasPermission('node_org_structure');
  const [tree, setTree] = useState<OrgUnitNode | null>(null);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [unitKind, setUnitKind] = useState<'company' | 'site'>('company');
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [source, setSource] = useState<'workspace' | 'blank' | 'department' | 'people'>('workspace');
  const [showMoreSource, setShowMoreSource] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [siteParentId, setSiteParentId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [headUserId, setHeadUserId] = useState('');
  const [createLogin, setCreateLogin] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [tab, setTab] = useState<'structure' | 'create' | 'people'>('structure');
  const [createStep, setCreateStep] = useState(1);
  const [peopleStep, setPeopleStep] = useState(1);

  const [peopleMode, setPeopleMode] = useState<'existing' | 'new'>('existing');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignUnitId, setAssignUnitId] = useState('');
  const [assignPurpose, setAssignPurpose] = useState<'member' | 'company_head' | 'site_head'>('member');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignFirst, setAssignFirst] = useState('');
  const [assignLast, setAssignLast] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiOrgTree();
      setTree(data.tree);
      setIsTenantAdmin(Boolean(data.scope?.isTenantAdmin));
      setUnassignedCount(Number(data.unassignedCount || 0));
      const firstCompany = (data.tree?.children || []).find((c) => !c.isLeaf);
      setSiteParentId((prev) => prev || firstCompany?.id || '');
      setAssignUnitId((prev) => prev || firstCompany?.id || data.tree?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load organization');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void getTeamMembers({ limit: 100 }, { assignmentDirectory: true })
      .then((res) => setMembers(res.data || []))
      .catch(() => undefined);
    void getRoles()
      .then((res) => setRoles(res.data || []))
      .catch(() => undefined);
    void getDepartments()
      .then((res) => setDepartments(res.data || []))
      .catch(() => undefined);
  }, [load]);

  const companies = useMemo(() => {
    const out: OrgUnitNode[] = [];
    function walk(node?: OrgUnitNode | null) {
      if (!node) return;
      if (node.levelOrder === 2 && !node.isLeaf) out.push(node);
      (node.children || []).forEach(walk);
    }
    walk(tree);
    return out;
  }, [tree]);

  const assignableUnits = useMemo(() => {
    const out: OrgUnitNode[] = [];
    function walk(node?: OrgUnitNode | null) {
      if (!node) return;
      if (node.parentId) out.push(node);
      (node.children || []).forEach(walk);
    }
    walk(tree);
    return out;
  }, [tree]);

  const adminRoleId = useMemo(
    () => roles.find((r) => /admin/i.test(r.roleName) && !/super/i.test(r.roleName))?.id || roles[0]?.id || '',
    [roles],
  );

  const createUnit = async () => {
    const nameFromDept = departments.find((d) => d.id === departmentId)?.name || '';
    const name = unitName.trim() || (source === 'department' ? nameFromDept : '');
    if (!name) {
      toast.error('Give it a name.');
      return;
    }
    if (unitKind === 'site' && !siteParentId) {
      toast.error('Pick which company this branch sits under.');
      return;
    }
    if (source === 'department' && !departmentId) {
      toast.error('Pick a department.');
      return;
    }
    if (source === 'people' && !selectedUserIds.length) {
      toast.error('Pick at least one person.');
      return;
    }
    if (createLogin && (!newFirst.trim() || !newEmail.trim())) {
      toast.error('Enter first name and email for the new login.');
      return;
    }
    setSaving(true);
    try {
      const created = await apiCreateOrgUnit({
        name,
        kind: unitKind,
        parentId: unitKind === 'site' ? siteParentId : tree?.id,
        departmentId: source === 'department' ? departmentId : undefined,
        userIds: source === 'people' ? selectedUserIds : undefined,
        adoptWorkspace: source === 'workspace',
        headUserId: headUserId || undefined,
        newUser: createLogin
          ? {
              firstName: newFirst.trim(),
              lastName: newLast.trim(),
              email: newEmail.trim(),
              roleId: newRoleId || adminRoleId,
              generateCredentials: true,
              sendInvite,
              loginIdOption: 'email',
            }
          : undefined,
        newUserPurpose: unitKind === 'site' ? 'site_head' : 'company_head',
      });
      toast.success(
        created?.attachedCount || created?.stamped
          ? `Created · ${created?.attachedCount || 0} people and their work linked to this ${unitKind === 'site' ? 'branch' : 'company'} id`
          : unitKind === 'site'
            ? 'Branch created'
            : 'Company created',
      );
      toastLogin(created?.credentialData);
      setUnitName('');
      setDepartmentId('');
      setSelectedUserIds([]);
      setHeadUserId('');
      setCreateLogin(false);
      setNewFirst('');
      setNewLast('');
      setNewEmail('');
      setCreateStep(1);
      setTab('structure');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add');
    } finally {
      setSaving(false);
    }
  };

  const promptAddChild = (parentId: string) => {
    const addingCompany = parentId === tree?.id;
    setUnitKind(addingCompany ? 'company' : 'site');
    if (!addingCompany) setSiteParentId(parentId);
    setCreateStep(1);
    setTab('create');
  };

  const adoptInto = async (id: string) => {
    if (
      !window.confirm(
        'Move people who are still on this tenant (not in a company) into this unit? Super Admin stays at HQ. Untagged jobs, leads, clients, and candidates will also be assigned to this company id.',
      )
    ) {
      return;
    }
    try {
      const result = await apiAdoptWorkspace(id);
      const stamped = result.stamped;
      const stampNote = stamped
        ? ` Also linked ${stamped.jobs} jobs, ${stamped.leads} leads, ${stamped.clients} clients, ${stamped.candidates} candidates.`
        : '';
      toast.success(
        result.attachedCount
          ? `Moved ${result.attachedCount} people into ${result.name}.${stampNote}`
          : `No leftover people to move into ${result.name}.${stampNote || ' They may already be in a company, or only Super Admin is left at HQ.'}`,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not move workspace');
    }
  };

  const stampDataInto = async (id: string) => {
    if (
      !window.confirm(
        'Assign leftover team members and all untagged jobs, leads, clients, and candidates to this company/branch id? Both users and data get the same id so switching companies shows separate sets. Super Admin stays at HQ.',
      )
    ) {
      return;
    }
    try {
      const result = await apiStampUntaggedToOrgUnit(id);
      const s = result.stamped;
      toast.success(
        `${result.name}: ${result.attachedCount || 0} people · ${s.jobs} jobs · ${s.leads} leads · ${s.clients} clients · ${s.candidates} candidates`,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not assign users and data');
    }
  };

  const removeUnit = async (id: string) => {
    if (!window.confirm('Remove this company or branch? People must be moved first.')) return;
    try {
      await apiDeleteOrgUnit(id);
      toast.success('Removed');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove');
    }
  };

  const savePeople = async () => {
    if (!assignUnitId) {
      toast.error('Pick a company or branch.');
      return;
    }
    if (peopleMode === 'new' && (!assignFirst.trim() || !assignEmail.trim())) {
      toast.error('Enter first name and email for the new login.');
      return;
    }
    if (peopleMode === 'existing' && !assignUserId) {
      toast.error('Pick an existing person.');
      return;
    }
    setSaving(true);
    try {
      if (peopleMode === 'new') {
        const created = await apiAssignOrgMember({
          orgUnitId: assignUnitId,
          hierarchyPurpose: assignPurpose,
          newUser: {
            firstName: assignFirst.trim(),
            lastName: assignLast.trim(),
            email: assignEmail.trim(),
            roleId: assignRoleId || adminRoleId,
            generateCredentials: true,
            sendInvite: true,
            loginIdOption: 'email',
          },
        });
        toast.success('New login created');
        toastLogin(created?.credentialData);
        setAssignFirst('');
        setAssignLast('');
        setAssignEmail('');
      } else {
        await apiAssignOrgMember({
          userId: assignUserId,
          orgUnitId: assignUnitId,
          hierarchyPurpose: assignPurpose,
          roleId: assignRoleId || undefined,
        });
        toast.success('Person placed on that company/branch');
      }
      setPeopleStep(1);
      setAssignUserId('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const hasCompanies = companies.length > 0;
  const createNameReady = Boolean(unitName.trim()) && (unitKind === 'company' || Boolean(siteParentId));
  const peopleDetailsReady =
    peopleMode === 'existing'
      ? Boolean(assignUserId)
      : Boolean(assignFirst.trim() && assignLast.trim() && assignEmail.trim());

  const tabs: { id: 'structure' | 'create' | 'people'; label: string }[] = canWrite
    ? [
        { id: 'structure', label: 'Structure' },
        { id: 'create', label: 'Create company / branch' },
        { id: 'people', label: 'People accounts' },
      ]
    : [{ id: 'structure', label: 'Structure' }];

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Toaster position="top-right" />

      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization</h1>
        <p className="mt-1 text-sm text-slate-500">
          Split this tenant into named companies and branches. You keep the same CRM and recruitment screens —
          Super Admin can switch which company they are looking at.
        </p>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {unassignedCount > 0 && tab === 'structure' ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <p className="font-semibold">{unassignedCount} people are still on this tenant only</p>
          <p className="mt-0.5 text-amber-800/90">
            Open <button type="button" className="font-semibold underline" onClick={() => { setTab('create'); setCreateStep(2); }}>Create</button> and choose “Move current team in”, or tap “Move leftover team here” on a company.
          </p>
        </div>
      ) : null}

      {tab === 'structure' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">Your structure</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">HQ is this tenant. Companies sit under it. Branches sit under a company.</p>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : tree ? (
              <UnitCard
                unit={tree}
                canWrite={canWrite}
                isTenantAdmin={isTenantAdmin}
                unassignedCount={unassignedCount}
                onAddChild={promptAddChild}
                onDelete={(id) => void removeUnit(id)}
                onAdopt={(id) => void adoptInto(id)}
                onStampData={(id) => void stampDataInto(id)}
              />
            ) : (
              <p className="text-sm text-slate-500">Nothing here yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {canWrite && tab === 'create' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">Create a company or branch</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">One step at a time. Continue unlocks the next screen.</p>
          <WizardDots step={createStep} total={3} />

          {createStep === 1 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={1} />
                <p className="text-sm font-bold text-slate-900">Name it</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  active={unitKind === 'company'}
                  title="Company"
                  hint="A named business under this tenant"
                  onClick={() => setUnitKind('company')}
                />
                <Choice
                  active={unitKind === 'site'}
                  title="Branch"
                  hint="Sits under one company"
                  onClick={() => setUnitKind('site')}
                />
              </div>
              {unitKind === 'site' ? (
                <div className="mt-3">
                  <label className={labelClass}>Under which company?</label>
                  <select value={siteParentId} onChange={(e) => setSiteParentId(e.target.value)} className={fieldClass}>
                    <option value="">Select company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {!hasCompanies ? (
                    <p className="mt-1.5 text-[12px] text-amber-700">Create a company first, then add a branch.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3">
                <label className={labelClass}>{unitKind === 'site' ? 'Branch name' : 'Company name'}</label>
                <input
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder={unitKind === 'site' ? 'e.g. Downtown office' : 'e.g. North staffing'}
                  className={fieldClass}
                />
              </div>
              <WizardNav
                onNext={() => setCreateStep(2)}
                nextDisabled={!createNameReady || (unitKind === 'company' && !isTenantAdmin) || (unitKind === 'site' && !hasCompanies)}
              />
            </div>
          ) : null}

          {createStep === 2 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={2} />
                <p className="text-sm font-bold text-slate-900">Who should be in it?</p>
              </div>
              <div className="grid gap-2">
                <Choice
                  active={source === 'workspace'}
                  title="Move current team in"
                  hint={`${unassignedCount || 'All leftover'} people on this tenant, plus their leads, jobs and clients`}
                  onClick={() => setSource('workspace')}
                />
                <Choice
                  active={source === 'blank'}
                  title="Start empty"
                  hint="Create the name only. Add people next."
                  onClick={() => setSource('blank')}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowMoreSource((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-800"
              >
                <ChevronDown size={14} className={showMoreSource ? 'rotate-180' : ''} />
                Other options
              </button>
              {showMoreSource ? (
                <div className="mt-2 grid gap-2">
                  <Choice
                    active={source === 'department'}
                    title="From a department"
                    hint="Turn an existing department into this company or branch"
                    onClick={() => setSource('department')}
                  />
                  <Choice
                    active={source === 'people'}
                    title="Pick people"
                    hint="Choose who moves in"
                    onClick={() => setSource('people')}
                  />
                </div>
              ) : null}

              {source === 'department' ? (
                <div className="mt-3">
                  <label className={labelClass}>Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      const dept = departments.find((d) => d.id === e.target.value);
                      if (dept && !unitName.trim()) setUnitName(dept.name);
                    }}
                    className={fieldClass}
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {source === 'people' ? (
                <div className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={selectedUserIds.includes(m.id)} onChange={() => toggleUser(m.id)} />
                      {personName(m)}
                    </label>
                  ))}
                </div>
              ) : null}

              {source !== 'blank' && source !== 'workspace' ? (
                <div className="mt-3">
                  <label className={labelClass}>Who is the admin? (optional)</label>
                  <select value={headUserId} onChange={(e) => setHeadUserId(e.target.value)} className={fieldClass}>
                    <option value="">No admin yet</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {personName(m)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <WizardNav onBack={() => setCreateStep(1)} onNext={() => setCreateStep(3)} />
            </div>
          ) : null}

          {createStep === 3 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={3} />
                <p className="text-sm font-bold text-slate-900">New login? (optional)</p>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={createLogin}
                  onChange={(e) => setCreateLogin(e.target.checked)}
                />
                <span>
                  Also create a new user as {unitKind === 'site' ? 'branch' : 'company'} admin
                  <span className="mt-0.5 block text-[12px] text-slate-500">They get a login ID and temporary password.</span>
                </span>
              </label>
              {createLogin ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>First name</label>
                    <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Last name</label>
                    <input value={newLast} onChange={(e) => setNewLast(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Email (login ID)</label>
                    <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Team role</label>
                    <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} className={fieldClass}>
                      <option value="">Admin (recommended)</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roleName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-slate-600 sm:col-span-2">
                    <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
                    Email them the password
                  </label>
                </div>
              ) : null}
              <WizardNav
                onBack={() => setCreateStep(2)}
                onNext={() => void createUnit()}
                submit
                submitLabel={unitKind === 'site' ? 'Create branch' : 'Create company'}
                saving={saving}
                nextDisabled={saving || (createLogin && (!newFirst.trim() || !newLast.trim() || !newEmail.trim()))}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {canWrite && tab === 'people' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 flex items-center gap-2">
            <UserPlus size={18} />
            <h2 className="text-base font-bold text-slate-900">People accounts</h2>
          </div>
          <p className="text-[13px] text-slate-500">Place someone already on the team, or create a new login. Each step appears after the last one is done.</p>
          <WizardDots step={peopleStep} total={4} />

          {peopleStep === 1 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={1} />
                <p className="text-sm font-bold text-slate-900">Where should they sit?</p>
              </div>
              <select value={assignUnitId} onChange={(e) => setAssignUnitId(e.target.value)} className={fieldClass}>
                <option value="">Select company or branch</option>
                {assignableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.isLeaf ? ' — branch' : ' — company'}
                  </option>
                ))}
              </select>
              {!hasCompanies ? (
                <p className="mt-1.5 text-[12px] text-amber-700">
                  Create a company first on the Create tab.
                </p>
              ) : null}
              <WizardNav onNext={() => setPeopleStep(2)} nextDisabled={!assignUnitId} />
            </div>
          ) : null}

          {peopleStep === 2 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={2} />
                <p className="text-sm font-bold text-slate-900">Existing person or new login?</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  active={peopleMode === 'existing'}
                  title="Existing person"
                  hint="Move someone already on this tenant"
                  onClick={() => setPeopleMode('existing')}
                />
                <Choice
                  active={peopleMode === 'new'}
                  title="New login"
                  hint="Create an account with email and temporary password"
                  onClick={() => setPeopleMode('new')}
                />
              </div>
              <WizardNav onBack={() => setPeopleStep(1)} onNext={() => setPeopleStep(3)} />
            </div>
          ) : null}

          {peopleStep === 3 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={3} />
                <p className="text-sm font-bold text-slate-900">{peopleMode === 'new' ? 'Account details' : 'Who to place'}</p>
              </div>
              {peopleMode === 'existing' ? (
                <div>
                  <label className={labelClass}>Person</label>
                  <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className={fieldClass}>
                    <option value="">Select team member</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {personName(m)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>First name</label>
                    <input value={assignFirst} onChange={(e) => setAssignFirst(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Last name</label>
                    <input value={assignLast} onChange={(e) => setAssignLast(e.target.value)} className={fieldClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Email (login ID)</label>
                    <input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} className={fieldClass} />
                  </div>
                </div>
              )}
              <WizardNav onBack={() => setPeopleStep(2)} onNext={() => setPeopleStep(4)} nextDisabled={!peopleDetailsReady} />
            </div>
          ) : null}

          {peopleStep === 4 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={4} />
                <p className="text-sm font-bold text-slate-900">Role on this company</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>On this company they are</label>
                  <select
                    value={assignPurpose}
                    onChange={(e) => setAssignPurpose(e.target.value as typeof assignPurpose)}
                    className={fieldClass}
                  >
                    <option value="member">Team member</option>
                    <option value="company_head">Company admin</option>
                    <option value="site_head">Branch admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Team access role</label>
                  <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)} className={fieldClass}>
                    <option value="">{peopleMode === 'new' ? 'Admin (recommended)' : 'Keep current role'}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roleName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <WizardNav
                onBack={() => setPeopleStep(3)}
                onNext={() => void savePeople()}
                submit
                submitLabel={peopleMode === 'new' ? 'Create login' : 'Place person'}
                saving={saving}
                nextDisabled={saving || !hasCompanies}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
