'use client';

import React from 'react';
import { Eye, FileText } from 'lucide-react';
import type { ClientReviewBatchRow } from '../../lib/clientReviewTypes';
import { isClientReviewFileHref } from '../../lib/clientReviewAssets';

type Props = {
  rows: ClientReviewBatchRow[];
  onView: (row: ClientReviewBatchRow) => void;
  /** matchId → stage label the client marked (overrides row.clientMarkedStage). */
  stageByMatchId?: Record<string, string>;
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
  const candidate = candidateOf(row);
  const parts = [candidate.city, candidate.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length) return Array.from(new Set(parts)).join(', ');
  return String(candidate.address || '').trim();
}

function skillsLabel(row: ClientReviewBatchRow) {
  const skills = candidateOf(row).skills;
  if (!Array.isArray(skills)) return [];
  return skills.map((skill) => String(skill || '').trim()).filter(Boolean).slice(0, 3);
}

function educationLabel(row: ClientReviewBatchRow) {
  const candidate = candidateOf(row);
  const entries = Array.isArray(candidate.cvEducationEntries) ? candidate.cvEducationEntries : [];
  const first = entries.find((entry) => String(entry?.degree || entry?.institution || '').trim());
  if (first) {
    const degree = String(first.degree || '').trim();
    const institution = String(first.institution || (first as { instituteName?: string }).instituteName || '').trim();
    if (degree && institution) return `${degree} · ${institution}`;
    return degree || institution;
  }
  const raw = String(candidate.education || '').trim();
  if (!raw) return '';
  return raw.split('|')[0]?.trim() || raw;
}

function companyLabel(row: ClientReviewBatchRow) {
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

export function ClientReviewBatchTable({ rows, onView, stageByMatchId }: Props) {
  const showScore = rows.some((row) => {
    const score = row.matchScore ?? row.detail?.matchScore;
    return Number.isFinite(Number(score)) && row.detail?.trackerOptions?.showScore !== false;
  });
  const viewEnabled = rows.some((row) => row.detail?.trackerOptions?.viewProfile !== false);
  const showCompany = rows.some((row) => Boolean(companyLabel(row)));
  const showXp = rows.some((row) => Number.isFinite(Number(row.experience ?? row.detail?.candidate?.experience)));
  const showStage = rows.some((row) => row.detail?.trackerOptions?.changeStage !== false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6 lg:px-8">
        <h2 className="text-sm font-semibold text-slate-900">Submitted candidates</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Select a candidate to review the profile
          {rows.some((row) => row.detail?.trackerOptions?.addRemarks !== false)
            ? ' and submit your decision'
            : ''}
          {showStage ? ', pick a stage' : ''}
          , or open the CV directly.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 sm:px-6 lg:px-8">#</th>
              <th className="px-4 py-3 sm:px-6">Candidate</th>
              {showCompany ? <th className="px-4 py-3 sm:px-6">Company</th> : null}
              <th className="px-4 py-3 sm:px-6">Location</th>
              <th className="px-4 py-3 sm:px-6">Skills</th>
              <th className="px-4 py-3 sm:px-6">Education</th>
              {showXp ? <th className="px-4 py-3 sm:px-6">XP (yr)</th> : null}
              {showScore ? <th className="px-4 py-3 sm:px-6">Score</th> : null}
              {showStage ? <th className="px-4 py-3 sm:px-6">Stage</th> : null}
              <th className="px-4 py-3 text-right sm:px-6 lg:px-8">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
              const stage =
                String(stageByMatchId?.[row.matchId] || row.clientMarkedStage || row.detail?.clientMarkedStage || '').trim();
              return (
              <tr
                key={row.matchId}
                className="cursor-pointer transition hover:bg-indigo-50/40"
                onClick={() => onView(row)}
              >
                <td className="px-4 py-3.5 text-slate-400 sm:px-6 lg:px-8">{index + 1}</td>
                <td className="px-4 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
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
                      {email ? (
                        <p className="truncate text-xs text-slate-500">{email}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                {showCompany ? (
                  <td className="max-w-[10rem] truncate px-4 py-3.5 text-slate-600 sm:px-6">
                    {company || '—'}
                  </td>
                ) : null}
                <td className="max-w-[11rem] truncate px-4 py-3.5 text-slate-600 sm:px-6">
                  {location || '—'}
                </td>
                <td className="px-4 py-3.5 sm:px-6">
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
                <td className="max-w-[16rem] truncate px-4 py-3.5 text-slate-600 sm:px-6">
                  {education || '—'}
                </td>
                {showXp ? (
                  <td className="px-4 py-3.5 text-slate-600 sm:px-6">
                    {Number.isFinite(Number(experience)) ? Number(experience) : '—'}
                  </td>
                ) : null}
                {showScore ? (
                  <td className="px-4 py-3.5 text-slate-600 sm:px-6">
                    {Number.isFinite(Number(score)) ? Math.round(Number(score)) : '—'}
                  </td>
                ) : null}
                {showStage ? (
                  <td className="px-4 py-3.5 sm:px-6">
                    {stage ? (
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
                <td className="px-4 py-3.5 text-right sm:px-6 lg:px-8">
                  <div className="inline-flex flex-wrap items-center justify-end gap-2">
                    {cvAvailable ? (
                      <a
                        href={cvUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                    >
                      <Eye size={14} />
                      {viewEnabled ? 'View' : 'Open'}
                    </button>
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
