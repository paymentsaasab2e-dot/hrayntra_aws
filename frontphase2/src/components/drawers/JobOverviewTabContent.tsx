'use client';

import type { ReactNode } from 'react';
import { Briefcase, DollarSign, FileText, GraduationCap, Link2 } from 'lucide-react';
import { formatDateDMY } from '../../utils/dateDisplay';
import { formatIndustriesDisplay } from '../../lib/industryOptions';
import { DrawerSectionCard } from './drawerFormUi';
import type { JobForDrawer } from './JobDetailsDrawer';

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </p>
      <p className="mt-0.5 break-words whitespace-pre-wrap text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function OverviewList({
  label,
  items,
  emptyLabel = 'Not provided',
}: {
  label: string;
  items?: string[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {items && items.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          {items.map((item, i) => (
            <li key={`${label}-${i}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{emptyLabel}</p>
      )}
    </div>
  );
}

function OverviewSkillTags({ label, skills }: { label: string; skills?: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      {skills && skills.length > 0 ? (
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
        <p className="mt-2 text-sm text-slate-400">Not provided</p>
      )}
    </div>
  );
}

function formatApplicationLogoLabel(logo?: string): string {
  const raw = String(logo || '').trim();
  if (!raw) return '—';
  if (raw === 'account') return 'Account logo';
  if (raw === 'company') return 'Company logo';
  if (raw === 'none') return 'No logo';
  if (/^https?:\/\//i.test(raw)) return 'Custom logo URL';
  return raw;
}

export interface JobOverviewTabContentProps {
  job: JobForDrawer;
}

export function JobOverviewTabContent({ job }: JobOverviewTabContentProps) {
  const { min: minExp, max: maxExp } = parseExperienceYears(job.experienceRequired);
  const requiredSkills = job.requiredSkills || [];
  const preferredSkills = job.preferredSkills || [];
  const hasHtmlDescription = Boolean(job.description && /<[^>]+>/.test(job.description));
  const descriptionPlain = job.description ? stripHtml(job.description) : '';
  const overviewPlain = job.overview ? stripHtml(job.overview) : '';
  const workModeLabel = displayValue(job.workMode || job.jobLocationType, '—');

  const recruiterDisplay =
    job.recruiter?.trim() && job.recruiter !== '-'
      ? job.recruiter
      : job.owner?.trim() && job.owner !== '-'
        ? job.owner
        : 'Unassigned';

  const screeningQuestionCount = Array.isArray(job.applicationFormQuestions)
    ? job.applicationFormQuestions.filter((q) => String(q || '').trim()).length
    : 0;

  return (
    <div className="space-y-5">
      <DrawerSectionCard
        title="Job Description"
        subtitle="Full role description and responsibilities"
        icon={FileText}
        accent="blue"
      >
        {hasHtmlDescription ? (
          <div
            className="prose prose-sm max-w-none min-h-[80px] rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-800 prose-p:my-2 prose-ul:my-2"
            dangerouslySetInnerHTML={{ __html: job.description || '' }}
          />
        ) : (
          <div className="min-h-[80px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            {descriptionPlain || '—'}
          </div>
        )}
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Job Details"
        subtitle="Title, client, location, and ownership"
        icon={Briefcase}
        accent="blue"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Job Title" value={displayValue(job.title)} required />
          <OverviewField label="Status" value={displayValue(job.status)} />
          <OverviewField label="Client" value={displayValue(job.client)} required />
          <OverviewField
            label="Client name on public posts"
            value={job.showClientNamePublicly === false ? 'Hidden from public' : 'Visible to public'}
          />
          <OverviewField label="Nationality" value={displayValue(job.nationality)} />
          <OverviewField label="Priority" value={displayValue(job.priority)} />
          <OverviewField label="Contact Person" value={displayValue(job.hiringManager)} />
          <OverviewField label="No. of Positions" value={displayValue(job.openings)} required />
          <OverviewField label="Country" value={displayValue(job.country)} required />
          <OverviewField label="State" value={displayValue(job.state)} />
          <OverviewField label="City" value={displayValue(job.city)} />
          <OverviewField label="Location (combined)" value={displayValue(job.location)} />
          <OverviewField
            label="Industry Type"
            value={displayValue(formatIndustriesDisplay(job.jobCategory) || job.jobCategory)}
          />
          <OverviewField label="Department" value={displayValue(job.department)} />
          <OverviewField label="Employment Type" value={displayValue(job.employmentType)} />
          <OverviewField label="Work Mode / Location Type" value={workModeLabel} />
          <OverviewField
            label="Target Hire Date"
            value={job.expectedClosureDate ? formatDateDMY(job.expectedClosureDate) : '—'}
            required
          />
          <OverviewField
            label="Posted Date"
            value={job.postedDate ? formatDateDMY(job.postedDate) : '—'}
          />
          <OverviewField
            label="Created Date"
            value={job.createdDate ? formatDateDMY(job.createdDate) : '—'}
          />
          <OverviewField label="Assign Manager" value={displayValue(job.managerName)} />
          <OverviewField label="Assign Recruiter" value={recruiterDisplay} />
          <OverviewField label="Visibility" value={displayValue(job.visibility)} />
          <OverviewField label="JD Document" value={displayValue(job.jdFileName)} />
          <OverviewField label="Video / Media Link" value={displayValue(job.videoMediaLink)} />
          <OverviewField label="Forecast Revenue" value={displayValue(job.forecastRevenue)} />
          <OverviewField label="Hot Job" value={displayValue(job.hot)} />
          <OverviewField label="AI Match Enabled" value={displayValue(job.aiMatch)} />
          <OverviewField label="SLA Risk" value={displayValue(job.slaRisk)} />
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Compensation"
        subtitle="Salary range, currency, and benefits"
        icon={DollarSign}
        accent="emerald"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewField label="Currency" value={displayValue(job.salaryCurrency)} />
          <OverviewField
            label="Minimum Salary"
            value={job.minSalary !== undefined && job.minSalary !== null ? String(job.minSalary) : '—'}
          />
          <OverviewField
            label="Maximum Salary"
            value={job.maxSalary !== undefined && job.maxSalary !== null ? String(job.maxSalary) : '—'}
          />
          <OverviewField label="Pay Type" value={displayValue(job.salaryType)} />
        </div>
        {job.salaryRange ? (
          <OverviewField label="Salary Range (display)" value={displayValue(job.salaryRange)} />
        ) : null}
        <OverviewList label="Benefits" items={job.benefits} />
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Requirements & Experience"
        subtitle="Skills, education, and qualifications"
        icon={GraduationCap}
        accent="amber"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Minimum Years of Experience" value={minExp} />
          <OverviewField label="Maximum Years of Experience" value={maxExp} />
          <OverviewField label="Education" value={displayValue(job.education)} />
        </div>
        {overviewPlain ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Job Summary</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{overviewPlain}</p>
          </div>
        ) : null}
        <OverviewList label="Key Responsibilities" items={job.keyResponsibilities} />
        <OverviewList label="Preferred Education / Qualifications" items={job.requirements} />
        <OverviewList label="Candidate Requirements" items={job.candidateRequirements} />
        <OverviewSkillTags label="Required Skills" skills={requiredSkills} />
        <OverviewSkillTags label="Preferred Skills" skills={preferredSkills} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Languages &amp; Proficiency
          </p>
          {job.languages && job.languages.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {job.languages.map((row, index) => (
                <li
                  key={`${row.language}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-800"
                >
                  <span className="font-medium">{displayValue(row.language, '')}</span>
                  <span className="text-slate-400">•</span>
                  <span>{displayValue(row.proficiency, '—')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Not provided</p>
          )}
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Application Form & Apply Link"
        subtitle="Public apply settings and screening"
        icon={Link2}
        accent="indigo"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewField label="Application Form Enabled" value={displayValue(job.applicationFormEnabled)} />
          <OverviewField
            label="Application Form Logo"
            value={formatApplicationLogoLabel(job.applicationFormLogo)}
          />
          <OverviewField
            label="Screening Questions"
            value={screeningQuestionCount > 0 ? String(screeningQuestionCount) : '—'}
          />
          <OverviewField label="Public Apply URL" value={displayValue(job.applyUrl)} />
        </div>
        {job.applicationFormNote ? (
          <OverviewField label="Note for Candidates" value={displayValue(job.applicationFormNote)} />
        ) : null}
        {Array.isArray(job.preScreenAssessments) && job.preScreenAssessments.length > 0 ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
              Pre-screen assessments
            </p>
            <ul className="mt-2 space-y-1.5">
              {job.preScreenAssessments.map((row, index) => (
                <li key={row.id || row.assessmentId || index} className="text-sm text-slate-700">
                  {index + 1}. {row.assessment?.title || 'Assessment'} ({row.assessment?.type || 'MCQ'})
                  {row.required === false ? ' · optional' : ' · required'}
                  {row.timing === 'BEFORE_SUBMIT' ? ' · before submit' : ' · after apply'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-violet-700">
          Candidate scores and review are in the <strong>Assessments</strong> tab.
        </p>
      </DrawerSectionCard>
    </div>
  );
}
