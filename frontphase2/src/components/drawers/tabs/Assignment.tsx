'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { UserCog, Loader2, X, ChevronDown } from 'lucide-react';
import { AssignCompanySelect } from '../../assign/AssignCompanySelect';
import { formatAssigneeOptionLabel } from '../../../lib/assigneeDisplay';
import { createPortal } from 'react-dom';
import type { AssignmentTabProps } from '../jobDrawerTabProps';

export function AssignmentTab(props: AssignmentTabProps) {
  const {
    applyAssignmentMemberIds,
    assignable,
    assignmentContacts,
    assignmentCurrentUserId,
    assignmentDirty,
    assignmentHiringManagerId,
    assignmentHiringManagerName,
    assignmentManagerId,
    assignmentManagerUsers,
    assignmentMemberIds,
    assignmentRecruiterMenuPosition,
    assignmentRecruiterMenuRef,
    assignmentRecruiterOpen,
    assignmentRecruiterTriggerRef,
    closeAssignmentRecruiterMenu,
    filteredAssignmentRecruiters,
    job,
    loadingAssignmentMeta,
    loadingAssignmentRecruiters,
    needsAssignmentManagerFirst,
    needsAssignmentOrganizationFirst,
    saveAssignment,
    savingAssignment,
    selectAssignmentManager,
    selectedAssignmentAssignees,
    setAssignmentDirty,
    setAssignmentHiringManagerId,
    setAssignmentHiringManagerName,
    setAssignmentManagerId,
    setAssignmentMemberIds,
    setAssignmentRecruiterOpen,
  } = props;

  return (
<DrawerSectionCard
                  title="Job Assignment"
                  subtitle="Assignment Rules for Jobs — organization, manager, and team ownership"
                  icon={UserCog}
                  accent="sky"
                  headerRight={
                    <button
                      type="button"
                      onClick={() => void saveAssignment()}
                      disabled={
                        !assignmentDirty ||
                        savingAssignment ||
                        loadingAssignmentMeta ||
                        loadingAssignmentRecruiters
                      }
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                        assignmentDirty &&
                        !savingAssignment &&
                        !loadingAssignmentMeta &&
                        !loadingAssignmentRecruiters
                          ? 'border border-sky-200 bg-sky-600 text-white hover:bg-sky-700'
                          : 'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {savingAssignment ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save assignment
                    </button>
                  }
                >
                    <div className="space-y-4">
                      {assignable.canSelectCompany ? (
                      <div>
                          <AssignCompanySelect
                            companies={assignable.companies}
                            value={assignable.companyId}
                            label="Organization"
                            onChange={(id: any) => {
                              assignable.setCompanyId(id);
                              if (id !== assignable.companyId) {
                                setAssignmentMemberIds([]);
                                setAssignmentManagerId('');
                                setAssignmentDirty(true);
                              }
                            }}
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            Assignment organization (who owns this job).
                          </p>
                        </div>
                      ) : null}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Manager
                        </label>
                        <select
                          value={assignmentManagerId}
                          disabled={
                            savingAssignment ||
                            loadingAssignmentRecruiters ||
                            needsAssignmentOrganizationFirst
                          }
                          onChange={(e: any) => selectAssignmentManager(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {!assignable.companiesReady || loadingAssignmentRecruiters
                              ? 'Loading…'
                              : needsAssignmentOrganizationFirst
                                ? 'Select an organization first'
                                : 'Select manager'}
                          </option>
                          {assignmentManagerId &&
                          !assignmentManagerUsers.some((u: any) => u.id === assignmentManagerId) ? (
                            <option value={assignmentManagerId}>
                              {String(job?.managerName || '').trim() || 'Current manager'}
                            </option>
                          ) : null}
                          {assignmentManagerUsers.map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {formatAssigneeOptionLabel(user, assignmentCurrentUserId)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-400">
                          You can assign this job to anyone Assignment Rules allow, including yourself.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Recruiters / Team members
                        </label>
                        {selectedAssignmentAssignees.length > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {selectedAssignmentAssignees.map((user: any, index: any) => (
                              <span
                                key={user.id}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800"
                              >
                                <span className="max-w-[180px] truncate">
                                  {formatAssigneeOptionLabel(user, assignmentCurrentUserId)}
                            </span>
                                {index === 0 ? (
                                  <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600">
                                    Primary
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  aria-label={`Remove ${formatAssigneeOptionLabel(user, assignmentCurrentUserId)}`}
                                  disabled={savingAssignment}
                                  onClick={() =>
                                    applyAssignmentMemberIds(
                                      assignmentMemberIds.filter((id: any) => id !== user.id),
                                    )
                                  }
                                  className="rounded-full p-0.5 text-sky-500 hover:bg-sky-100 hover:text-sky-700"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="relative">
                          <button
                            ref={assignmentRecruiterTriggerRef}
                            type="button"
                            disabled={savingAssignment}
                            onClick={() => setAssignmentRecruiterOpen((open: any) => !open)}
                            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50"
                          >
                            <span
                              className={
                                selectedAssignmentAssignees.length ? 'text-slate-700' : 'text-slate-400'
                              }
                            >
                              {selectedAssignmentAssignees.length
                                ? `${selectedAssignmentAssignees.length} selected — add more`
                                : !assignable.companiesReady || loadingAssignmentRecruiters
                                  ? 'Loading team…'
                                  : needsAssignmentOrganizationFirst
                                    ? 'Select an organization first'
                                    : needsAssignmentManagerFirst
                                      ? 'Select a manager first'
                                      : filteredAssignmentRecruiters.length === 0
                                        ? 'No people in Assignment Rules for Jobs'
                                        : 'Select people Assignment Rules allow'}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          </button>
                          {assignmentRecruiterOpen &&
                          assignmentRecruiterMenuPosition &&
                          typeof document !== 'undefined'
                            ? createPortal(
                                <div
                                  ref={assignmentRecruiterMenuRef}
                                  className="fixed z-[1200] max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
                                  style={{
                                    left: assignmentRecruiterMenuPosition.left,
                                    width: assignmentRecruiterMenuPosition.width,
                                    ...(assignmentRecruiterMenuPosition.placement === 'top'
                                      ? { bottom: assignmentRecruiterMenuPosition.bottom }
                                      : { top: assignmentRecruiterMenuPosition.top }),
                                  }}
                                >
                                  <ul>
                                    {loadingAssignmentRecruiters ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">Loading team…</li>
                                    ) : needsAssignmentOrganizationFirst ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        Select an organization to see members
                                      </li>
                                    ) : needsAssignmentManagerFirst ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        Select a manager to see their team
                                      </li>
                                    ) : filteredAssignmentRecruiters.length === 0 ? (
                                      <li className="px-4 py-2 text-sm text-slate-500">
                                        No people in Assignment Rules for Jobs
                                      </li>
                                    ) : (
                                      <>
                                        <li>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              applyAssignmentMemberIds([]);
                                              closeAssignmentRecruiterMenu();
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 text-slate-700"
                                          >
                                            Clear all
                                          </button>
                                        </li>
                                        {filteredAssignmentRecruiters.map((user: any) => {
                                          const checked = assignmentMemberIds.includes(user.id);
                                          const isPrimary = assignmentMemberIds[0] === user.id;
                                          return (
                                            <li key={user.id}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const next = checked
                                                    ? assignmentMemberIds.filter((id: any) => id !== user.id)
                                                    : [...assignmentMemberIds, user.id];
                                                  applyAssignmentMemberIds(next);
                                                }}
                                                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                                                  checked
                                                    ? 'bg-sky-50 text-sky-700 font-medium'
                                                    : 'text-slate-700'
                                                }`}
                                              >
                                                <span className="flex items-start gap-2">
                                                  <span
                                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                                      checked
                                                        ? 'border-sky-500 bg-sky-500 text-white'
                                                        : 'border-slate-300 bg-white'
                                                    }`}
                                                  >
                                                    {checked ? '✓' : ''}
                                                  </span>
                                                  <span className="min-w-0 flex-1">
                                                    <span className="block font-medium">
                                                      {formatAssigneeOptionLabel(
                                                        user,
                                                        assignmentCurrentUserId,
                                                      )}
                                                      {isPrimary ? (
                                                        <span className="ml-1 text-[10px] font-bold uppercase text-sky-500">
                                                          Primary
                                                        </span>
                                                      ) : null}
                                                    </span>
                                                    {user.email ? (
                                                      <span className="block text-xs text-slate-500 truncate">
                                                        {user.email}
                                                      </span>
                                                    ) : null}
                                                  </span>
                                                </span>
                                              </button>
                                            </li>
                                          );
                                        })}
                                      </>
                                    )}
                                  </ul>
                                </div>,
                                document.body,
                              )
                            : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Assign to anyone Assignment Rules allow for Jobs. First selected is the
                          primary recruiter; others are supporting.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Hiring manager
                        </label>
                        <select
                          value={assignmentHiringManagerId}
                          disabled={loadingAssignmentMeta || savingAssignment}
                          onChange={(e: any) => {
                            const nextId = e.target.value;
                            const contact = assignmentContacts.find((c: any) => c.id === nextId);
                            setAssignmentHiringManagerId(nextId);
                            setAssignmentHiringManagerName(contact?.name || '');
                            setAssignmentDirty(true);
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {assignmentHiringManagerName && !assignmentHiringManagerId
                              ? assignmentHiringManagerName
                              : 'None'}
                          </option>
                          {assignmentHiringManagerId &&
                          !assignmentContacts.some((c: any) => c.id === assignmentHiringManagerId) ? (
                            <option value={assignmentHiringManagerId}>
                              {assignmentHiringManagerName || 'Current hiring manager'}
                            </option>
                          ) : null}
                          {assignmentContacts.map((contact: any) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name}
                            </option>
                          ))}
                        </select>
                        {assignmentHiringManagerName && !assignmentHiringManagerId ? (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Saved as “{assignmentHiringManagerName}”. Pick a contact to link an ID.
                          </p>
                        ) : null}
                        {!job?.clientId ? (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Link a client to this job to choose from client contacts.
                          </p>
                        ) : null}
                      </div>
                    </div>
                </DrawerSectionCard>
  );
}
