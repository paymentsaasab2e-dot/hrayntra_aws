'use client';

import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { KycDocumentsField } from '../documents/KycDocumentsField';
import type { TeamMemberListItem } from '../../lib/teamMemberFormDetails';
import {
  createEmptyTeamMember,
  hasTeamName,
  normalizeTeamMemberList,
} from '../../lib/teamMemberFormDetails';

export type TeamMemberOptionalFieldsProps = {
  teamName: string;
  members: TeamMemberListItem[];
  onChange: (members: TeamMemberListItem[]) => void;
  pendingKycFiles: File[];
  onPendingKycFilesChange: (files: File[]) => void;
  uploadingKyc?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  kycDisabled?: boolean;
};

export function TeamMemberOptionalFields({
  teamName,
  members,
  onChange,
  pendingKycFiles,
  onPendingKycFilesChange,
  uploadingKyc,
  uploadSuccess,
  uploadPercent,
  kycDisabled,
}: TeamMemberOptionalFieldsProps) {
  if (!hasTeamName(teamName)) return null;

  const normalizedMembers = normalizeTeamMemberList(members);

  const updateMember = (
    index: number,
    patch: Partial<TeamMemberListItem>,
  ) => {
    const next = normalizeTeamMemberList(normalizedMembers).map((member, memberIndex) =>
      memberIndex === index ? { ...member, ...patch } : member,
    );
    onChange(next);
  };

  const addMember = () => {
    onChange([...normalizedMembers, createEmptyTeamMember()]);
  };

  const removeMember = (index: number) => {
    const next = normalizedMembers.filter((_, memberIndex) => memberIndex !== index);
    onChange(next.length > 0 ? next : [createEmptyTeamMember()]);
  };

  return (
    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Team member details</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Add one or more team members for{' '}
              <span className="font-medium text-slate-700">{teamName.trim()}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addMember}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          <Plus size={14} />
          Add member
        </button>
      </div>
      <div className="space-y-4">
        {normalizedMembers.map((member, index) => (
          <div key={member.id || `team-member-${index}`} className="rounded-xl border border-blue-100 bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Team Member {index + 1}</p>
              {normalizedMembers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Designation of the team member
                </label>
                <input
                  value={member.teamMemberDesignation ?? ''}
                  onChange={(e) => updateMember(index, { teamMemberDesignation: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Account Manager"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Email ID of the team member
                </label>
                <input
                  type="email"
                  value={member.teamMemberEmail ?? ''}
                  onChange={(e) => updateMember(index, { teamMemberEmail: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="member@company.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Phone number of the team member
                </label>
                <input
                  type="tel"
                  value={member.teamMemberPhone ?? ''}
                  onChange={(e) => updateMember(index, { teamMemberPhone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>
        ))}
        <div className="sm:col-span-2">
          <KycDocumentsField
            label="KYC document of the team member (optional)"
            description="Choose files to upload after you save — PDF, DOC, DOCX, JPG, or PNG up to 10MB each. This is a file picker, not a text field."
            pendingFiles={pendingKycFiles}
            onPendingFilesChange={onPendingKycFilesChange}
            uploading={uploadingKyc}
            uploadSuccess={uploadSuccess}
            uploadPercent={uploadPercent}
            disabled={kycDisabled}
          />
        </div>
      </div>
    </div>
  );
}
