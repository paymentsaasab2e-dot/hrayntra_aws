'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { KycDocumentsField } from '../documents/KycDocumentsField';
import type { TeamMemberFormValues } from '../../lib/teamMemberFormDetails';
import { hasTeamName } from '../../lib/teamMemberFormDetails';

export type TeamMemberOptionalFieldsProps = {
  teamName: string;
  values: TeamMemberFormValues;
  onChange: (patch: Partial<TeamMemberFormValues>) => void;
  pendingKycFiles: File[];
  onPendingKycFilesChange: (files: File[]) => void;
  uploadingKyc?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  kycDisabled?: boolean;
};

export function TeamMemberOptionalFields({
  teamName,
  values,
  onChange,
  pendingKycFiles,
  onPendingKycFilesChange,
  uploadingKyc,
  uploadSuccess,
  uploadPercent,
  kycDisabled,
}: TeamMemberOptionalFieldsProps) {
  if (!hasTeamName(teamName)) return null;

  return (
    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-blue-600 shrink-0" />
        <div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Team member details</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Optional fields for a contact on{' '}
            <span className="font-medium text-slate-700">{teamName.trim()}</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Designation of the team member
          </label>
          <input
            value={values.teamMemberDesignation ?? ''}
            onChange={(e) => onChange({ teamMemberDesignation: e.target.value })}
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
            value={values.teamMemberEmail ?? ''}
            onChange={(e) => onChange({ teamMemberEmail: e.target.value })}
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
            value={values.teamMemberPhone ?? ''}
            onChange={(e) => onChange({ teamMemberPhone: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="+1 (555) 000-0000"
          />
        </div>
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
