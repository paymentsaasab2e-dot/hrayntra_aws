'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Edit2,
  MapPin,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
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
  apiUpdateOrgUnit,
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

function peopleLabel(n: number) {
  return `${n} ${n === 1 ? 'user' : 'users'}`;
}

function StructureUnitRow({
  unit,
  depth,
  canWrite,
  isTenantAdmin,
  unassignedCount,
  editingId,
  editName,
  onEditNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAddChild,
  onAddUser,
  onDelete,
  onAdopt,
  onStampData,
}: {
  unit: OrgUnitNode;
  depth: number;
  canWrite: boolean;
  isTenantAdmin: boolean;
  unassignedCount: number;
  editingId: string | null;
  editName: string;
  onEditNameChange: (v: string) => void;
  onStartEdit: (unit: OrgUnitNode) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddUser: (unitId: string) => void;
  onDelete: (id: string) => void;
  onAdopt: (id: string) => void;
  onStampData: (id: string) => void;
}) {
  const isHq = !unit.parentId;
  const isCompany = unit.levelOrder === 2 && !unit.isLeaf;
  const isBranch = Boolean(unit.isLeaf);
  const Icon = isBranch ? MapPin : Building2;
  const typeLabel = isHq ? 'HQ' : isBranch ? 'Branch' : 'Company';
  const branchCount = isCompany ? (unit.children || []).length : 0;
  const directPeople = (unit.people || []).length;
  const totalPeople = unit.subtreePeople ?? unit.peopleCount ?? directPeople;
  const [open, setOpen] = useState(depth <= 1 || isHq);
  const isEditing = editingId === unit.id;

  return (
    <div className={depth > 0 ? 'border-t border-slate-100' : ''}>
      <div
        className={`flex flex-wrap items-center gap-3 px-4 py-3 ${depth === 0 ? 'bg-slate-50/80' : depth === 1 ? 'bg-white' : 'bg-slate-50/40'}`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="rounded-lg bg-white p-2 text-slate-600 ring-1 ring-slate-200">
            <Icon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEdit(unit.id);
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => onSaveEdit(unit.id)}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-[12px] font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-bold text-slate-900">{unit.name}</h3>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {typeLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {peopleLabel(totalPeople)}
                  {isCompany ? ` · ${branchCount} ${branchCount === 1 ? 'branch' : 'branches'}` : null}
                  {isHq && unassignedCount > 0 ? ` · ${unassignedCount} not in a company` : null}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canWrite && isHq ? (
            <button
              type="button"
              onClick={() => onAddChild(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={12} /> Add company
            </button>
          ) : null}
          {canWrite && isCompany ? (
            <>
              <button
                type="button"
                onClick={() => onAddChild(unit.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus size={12} /> Add branch
              </button>
              <button
                type="button"
                onClick={() => onAddUser(unit.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-medium text-sky-800 hover:bg-sky-100"
              >
                <UserPlus size={12} /> Add user
              </button>
            </>
          ) : null}
          {canWrite && isBranch ? (
            <button
              type="button"
              onClick={() => onAddUser(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-medium text-sky-800 hover:bg-sky-100"
            >
              <UserPlus size={12} /> Add user
            </button>
          ) : null}
          {canWrite && !isHq && !isEditing ? (
            <button
              type="button"
              onClick={() => onStartEdit(unit)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
              title="Edit name"
            >
              <Edit2 size={12} /> Edit
            </button>
          ) : null}
          {isTenantAdmin && !isHq && unassignedCount > 0 ? (
            <button
              type="button"
              onClick={() => onAdopt(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-900 hover:bg-amber-100"
            >
              Move leftover team
            </button>
          ) : null}
          {isTenantAdmin && !isHq ? (
            <button
              type="button"
              onClick={() => onStampData(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Assign users & data
            </button>
          ) : null}
          {isTenantAdmin && !isHq ? (
            <button
              type="button"
              onClick={() => onDelete(unit.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
            >
              <Trash2 size={12} /> Remove
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div>
          {(unit.people || []).length ? (
            <ul className="border-t border-slate-100 bg-white px-4 py-2" style={{ paddingLeft: `${36 + depth * 20}px` }}>
              {(unit.people || []).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {(p.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                      {p.email ? <p className="truncate text-[11px] text-slate-400">{p.email}</p> : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                    {p.unassigned
                      ? 'Not in a company yet'
                      : `${p.roleName || 'No role'} · ${p.purposeLabel || 'Member'}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : !isHq || !(unit.children || []).length ? (
            <p
              className="border-t border-slate-100 px-4 py-3 text-[12px] text-slate-400"
              style={{ paddingLeft: `${36 + depth * 20}px` }}
            >
              No users under this {typeLabel.toLowerCase()} yet.
              {canWrite && !isHq ? (
                <>
                  {' '}
                  <button type="button" className="font-semibold text-sky-700 underline" onClick={() => onAddUser(unit.id)}>
                    Add user
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {(unit.children || []).map((child) => (
            <StructureUnitRow
              key={child.id}
              unit={child}
              depth={depth + 1}
              canWrite={canWrite}
              isTenantAdmin={isTenantAdmin}
              unassignedCount={unassignedCount}
              editingId={editingId}
              editName={editName}
              onEditNameChange={onEditNameChange}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onAddChild={onAddChild}
              onAddUser={onAddUser}
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
  const [unassignedPeopleIds, setUnassignedPeopleIds] = useState<string[]>([]);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiOrgTree();
      setTree(data.tree);
      setIsTenantAdmin(Boolean(data.scope?.isTenantAdmin));
      setUnassignedCount(Number(data.unassignedCount || 0));
      const leftoverIds = (data.unassignedPeople || []).map((p) => String(p.id)).filter(Boolean);
      // Also collect anyone marked unassigned on the HQ card (same people, belt-and-suspenders).
      for (const p of data.tree?.people || []) {
        if (p.unassigned && p.id && !leftoverIds.includes(String(p.id))) {
          leftoverIds.push(String(p.id));
        }
      }
      setUnassignedPeopleIds(leftoverIds);
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

  const branches = useMemo(() => {
    const out: OrgUnitNode[] = [];
    function walk(node?: OrgUnitNode | null) {
      if (!node) return;
      if (node.isLeaf) out.push(node);
      (node.children || []).forEach(walk);
    }
    walk(tree);
    return out;
  }, [tree]);

  const assignedPeopleCount = useMemo(() => {
    let n = 0;
    function walk(node?: OrgUnitNode | null) {
      if (!node) return;
      if (node.parentId) n += (node.people || []).filter((p) => !p.unassigned).length;
      (node.children || []).forEach(walk);
    }
    walk(tree);
    return n;
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
        userIds:
          source === 'people'
            ? selectedUserIds
            : source === 'workspace'
              ? unassignedPeopleIds
              : undefined,
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
      const stamped = created?.stamped;
      const peopleN = Number(created?.attachedCount || 0);
      const dataN =
        Number(stamped?.jobs || 0) +
        Number(stamped?.leads || 0) +
        Number(stamped?.clients || 0) +
        Number(stamped?.candidates || 0);
      if (source === 'workspace' || source === 'people' || source === 'department') {
        toast.success(
          `Created ${created?.name || name}: ${peopleN} people · ${stamped?.jobs || 0} jobs · ${stamped?.leads || 0} leads · ${stamped?.clients || 0} clients · ${stamped?.candidates || 0} candidates`,
        );
        if (peopleN === 0 && dataN === 0 && source === 'workspace') {
          toast.message('No leftover people/data found to move. Use “Assign existing users & data here” on the company if CRM rows still show under All companies only.');
        }
      } else {
        toast.success(unitKind === 'site' ? 'Branch created' : 'Company created');
      }
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

  const promptAddUser = (unitId: string) => {
    setAssignUnitId(unitId);
    setPeopleMode('existing');
    setPeopleStep(1);
    setTab('people');
  };

  const startEditUnit = (unit: OrgUnitNode) => {
    setEditingId(unit.id);
    setEditName(unit.name);
  };

  const cancelEditUnit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEditUnit = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      toast.error('Name cannot be empty.');
      return;
    }
    try {
      await apiUpdateOrgUnit(id, { name });
      toast.success('Updated');
      setEditingId(null);
      setEditName('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update');
    }
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
      const result = await apiAdoptWorkspace(id, unassignedPeopleIds);
      const stamped = result.stamped;
      const stampNote = stamped
        ? ` Also linked ${stamped.jobs} jobs, ${stamped.leads} leads, ${stamped.clients} clients, ${stamped.candidates} candidates.`
        : '';
      if (!result.attachedCount) {
        toast.error(
          `Could not move anyone into ${result.name}. Try Add users → assign each person, or restart the API and try again.`,
        );
      } else {
        toast.success(`Moved ${result.attachedCount} people into ${result.name}.${stampNote}`);
      }
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
      const result = await apiStampUntaggedToOrgUnit(id, unassignedPeopleIds);
      const s = result.stamped;
      if (!result.attachedCount && !(s.jobs || s.leads || s.clients || s.candidates)) {
        toast.error(
          `${result.name}: nothing linked. Try again after restarting the API, or recreate the company and use “Move current team in”.`,
        );
      } else {
        toast.success(
          `${result.name}: ${result.attachedCount || 0} people · ${s.jobs} jobs · ${s.leads} leads · ${s.clients} clients · ${s.candidates} candidates`,
        );
      }
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
      setTab('structure');
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
        { id: 'create', label: 'Create' },
        { id: 'people', label: 'Add users' },
      ]
    : [{ id: 'structure', label: 'Structure' }];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <Toaster position="top-right" />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization</h1>
          <p className="mt-1 text-sm text-slate-500">
            Companies and branches under this tenant, with users assigned to each — same pattern as Team.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setUnitKind('company');
                setCreateStep(1);
                setTab('create');
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-[13px] font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={14} /> Company
            </button>
            <button
              type="button"
              disabled={!hasCompanies}
              onClick={() => {
                setUnitKind('site');
                setSiteParentId(companies[0]?.id || '');
                setCreateStep(1);
                setTab('create');
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus size={14} /> Branch
            </button>
            <button
              type="button"
              disabled={!assignableUnits.length}
              onClick={() => {
                setPeopleMode('new');
                setPeopleStep(1);
                setTab('people');
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-[13px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-40"
            >
              <UserPlus size={14} /> User
            </button>
          </div>
        ) : null}
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

      {tab === 'structure' ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Companies</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{companies.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Branches</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{branches.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Users assigned</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Users size={18} className="text-slate-400" />
              {assignedPeopleCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Not in a company</p>
            <p className={`mt-1 text-2xl font-bold ${unassignedCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {unassignedCount}
            </p>
          </div>
        </div>
      ) : null}

      {unassignedCount > 0 && tab === 'structure' ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <p className="font-semibold">{unassignedCount} people are still on this tenant only</p>
          <p className="mt-0.5 text-amber-800/90">
            Use{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                setTab('create');
                setCreateStep(2);
              }}
            >
              Create → Move current team in
            </button>
            , or <span className="font-semibold">Move leftover team</span> /{' '}
            <span className="font-semibold">Assign users & data</span> on a company below.
          </p>
        </div>
      ) : null}

      {tab === 'structure' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Structure</h2>
              <p className="text-[13px] text-slate-500">
                HQ → companies → branches. Expand a row to see users and nested units.
              </p>
            </div>
            {canWrite ? (
              <button
                type="button"
                onClick={() => {
                  setUnitKind('company');
                  setCreateStep(1);
                  setTab('create');
                }}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-sky-700 hover:text-sky-900"
              >
                <Plus size={14} /> Add company
              </button>
            ) : null}
          </div>
          <div>
            {loading ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : tree ? (
              <StructureUnitRow
                unit={tree}
                depth={0}
                canWrite={canWrite}
                isTenantAdmin={isTenantAdmin}
                unassignedCount={unassignedCount}
                editingId={editingId}
                editName={editName}
                onEditNameChange={setEditName}
                onStartEdit={startEditUnit}
                onCancelEdit={cancelEditUnit}
                onSaveEdit={(id) => void saveEditUnit(id)}
                onAddChild={promptAddChild}
                onAddUser={promptAddUser}
                onDelete={(id) => void removeUnit(id)}
                onAdopt={(id) => void adoptInto(id)}
                onStampData={(id) => void stampDataInto(id)}
              />
            ) : (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-500">No organization structure yet.</p>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUnitKind('company');
                      setTab('create');
                    }}
                    className="mt-3 text-sm font-semibold text-sky-700 hover:text-sky-900"
                  >
                    + Create first company
                  </button>
                ) : null}
              </div>
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
                    <p className="mt-1.5 text-[12px] text-slate-500">
                      Being {unitKind === 'site' ? 'branch' : 'company'} admin only sets what data they see (this{' '}
                      {unitKind === 'site' ? 'branch' : 'company'} and below). What they can <em>do</em> comes from this
                      role, so pick a role that already has the permissions you want — no need to tick permissions again
                      afterwards.
                    </p>
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
            <h2 className="text-base font-bold text-slate-900">Add users</h2>
          </div>
          <p className="text-[13px] text-slate-500">
            Assign an existing team member or create a new login under a company or branch.
          </p>
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
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
                Company / branch admin controls <span className="font-semibold">scope</span> — they see their own
                company and its branches only. Permissions still come from the{' '}
                <span className="font-semibold">team access role</span>. Choose a role such as Admin that already has
                the ticks you want; you only need to edit permissions in Team → Roles if that role is missing something.
              </p>
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
