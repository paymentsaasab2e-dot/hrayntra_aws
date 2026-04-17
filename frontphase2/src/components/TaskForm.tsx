'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Paperclip } from 'lucide-react';
import { TaskAssignmentField, type AssignmentAuditEvent } from './TaskAssignmentField';
import { TaskReminderField } from './TaskReminderField';
import {
  type TaskRelatedTo,
  type TaskPriority,
  type TaskFormValues,
  type TaskEditStatus,
  type TaskAssignee,
  type RelatedEntity,
  TASK_RELATED_TO_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_EDIT_STATUS_OPTIONS,
  MOCK_ASSIGNEES,
  MOCK_CANDIDATES,
  MOCK_JOBS,
  MOCK_CLIENTS,
  MOCK_INTERVIEWS,
} from '../app/Task&Activites/types';
import { apiGetUsers, apiGetCandidates, apiGetJobs, apiGetClients, type BackendUser, type BackendCandidate, type BackendJob, type BackendClient } from '../lib/api';

const DEFAULT_FORM_VALUES: TaskFormValues = {
  title: '',
  description: '',
  relatedTo: '',
  relatedEntityId: '',
  assigneeId: '',
  priority: '',
  dueDate: '',
  reminder: '',
  attachmentNames: '',
  notifyAssignee: true,
};

function formValuesEqual(a: TaskFormValues, b: TaskFormValues): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.relatedTo === b.relatedTo &&
    a.relatedEntityId === b.relatedEntityId &&
    a.assigneeId === b.assigneeId &&
    a.priority === b.priority &&
    a.dueDate === b.dueDate &&
    a.reminder === b.reminder &&
    a.attachmentNames === b.attachmentNames &&
    a.notifyAssignee === b.notifyAssignee &&
    (a.status ?? 'Pending') === (b.status ?? 'Pending')
  );
}

export interface TaskFormProps {
  mode: 'create' | 'edit';
  values: TaskFormValues;
  initialValues?: TaskFormValues;
  onChange: (values: TaskFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  lastUpdated?: { by: string; at: string };
  onDirtyChange?: (dirty: boolean) => void;
  /** Called when assignee is changed (for audit in edit mode) */
  onAssignmentChange?: (event: AssignmentAuditEvent) => void;
  /** Disable assignment (e.g. no permission to reassign) */
  assignDisabled?: boolean;
  assignNoPermission?: boolean;
}

export function TaskForm({
  mode,
  values,
  initialValues,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  lastUpdated,
  onDirtyChange,
  onAssignmentChange,
  assignDisabled,
  assignNoPermission,
}: TaskFormProps) {
  const [relatedToOpen, setRelatedToOpen] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [showCompletedConfirm, setShowCompletedConfirm] = useState(false);
  
  // Real data from API
  const [assignees, setAssignees] = useState<TaskAssignee[]>(MOCK_ASSIGNEES);
  const [candidates, setCandidates] = useState<RelatedEntity[]>(MOCK_CANDIDATES);
  const [jobs, setJobs] = useState<RelatedEntity[]>(MOCK_JOBS);
  const [clients, setClients] = useState<RelatedEntity[]>(MOCK_CLIENTS);
  const [interviews, setInterviews] = useState<RelatedEntity[]>(MOCK_INTERVIEWS);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Fetch real data from API
  useEffect(() => {
    const fetchData = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        // Use mock data if not authenticated
        return;
      }

      try {
        setLoadingEntities(true);
        
        // Fetch users/assignees
        try {
          const usersResponse = await apiGetUsers({ isActive: true, limit: 100 });
          const usersList = Array.isArray(usersResponse.data) 
            ? usersResponse.data 
            : (usersResponse.data as any)?.data || [];
          const mappedAssignees: TaskAssignee[] = usersList.map((u: BackendUser) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar,
            role: u.role,
          }));
          setAssignees(mappedAssignees);
        } catch (err) {
          console.error('Failed to fetch users:', err);
        }

        // Fetch candidates
        try {
          const candidatesResponse = await apiGetCandidates({ limit: 100 });
          const candidatesList = Array.isArray(candidatesResponse.data)
            ? candidatesResponse.data
            : (candidatesResponse.data as any)?.data || [];
          const mappedCandidates: RelatedEntity[] = candidatesList.map((c: BackendCandidate) => ({
            id: c.id,
            label: `${c.firstName} ${c.lastName}`,
            type: 'Candidate' as TaskRelatedTo,
          }));
          setCandidates(mappedCandidates);
        } catch (err) {
          console.error('Failed to fetch candidates:', err);
        }

        // Fetch jobs
        try {
          const jobsResponse = await apiGetJobs({ limit: 100 });
          const jobsList = Array.isArray(jobsResponse.data)
            ? jobsResponse.data
            : (jobsResponse.data as any)?.data || [];
          const mappedJobs: RelatedEntity[] = jobsList.map((j: BackendJob) => ({
            id: j.id,
            label: j.title,
            type: 'Job' as TaskRelatedTo,
          }));
          setJobs(mappedJobs);
        } catch (err) {
          console.error('Failed to fetch jobs:', err);
        }

        // Fetch clients
        try {
          const clientsResponse = await apiGetClients({ limit: 100 });
          const clientsList = Array.isArray(clientsResponse.data)
            ? clientsResponse.data
            : (clientsResponse.data as any)?.data || [];
          const mappedClients: RelatedEntity[] = clientsList.map((c: BackendClient) => ({
            id: c.id,
            label: c.companyName,
            type: 'Client' as TaskRelatedTo,
          }));
          setClients(mappedClients);
        } catch (err) {
          console.error('Failed to fetch clients:', err);
        }

        // Interviews - keep mock for now as there's no API endpoint yet
        // setInterviews(MOCK_INTERVIEWS);
      } catch (error) {
        console.error('Failed to fetch entities:', error);
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchData();
  }, []);

  const initial = useMemo(() => initialValues ?? { ...DEFAULT_FORM_VALUES }, [initialValues]);
  const isDirty = useMemo(() => !formValuesEqual(values, initial), [values, initial]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Helper function to get entities based on relatedTo type
  const getEntitiesForRelatedTo = (relatedTo: TaskRelatedTo): RelatedEntity[] => {
    switch (relatedTo) {
      case 'Candidate': return candidates;
      case 'Job': return jobs;
      case 'Client': return clients;
      case 'Interview': return interviews;
      default: return [];
    }
  };

  const entityOptions = useMemo(
    () => (values.relatedTo ? getEntitiesForRelatedTo(values.relatedTo) : []),
    [values.relatedTo, candidates, jobs, clients, interviews]
  );

  const isFormValid = useMemo(() => {
    if (!values.title.trim()) return false;
    if (!values.relatedTo) return false;
    if (values.relatedTo !== 'Internal' && !values.relatedEntityId) return false;
    if (!values.assigneeId) return false;
    if (!values.priority) return false;
    if (!values.dueDate) return false;
    if (mode === 'edit' && values.status === undefined) return false;
    return true;
  }, [values, mode]);

  const isPastDue = useMemo(() => {
    if (!values.dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(values.dueDate);
    return due < today;
  }, [values.dueDate]);

  const handleStatusSelect = (status: TaskEditStatus) => {
    if (status === 'Completed') {
      setShowCompletedConfirm(true);
      setStatusOpen(false);
      return;
    }
    onChange({ ...values, status });
    setStatusOpen(false);
  };

  const confirmCompleted = () => {
    onChange({ ...values, status: 'Completed' });
    setShowCompletedConfirm(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
      {lastUpdated && (
        <p className="text-xs text-slate-500 mb-3">
          Last updated by {lastUpdated.by} on {lastUpdated.at}
        </p>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Task Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={values.title}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
            placeholder="e.g. Follow up with Hiring Manager"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => onChange({ ...values, description: e.target.value })}
            placeholder="Add details..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Related To <span className="text-red-500">*</span></label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setRelatedToOpen((v) => !v); setEntityOpen(false); }}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <span className={values.relatedTo ? 'text-slate-900' : 'text-slate-400'}>{values.relatedTo || 'Select'}</span>
                <ChevronDown size={16} className="text-slate-400 shrink-0" />
              </button>
              {relatedToOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setRelatedToOpen(false)} aria-hidden />
                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {TASK_RELATED_TO_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          onClick={() => { onChange({ ...values, relatedTo: opt, relatedEntityId: '' }); setRelatedToOpen(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${values.relatedTo === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          {values.relatedTo && values.relatedTo !== 'Internal' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select {values.relatedTo}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEntityOpen((v) => !v)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <span className={values.relatedEntityId ? 'text-slate-900' : 'text-slate-400'}>
                    {entityOptions.find((e) => e.id === values.relatedEntityId)?.label ?? 'Search / Select'}
                  </span>
                  <ChevronDown size={16} className="text-slate-400 shrink-0" />
                </button>
                {entityOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setEntityOpen(false)} aria-hidden />
                    <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                      {entityOptions.map((e) => (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => { onChange({ ...values, relatedEntityId: e.id }); setEntityOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${values.relatedEntityId === e.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                          >
                            {e.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <TaskAssignmentField
          value={values.assigneeId}
          onChange={(assigneeId) => onChange({ ...values, assigneeId })}
          assignees={assignees}
          showNotifyCheckbox
          notifyAssignee={values.notifyAssignee}
          onNotifyChange={(v) => onChange({ ...values, notifyAssignee: v })}
          onAssignmentChange={onAssignmentChange}
          disabled={assignDisabled}
          noPermission={assignNoPermission}
          placeholder="Search or select user"
          required
          searchLoading={loadingEntities}
        />

        {mode === 'edit' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <span className={values.status ? 'text-slate-900' : 'text-slate-400'}>{values.status ?? 'Pending'}</span>
                <ChevronDown size={16} className="text-slate-400 shrink-0" />
              </button>
              {statusOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} aria-hidden />
                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {TASK_EDIT_STATUS_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          onClick={() => handleStatusSelect(opt)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${values.status === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Priority <span className="text-red-500">*</span></label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPriorityOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <span className={values.priority ? 'text-slate-900' : 'text-slate-400'}>{values.priority || 'Select'}</span>
                <ChevronDown size={16} className="text-slate-400 shrink-0" />
              </button>
              {priorityOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPriorityOpen(false)} aria-hidden />
                  <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {TASK_PRIORITY_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          onClick={() => { onChange({ ...values, priority: opt }); setPriorityOpen(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${values.priority === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Due Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={values.dueDate}
              onChange={(e) => onChange({ ...values, dueDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {isPastDue && (
              <p className="mt-1 text-xs text-amber-600 font-medium">Due date is in the past.</p>
            )}
          </div>
        </div>

        <TaskReminderField
          value={values.reminder}
          onChange={(reminder) => onChange({ ...values, reminder })}
          dueDate={values.dueDate}
          label="Reminder"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
          <label className="relative flex rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 transition-colors">
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                onChange({ 
                  ...values, 
                  attachmentNames: files.map((f) => f.name).join(', '),
                  // Store files in a hidden field that parent can access
                  _files: files as any,
                });
              }}
            />
            <div className="flex items-center gap-2 w-full">
              <Paperclip size={18} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-500">
                {values.attachmentNames || 'Click or drag files'}
                {values.attachmentNames && (
                  <span className="ml-2 text-xs text-slate-400">
                    ({values.attachmentNames.split(', ').length} file{values.attachmentNames.split(', ').length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
            </div>
          </label>
        </div>

      </div>

      {/* Completed confirmation */}
      {showCompletedConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 max-w-sm w-full">
            <p className="text-sm font-medium text-slate-900 mb-2">Mark as completed?</p>
            <p className="text-xs text-slate-500 mb-4">This task will be marked as completed when you save.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCompletedConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={confirmCompleted} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-5">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          disabled={!isFormValid || isSubmitting}
          onClick={onSubmit}
          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create Task' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
