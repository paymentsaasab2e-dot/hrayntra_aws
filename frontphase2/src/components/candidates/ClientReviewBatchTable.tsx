'use client';

import React, { useState } from 'react';
import { Eye, FileText, Loader2, MessageSquareText } from 'lucide-react';
import {
  CLIENT_PIPELINE_STAGE_CHOICES,
  type ClientReviewBatchRow,
} from '../../lib/clientReviewTypes';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';
import {
  clientTrackerAllowsResponse,
  normalizeClientTrackerOptions,
} from '../../lib/clientTrackerOptions';
import { isSubmitToClientReviewFieldVisible } from '../../lib/submitToClientFieldVisibility';

type Props = {
  rows: ClientReviewBatchRow[];
  onView: (row: ClientReviewBatchRow) => void;
  /** Opens feedback/comment dialog for this candidate (shared-link feedback). */
  onFeedback?: (row: ClientReviewBatchRow) => void;
  /** matchId → stage label the client marked (overrides row.clientMarkedStage). */
  stageByMatchId?: Record<string, string>;
  token?: string;
  apiBase?: string;
  /** Called after a stage is saved from the table dropdown. */
  onStageSubmitted?: (matchId: string, stageLabel: string) => void;
};

function stageBadgeClass(stage: string): string {
  const n = stage.toLowerCase();
  if (n.includes('reject')) return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (n.includes('hired') || n.includes('joined')) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (n.includes('offer')) return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (n.includes('shortlist') || n.includes('feedback')) return 'bg-sky-50 text-sky-800 ring-sky-100';
  if (n.includes('interview') || n.includes('screen')) return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (n.includes('submit')) return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  return 'bg-teal-50 text-teal-700 ring-teal-100';
}

function candidateOf(row: ClientReviewBatchRow) {
  return row.detail?.candidate || {};
}

function locationLabel(row: ClientReviewBatchRow) {
  const canLocation = isSubmitToClientReviewFieldVisible(
    'Location (display)',
    row.detail?.visibleFields,
  );
  const canCity = isSubmitToClientReviewFieldVisible('City', row.detail?.visibleFields);
  const canCountry = isSubmitToClientReviewFieldVisible('Country', row.detail?.visibleFields);
  if (!canLocation && !canCity && !canCountry) return '';

  const candidate = candidateOf(row);
  const parts = [canCity ? candidate.city : '', canCountry ? candidate.country : '']
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  if (!canLocation) return '';
  return String(candidate.address || '').trim();
}

function skillsLabel(row: ClientReviewBatchRow) {
  if (!isSubmitToClientReviewFieldVisible('Skills', row.detail?.visibleFields)) return [];
  const candidate = candidateOf(row);
  const fromCandidate = Array.isArray(candidate.skills)
    ? candidate.skills.map((skill) => String(skill || '').trim()).filter(Boolean)
    : [];
  if (fromCandidate.length) return fromCandidate.slice(0, 3);

  const sections = Array.isArray(row.detail?.presentationSections)
    ? row.detail.presentationSections
    : [];
  for (const section of sections) {
    for (const field of section.fields || []) {
      const label = String(field.label || '')
        .trim()
        .toLowerCase();
      if (label !== 'skills' && label !== 'domain of expertise') continue;
      const parts = String(field.value || '')
        .split(/[,|\n]/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length) return parts.slice(0, 3);
    }
  }
  return [];
}

function educationLabel(row: ClientReviewBatchRow) {
  const canShowEntries = isSubmitToClientReviewFieldVisible(
    'Education entries',
    row.detail?.visibleFields,
  );
  const canShowSummary = isSubmitToClientReviewFieldVisible(
    'Education summary',
    row.detail?.visibleFields,
  );
  if (!canShowEntries && !canShowSummary) return '';

  const candidate = candidateOf(row);
  if (canShowEntries) {
    const entries = Array.isArray(candidate.cvEducationEntries) ? candidate.cvEducationEntries : [];
    const first = entries.find((entry) =>
      String(
        entry?.degree || entry?.institution || (entry as { instituteName?: string })?.instituteName || '',
      ).trim(),
    );
    if (first) {
      const degree = String(first.degree || '').trim();
      const institution = String(
        first.institution || (first as { instituteName?: string }).instituteName || '',
      ).trim();
      if (degree && institution) return `${degree} · ${institution}`;
      return degree || institution;
    }
  }
  if (canShowSummary) {
    const raw = String(candidate.education || '').trim();
    if (raw) return raw.split('|')[0]?.trim() || raw;
  }

  const sections = Array.isArray(row.detail?.presentationSections)
    ? row.detail.presentationSections
    : [];
  for (const section of sections) {
    if (
      canShowEntries &&
      String(section.id || '').toLowerCase() === 'education' &&
      Array.isArray(section.entries)
    ) {
      const entry = section.entries[0];
      if (entry) {
        const degree = String(entry.degreeProgram || entry.degree || entry.title || '').trim();
        const institution = String(
          entry.institutionName || entry.institution || entry.company || '',
        ).trim();
        if (degree && institution) return `${degree} · ${institution}`;
        if (degree || institution) return degree || institution;
      }
    }
    if (!canShowSummary) continue;
    for (const field of section.fields || []) {
      const label = String(field.label || '')
        .trim()
        .toLowerCase();
      if (!label.includes('education')) continue;
      const value = String(field.value || '').trim();
      if (value) return value.split('|')[0]?.trim() || value;
    }
  }
  return '';
}

function companyLabel(row: ClientReviewBatchRow) {
  if (!isSubmitToClientReviewFieldVisible('Current Employer', row.detail?.visibleFields)) {
    return '';
  }
  return String(candidateOf(row).currentCompany || row.designation || '').trim();
}

function resumeUrlOf(row: ClientReviewBatchRow): string {
  return String(row.detail?.sharedResumeUrl || row.detail?.candidate?.resume || '').trim();
}

function canOpenCv(row: ClientReviewBatchRow): boolean {
  if (row.detail?.trackerOptions?.downloadResume === false) return false;
  const url = resumeUrlOf(row);
  if (!url) return false;
  return url.startsWith('http') || isClientReviewFileHref(url);
}

function stageOptionsFor(row: ClientReviewBatchRow): Array<{ id: string; name: string }> {
  const fromDetail =
    Array.isArray(row.detail?.pipelineStages) && row.detail.pipelineStages.length
      ? row.detail.pipelineStages
      : CLIENT_PIPELINE_STAGE_CHOICES;
  return fromDetail
    .map((stage) => ({
      id: String(stage.id || stage.name || '').trim(),
      name: String(stage.name || '').trim(),
    }))
    .filter((stage) => stage.name);
}

export function ClientReviewBatchTable({
  rows,
  onView,
  onFeedback,
  stageByMatchId,
  token,
  apiBase,
  onStageSubmitted,
}: Props) {
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [stageErrorByMatchId, setStageErrorByMatchId] = useState<Record<string, string>>({});

  const showScore = rows.some((row) => {
    const score = row.matchScore ?? row.detail?.matchScore;
    return (
      Number.isFinite(Number(score)) &&
      row.detail?.trackerOptions?.showScore !== false &&
      isSubmitToClientReviewFieldVisible('Candidate Score', row.detail?.visibleFields)
    );
  });
  const viewEnabled = rows.some((row) => row.detail?.trackerOptions?.viewProfile !== false);
  const showCompany = rows.some((row) => Boolean(companyLabel(row)));
  const showXp = rows.some(
    (row) =>
      Number.isFinite(Number(row.experience ?? row.detail?.candidate?.experience)) &&
      isSubmitToClientReviewFieldVisible('Experience (years)', row.detail?.visibleFields),
  );
  const showStage = rows.some((row) => normalizeClientTrackerOptions(row.detail?.trackerOptions).changeStage);

  const saveStage = async (row: ClientReviewBatchRow, nextStage: string) => {
    const matchId = String(row.matchId || '').trim();
    const stage = String(nextStage || '').trim();
    if (!matchId || !stage || !token || !apiBase) return;

    const current = String(
      stageByMatchId?.[matchId] || row.clientMarkedStage || row.detail?.clientMarkedStage || '',
    ).trim();
    if (current.toLowerCase() === stage.toLowerCase()) return;

    setSavingMatchId(matchId);
    setStageErrorByMatchId((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    try {
      const formData = new FormData();
      formData.append('stage', stage);
      formData.append('matchId', matchId);

      const response = await fetch(
        `${apiBase}/interviews/public/review/${encodeURIComponent(token)}/tag`,
        {
          method: 'POST',
          body: formData,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Unable to save stage');
      }
      const stageLabel = String(payload?.data?.stageLabel || stage).trim() || stage;
      onStageSubmitted?.(matchId, stageLabel);
    } catch (err: unknown) {
      setStageErrorByMatchId((prev) => ({
        ...prev,
        [matchId]: err instanceof Error ? err.message : 'Unable to save stage',
      }));
    } finally {
      setSavingMatchId((current) => (current === matchId ? null : current));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Submitted candidates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Open the CV, view the profile
          {rows.some((row) =>
            clientTrackerAllowsResponse(normalizeClientTrackerOptions(row.detail?.trackerOptions)),
          )
            ? ', or leave feedback'
            : ''}
          {rows.some((row) => row.detail?.trackerOptions?.addRemarks !== false)
            ? ' and submit your decision'
            : ''}
          {showStage ? ', pick a stage' : ''}
          .
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
            <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <th className="px-4 py-3.5 sm:px-6 lg:px-8">#</th>
              <th className="px-4 py-3.5 sm:px-6">Candidate</th>
              {showCompany ? <th className="px-4 py-3.5 sm:px-6">Company</th> : null}
              <th className="px-4 py-3.5 sm:px-6">Location</th>
              <th className="px-4 py-3.5 sm:px-6">Skills</th>
              <th className="px-4 py-3.5 sm:px-6">Education</th>
              {showXp ? <th className="px-4 py-3.5 sm:px-6">EXP (yr)</th> : null}
              {showScore ? <th className="px-4 py-3.5 sm:px-6">Score</th> : null}
              {showStage ? <th className="px-4 py-3.5 sm:px-6">Stage</th> : null}
              <th className="px-4 py-3.5 text-right sm:px-6 lg:px-8">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const score = row.matchScore ?? row.detail?.matchScore;
              const location = locationLabel(row);
              const skills = skillsLabel(row);
              const education = educationLabel(row);
              const company = companyLabel(row);
              const email = String(candidateOf(row).email || '').trim();
              const experience = row.experience ?? row.detail?.candidate?.experience;
              const cvUrl = resumeUrlOf(row);
              const cvAvailable = canOpenCv(row);
              const tracker = normalizeClientTrackerOptions(row.detail?.trackerOptions);
              const canPickStage = tracker.changeStage;
              const stageOptions = stageOptionsFor(row);
              const stage = String(
                stageByMatchId?.[row.matchId] ||
                  row.clientMarkedStage ||
                  row.detail?.clientMarkedStage ||
                  '',
              ).trim();
              const selectValue =
                stage &&
                stageOptions.some((option) => option.name.toLowerCase() === stage.toLowerCase())
                  ? stageOptions.find((option) => option.name.toLowerCase() === stage.toLowerCase())
                      ?.name || stage
                  : stage;
              const stageError = stageErrorByMatchId[row.matchId];
              const saving = savingMatchId === row.matchId;

              return (
                <tr
                  key={row.matchId}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/40"
                  onClick={() => onView(row)}
                >
                  <td className="px-4 py-4 text-slate-400 sm:px-6 lg:px-8">{index + 1}</td>
                  <td className="px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-bold text-white">
                        {String(row.candidateName || 'C')
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase() || 'C'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{row.candidateName || 'Candidate'}</p>
                        {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
                      </div>
                    </div>
                  </td>
                  {showCompany ? (
                    <td className="max-w-[10rem] truncate px-4 py-4 text-slate-600 sm:px-6">
                      {company || '—'}
                    </td>
                  ) : null}
                  <td className="max-w-[11rem] truncate px-4 py-4 text-slate-600 sm:px-6">
                    {location || '—'}
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    {skills.length ? (
                      <div className="flex max-w-[16rem] flex-wrap gap-1">
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-4 text-slate-600 sm:px-6">
                    {education || '—'}
                  </td>
                  {showXp ? (
                    <td className="px-4 py-4 text-slate-600 sm:px-6">
                      {Number.isFinite(Number(experience)) ? Number(experience) : '—'}
                    </td>
                  ) : null}
                  {showScore ? (
                    <td className="px-4 py-4 text-slate-600 sm:px-6">
                      {Number.isFinite(Number(score)) ? Math.round(Number(score)) : '—'}
                    </td>
                  ) : null}
                  {showStage ? (
                    <td className="px-4 py-4 sm:px-6" onClick={(event) => event.stopPropagation()}>
                      {canPickStage && token && apiBase ? (
                        <div className="min-w-[10.5rem] max-w-[14rem]">
                          <div className="relative">
                            <select
                              value={selectValue}
                              disabled={saving || !stageOptions.length}
                              aria-label={`Stage for ${row.candidateName || 'candidate'}`}
                              onChange={(event) => {
                                void saveStage(row, event.target.value);
                              }}
                              className={`w-full appearance-none rounded-full border-0 bg-slate-50 py-1.5 pl-3 pr-8 text-[11px] font-semibold outline-none ring-1 ring-inset focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 ${
                                stage
                                  ? stageBadgeClass(stage)
                                  : 'text-slate-500 ring-slate-200'
                              }`}
                            >
                              <option value="" disabled>
                                Select stage…
                              </option>
                              {selectValue &&
                              !stageOptions.some(
                                (option) => option.name.toLowerCase() === selectValue.toLowerCase(),
                              ) ? (
                                <option value={selectValue}>{selectValue}</option>
                              ) : null}
                              {stageOptions.map((option) => (
                                <option key={option.id || option.name} value={option.name}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                            {saving ? (
                              <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
                            ) : null}
                          </div>
                          {stageError ? (
                            <p className="mt-1 text-[10px] font-medium text-rose-600">{stageError}</p>
                          ) : null}
                        </div>
                      ) : stage ? (
                        <span
                          className={`inline-flex max-w-[12rem] truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${stageBadgeClass(stage)}`}
                          title={stage}
                        >
                          {stage}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-4 text-right sm:px-6 lg:px-8">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      {cvAvailable ? (
                        <a
                          href={cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <FileText size={14} />
                          CV
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onView(row);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        <Eye size={14} />
                        {viewEnabled ? 'View' : 'Open'}
                      </button>
                      {clientTrackerAllowsResponse(tracker) && onFeedback ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onFeedback(row);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <MessageSquareText size={14} />
                          Feedback
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
