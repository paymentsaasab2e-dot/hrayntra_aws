'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react';
import { formatDateDMY, formatDateTimeDMY } from '../../utils/dateDisplay';
import type { JobApplicationSubmission, JobForDrawer } from './JobDetailsDrawer';

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function displayValue(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v ?? '').trim()).filter(Boolean);
    return items.length ? items.join(', ') : fallback;
  }
  const text = String(value).trim();
  if (!text || text === '-') return fallback;
  return text;
}

function parseExperienceYears(experienceRequired?: string): { min: string; max: string } {
  const raw = String(experienceRequired || '').trim();
  if (!raw) return { min: '—', max: '—' };
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return { min: range[1], max: range[2] };
  const single = raw.match(/^(\d+)$/);
  if (single) return { min: single[1], max: '—' };
  return { min: raw, max: '—' };
}

function OverviewField({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </p>
      <p className="mt-1 break-words whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        {value}
      </p>
    </div>
  );
}

function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function formatApplicationCandidateName(app: JobApplicationSubmission) {
  const first = app.candidate?.firstName?.trim() || '';
  const last = app.candidate?.lastName?.trim() || '';
  const name = `${first} ${last}`.trim();
  return name || app.candidate?.email || 'Candidate';
}

function applicationAnswerRows(answers?: Record<string, unknown> | null) {
  if (!answers || typeof answers !== 'object') return [];
  return Object.entries(answers).map(([key, value]) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value:
      value === null || value === undefined
        ? '—'
        : typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value),
  }));
}

export interface JobOverviewTabContentProps {
  job: JobForDrawer;
  expandedApplicationIds: Set<string>;
  onToggleApplication: (applicationId: string) => void;
}

export function JobOverviewTabContent({
  job,
  expandedApplicationIds,
  onToggleApplication,
}: JobOverviewTabContentProps) {
  const { min: minExp, max: maxExp } = parseExperienceYears(job.experienceRequired);
  const skills = job.requiredSkills || [];
  const hasHtmlDescription = Boolean(job.description && /<[^>]+>/.test(job.description));
  const descriptionPlain = job.description ? stripHtml(job.description) : '';

  const recruiterDisplay =
    job.recruiter?.trim() && job.recruiter !== '-'
      ? job.recruiter
      : job.owner?.trim() && job.owner !== '-'
        ? job.owner
        : 'Unassigned';

  return (
    <div className="space-y-4">
      <OverviewSection title="Job posting details">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Job Description <span className="normal-case text-slate-500">(optional)</span>
          </p>
          <p className="mt-0.5 mb-2 text-xs text-slate-500">
            Rich-text editor for the full posting. Upload a JD above or use Generate JD with AI to pre-fill this
            field.
          </p>
          {hasHtmlDescription ? (
            <div
              className="prose prose-sm max-w-none min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 prose-p:my-2 prose-ul:my-2"
              dangerouslySetInnerHTML={{ __html: job.description || '' }}
            />
          ) : (
            <div className="min-h-[120px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {descriptionPlain || '—'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Nationality" value={displayValue(job.nationality)} />
          <OverviewField label="Job Title" value={displayValue(job.title)} required />
          <OverviewField label="Priority (optional)" value={displayValue(job.priority)} />
          <OverviewField label="Client" value={displayValue(job.client)} required />
          <OverviewField label="Contact Person (optional)" value={displayValue(job.hiringManager)} />
          <OverviewField label="No of Positions" value={displayValue(job.openings)} required />
          <OverviewField label="Country" value={displayValue(job.country)} required />
          <OverviewField label="State (optional)" value={displayValue(job.state)} />
          <OverviewField label="City (optional)" value={displayValue(job.city)} />
          <OverviewField label="Industry Type (optional)" value={displayValue(job.jobCategory)} />
          <OverviewField label="Employment Type (optional)" value={displayValue(job.employmentType)} />
          <OverviewField
            label="Target Hire Date"
            value={job.expectedClosureDate ? formatDateDMY(job.expectedClosureDate) : '—'}
            required
          />
          <OverviewField label="Other Document (optional)" value={displayValue(job.jdFileName)} />
          <OverviewField label="Minimum Years of Experience (optional)" value={minExp} />
          <OverviewField label="Maximum Years of Experience (optional)" value={maxExp} />
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Salary range (optional)</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewField label="Currency" value={displayValue(job.salaryCurrency)} />
            <OverviewField
              label="Min"
              value={job.minSalary !== undefined && job.minSalary !== null ? String(job.minSalary) : '—'}
            />
            <OverviewField
              label="Max"
              value={job.maxSalary !== undefined && job.maxSalary !== null ? String(job.maxSalary) : '—'}
            />
          </div>
          {job.salaryType ? <p className="mt-2 text-xs text-slate-500">Pay type: {job.salaryType}</p> : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Language &amp; Proficiency</p>
          {job.languages && job.languages.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {job.languages.map((row, index) => (
                <li
                  key={`${row.language}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"
                >
                  <span className="font-medium">{displayValue(row.language, '')}</span>
                  <span className="text-slate-400">•</span>
                  <span>{displayValue(row.proficiency, '—')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No languages added yet.
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Skills</p>
          {skills.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={`${skill}-${index}`}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No skills added yet.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Video or Image Link" value={displayValue(job.videoMediaLink)} />
          <OverviewField label="Forecast Revenue" value={displayValue(job.forecastRevenue)} />
          <OverviewField label="Assign Manager" value={displayValue(job.managerName)} />
          <OverviewField label="Assign Recruiter" value={recruiterDisplay} />
        </div>

        {job.location ? <OverviewField label="Location (combined)" value={displayValue(job.location)} /> : null}
      </OverviewSection>

      {(job.overview ||
        job.keyResponsibilities?.length ||
        job.preferredSkills?.length ||
        job.benefits?.length ||
        job.education ||
        job.requirements?.length) && (
        <OverviewSection title="Additional job content">
          {job.overview ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job summary</p>
              <p className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {job.overview}
              </p>
            </div>
          ) : null}
          {job.keyResponsibilities && job.keyResponsibilities.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Key responsibilities
              </p>
              <ul className="list-inside list-disc space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {job.keyResponsibilities.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {job.preferredSkills && job.preferredSkills.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Preferred skills</p>
              <div className="flex flex-wrap gap-2">
                {job.preferredSkills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {job.education ? <OverviewField label="Education" value={displayValue(job.education)} /> : null}
          {job.benefits && job.benefits.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Benefits</p>
              <p className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {job.benefits.join('\n')}
              </p>
            </div>
          ) : null}
        </OverviewSection>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <LayoutGrid size={14} className="text-slate-400" />
            Job applications
          </h4>
        </div>
        <div className="p-5">
          {Array.isArray(job.applications) && job.applications.length > 0 ? (
            <div className="space-y-2">
              {job.applications.map((app) => {
                const answers = applicationAnswerRows(app.screeningAnswers || null);
                const open = expandedApplicationIds.has(app.id);
                return (
                  <div key={app.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => onToggleApplication(app.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50/70"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatApplicationCandidateName(app)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {app.appliedAt ? formatDateTimeDMY(app.appliedAt) : 'Applied'}
                          {app.status ? ` • ${app.status}` : ''}
                        </p>
                      </div>
                      {open ? (
                        <ChevronDown size={16} className="shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-slate-400" />
                      )}
                    </button>
                    {open ? (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                        {answers.length > 0 ? (
                          <div className="space-y-2">
                            {answers.map((row) => (
                              <div
                                key={`${app.id}-${row.key}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  {row.label}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.value}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No screening answers submitted.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No applications yet for this job.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
