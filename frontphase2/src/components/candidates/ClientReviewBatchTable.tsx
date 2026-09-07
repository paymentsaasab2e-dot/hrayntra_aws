'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import type { ClientReviewBatchRow } from '../../lib/clientReviewTypes';

type Props = {
  rows: ClientReviewBatchRow[];
  onView: (row: ClientReviewBatchRow) => void;
};

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

export function ClientReviewBatchTable({ rows, onView }: Props) {
  const showScore = rows.some((row) => {
    const score = row.matchScore ?? row.detail?.matchScore;
    return Number.isFinite(Number(score)) && row.detail?.trackerOptions?.showScore !== false;
  });
  const viewEnabled = rows.some((row) => row.detail?.trackerOptions?.viewProfile !== false);
  const showCompany = rows.some((row) => Boolean(companyLabel(row)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6 lg:px-8">
        <h2 className="text-sm font-semibold text-slate-900">Submitted candidates</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Open a candidate to review the profile
          {rows.some((row) => row.detail?.trackerOptions?.addRemarks !== false)
            ? ' and submit your decision'
            : ''}
          .
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
              {showScore ? <th className="px-4 py-3 sm:px-6">Score</th> : null}
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
                {showScore ? (
                  <td className="px-4 py-3.5 text-slate-600 sm:px-6">
                    {Number.isFinite(Number(score)) ? Math.round(Number(score)) : '—'}
                  </td>
                ) : null}
                <td className="px-4 py-3.5 text-right sm:px-6 lg:px-8">
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
