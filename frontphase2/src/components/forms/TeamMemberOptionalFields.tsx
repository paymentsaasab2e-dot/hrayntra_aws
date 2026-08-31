'use client';

import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { KycDocumentsField } from '../documents/KycDocumentsField';
import { NAME_SALUTATION_OPTIONS, applySalutationFromNameInput } from '../../constants/salutations';
import type { TeamMemberListItem } from '../../lib/teamMemberFormDetails';
import {
  createEmptyTeamMember,
  hasTeamName,
  normalizeTeamMemberList,
} from '../../lib/teamMemberFormDetails';
import { CountryDialPhoneInput } from './CountryDialPhoneInput';
import { CONTACT_PERSON_ROW_GRID } from './DirectorContactFields';

export type TeamMemberOptionalFieldsProps = {
  members: TeamMemberListItem[];
  onChange: (members: TeamMemberListItem[]) => void;
  /** When true, the block stays hidden until `teamName` is filled (client drawer). */
  requireTeamName?: boolean;
  teamName?: string;
  countryCode?: string;
  countryName?: string;
  showKyc?: boolean;
  pendingKycFiles?: File[];
  onPendingKycFilesChange?: (files: File[]) => void;
  uploadingKyc?: boolean;
  uploadSuccess?: boolean;
  uploadPercent?: number;
  kycDisabled?: boolean;
};

export function TeamMemberOptionalFields({
  teamName = '',
  members,
  onChange,
  requireTeamName = true,
  countryCode = '',
  countryName = '',
  showKyc = false,
  pendingKycFiles = [],
  onPendingKycFilesChange,
  uploadingKyc,
  uploadSuccess,
  uploadPercent,
  kycDisabled,
}: TeamMemberOptionalFieldsProps) {
  const normalizedMembers = normalizeTeamMemberList(members);

  if (requireTeamName && !hasTeamName(teamName)) return null;

  const updateMember = (
    index: number,
    patch: Partial<TeamMemberListItem>,
  ) => {
    const next = normalizedMembers.map((member, memberIndex) =>
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
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-500">
        <Users size={12} />
        Team Member
      </p>
      <div className="space-y-2">
        {normalizedMembers.map((member, index) => (
          <div
            key={member.id || `team-member-${index}`}
            className={CONTACT_PERSON_ROW_GRID}
          >
            <select
              value={member.teamMemberSalutation ?? ''}
              onChange={(e) => updateMember(index, { teamMemberSalutation: e.target.value })}
              className="w-[5.75rem] min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:w-full"
              aria-label={`Team member ${index + 1} salutation`}
            >
              {NAME_SALUTATION_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              value={member.teamMemberName ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                const { salutation, name, salutationChanged } = applySalutationFromNameInput(
                  member.teamMemberSalutation ?? '',
                  value,
                );
                updateMember(index, {
                  ...(salutationChanged ? { teamMemberSalutation: salutation } : {}),
                  teamMemberName: name,
                  teamMemberDesignation: name,
                });
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Team member name"
              size={1}
            />
            <input
              type="email"
              value={member.teamMemberEmail ?? ''}
              onChange={(e) => updateMember(index, { teamMemberEmail: e.target.value })}
              className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Email"
              size={1}
            />
            <CountryDialPhoneInput
              value={member.teamMemberPhone ?? ''}
              onChange={(fullPhone) => updateMember(index, { teamMemberPhone: fullPhone })}
              countryCode={countryCode}
              countryName={countryName}
              className="w-full min-w-0"
              aria-label={`Team member ${index + 1} mobile number`}
            />
            <div className="flex shrink-0 items-center gap-2">
              {index === normalizedMembers.length - 1 ? (
                <button
                  type="button"
                  onClick={addMember}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                  aria-label="Add team member"
                >
                  <Plus size={16} />
                </button>
              ) : null}
              {normalizedMembers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove team member ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {showKyc && onPendingKycFilesChange ? (
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
      ) : null}
    </div>
  );
}
