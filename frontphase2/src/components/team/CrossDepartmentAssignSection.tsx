'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Users2 } from 'lucide-react';
import {
  getCrossDeptAssignOptions,
  type CrossDeptTargetDepartment,
} from '../../lib/api/teamApi';

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  targetDepartmentId: string;
  targetMemberId: string;
  onDepartmentChange: (departmentId: string) => void;
  onMemberChange: (memberId: string) => void;
};

export function CrossDepartmentAssignSection({
  enabled,
  onEnabledChange,
  targetDepartmentId,
  targetMemberId,
  onDepartmentChange,
  onMemberChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [canInitiate, setCanInitiate] = useState(false);
  const [departments, setDepartments] = useState<CrossDeptTargetDepartment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getCrossDeptAssignOptions();
        if (!cancelled) {
          setCanInitiate(Boolean(data?.canInitiate));
          setDepartments(Array.isArray(data?.departments) ? data.departments : []);
        }
      } catch {
        if (!cancelled) {
          setCanInitiate(false);
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, []);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === targetDepartmentId) || null,
    [departments, targetDepartmentId],
  );

  if (loading || !canInitiate) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            onEnabledChange(e.target.checked);
            if (!e.target.checked) {
              onDepartmentChange('');
              onMemberChange('');
            }
          }}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">Cross-department request</span>
          <span className="block text-xs text-slate-600 mt-0.5">
            Send work to another department for their head to approve (department heads only).
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
              <Building2 size={14} /> Target department
            </label>
            <select
              value={targetDepartmentId}
              onChange={(e) => {
                onDepartmentChange(e.target.value);
                onMemberChange('');
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
              <Users2 size={14} /> Assign to member (optional)
            </label>
            <select
              value={targetMemberId}
              onChange={(e) => onMemberChange(e.target.value)}
              disabled={!selectedDept}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
            >
              <option value="">Department head decides</option>
              {(selectedDept?.members || []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.isDepartmentHead ? ' (Head)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
