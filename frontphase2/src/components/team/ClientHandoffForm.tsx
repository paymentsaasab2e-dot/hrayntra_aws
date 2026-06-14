'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  createCrossDeptRequest,
  getCrossDeptAssignOptions,
  type CrossDeptTargetDepartment,
} from '../../lib/api/teamApi';

type Props = {
  clientId: string;
  clientName: string;
  onSent?: () => void;
  onCancel?: () => void;
  showHeader?: boolean;
  submitLabel?: string;
  /** When true, renders nothing if the user cannot initiate handoffs. */
  hideWhenUnavailable?: boolean;
};

export function ClientHandoffForm({
  clientId,
  clientName,
  onSent,
  onCancel,
  showHeader = true,
  submitLabel = 'Send handoff request',
  hideWhenUnavailable = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canHandoffClient, setCanHandoffClient] = useState(false);
  const [departments, setDepartments] = useState<CrossDeptTargetDepartment[]>([]);
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetMemberId, setTargetMemberId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getCrossDeptAssignOptions();
        if (!cancelled) {
          setCanHandoffClient(Boolean(data?.canHandoffClient));
          setDepartments(Array.isArray(data?.departments) ? data.departments : []);
        }
      } catch {
        if (!cancelled) {
          setCanHandoffClient(false);
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === targetDepartmentId) || null,
    [departments, targetDepartmentId],
  );

  const departmentHead = useMemo(
    () => (selectedDept?.members || []).find((member) => member.isDepartmentHead) || null,
    [selectedDept],
  );

  const handleSend = async () => {
    if (!targetDepartmentId) {
      toast.error('Select a target department');
      return;
    }
    setSubmitting(true);
    try {
      await createCrossDeptRequest({
        subject: `Client handoff: ${clientName}`,
        description: note.trim() || `Please take ownership of client "${clientName}".`,
        workType: 'CLIENT',
        targetDepartmentId,
        targetUserId: targetMemberId || undefined,
        linkedEntityType: 'Client',
        linkedEntityId: clientId,
        priority: 'medium',
      });
      toast.success('Client handoff request sent for approval');
      setNote('');
      setTargetDepartmentId('');
      setTargetMemberId('');
      onSent?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    if (hideWhenUnavailable) return null;
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading departments…
      </div>
    );
  }

  if (!canHandoffClient) {
    if (hideWhenUnavailable) return null;
    return (
      <p className="py-4 text-sm text-slate-500">
        You need the &quot;Hand off clients to another department&quot; permission to use this feature.
      </p>
    );
  }

  const body = (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Hand off client to another department</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Sends a request to the target department head. Use Assigned To only for members in your own department.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">Target department</label>
          <select
            value={targetDepartmentId}
            onChange={(e) => {
              setTargetDepartmentId(e.target.value);
              setTargetMemberId('');
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">Department head / assignee</label>
          <select
            value={targetMemberId}
            onChange={(e) => setTargetMemberId(e.target.value)}
            disabled={!selectedDept}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">
              {departmentHead ? `${departmentHead.name} (Head) — default` : 'Department head decides'}
            </option>
            {(selectedDept?.members || []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.isDepartmentHead ? ' (Head)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDept ? (
        <p className="text-xs text-slate-500">
          Request will be sent to{' '}
          <span className="font-semibold text-slate-700">
            {departmentHead?.name || 'the department head'}
          </span>{' '}
          in {selectedDept.name} for approval.
        </p>
      ) : null}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Optional note for the receiving department head"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-none"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={submitting || !targetDepartmentId}
          onClick={() => void handleSend()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );

  if (showHeader) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">{body}</div>
    );
  }

  return body;
}
