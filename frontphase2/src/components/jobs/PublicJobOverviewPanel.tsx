'use client';

import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import {
  isJobFieldPubliclyVisible,
  parseJobPublicFieldVisibility,
  type JobPublicVisibilityField,
} from '../../lib/jobPublicFieldVisibility';

export interface PublicJobOverviewJob {
  title?: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  overview?: string | null;
  keyResponsibilities?: string[];
  requirements?: string[];
  candidateRequirements?: string[];
  skills?: string[];
  preferredSkills?: string[];
  experienceRequired?: string | null;
  education?: string | null;
  benefits?: string[];
  employmentType?: string | null;
  workMode?: string | null;
  showClientNamePublicly?: boolean;
  publicFieldVisibility?: Record<string, boolean> | null;
}

function formatEmploymentType(type?: string | null): string {
  const raw = String(type || '').trim();
  if (!raw) return '';
  const map: Record<string, string> = {
    FULL_TIME: 'Full time',
    PART_TIME: 'Part time',
    CONTRACT: 'Contract',
    FREELANCE: 'Freelance',
    INTERNSHIP: 'Internship',
  };
  if (map[raw]) return map[raw];
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitizeJobHtml(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');
}

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type JobDescriptionSection = { title: string; bodyHtml: string };

export function parseHtmlJobSections(html: string): JobDescriptionSection[] {
  const cleaned = sanitizeJobHtml(html).replace(/<hr[^>]*>/gi, '');
  if (!cleaned) return [];

  if (typeof DOMParser === 'undefined') {
    return [{ title: 'Job details', bodyHtml: cleaned }];
  }

  const doc = new DOMParser().parseFromString(`<div id="root">${cleaned}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return [{ title: 'Job details', bodyHtml: cleaned }];

  const sections: JobDescriptionSection[] = [];
  let currentTitle = 'Overview';
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('').trim();
    if (body) sections.push({ title: currentTitle, bodyHtml: body });
    buffer = [];
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2') {
      flush();
      currentTitle = (el.textContent || 'Section').trim() || 'Section';
    } else {
      buffer.push(el.outerHTML);
    }
  }
  flush();

  if (sections.length === 0) {
    return [{ title: 'Job details', bodyHtml: cleaned }];
  }
  return sections;
}

const htmlBodyClass =
  'text-sm text-slate-700 leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-0 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-slate-800 [&_h2]:mt-3 [&_h2]:mb-2 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-slate-700 [&_strong]:font-semibold [&_strong]:text-slate-800';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
      <div className="border-b border-slate-100 bg-white px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={`${item}-${i}`}>{item}</li>
      ))}
    </ul>
  );
}

export function PublicJobOverviewPanel({ job }: { job: PublicJobOverviewJob }) {
  const visibility = parseJobPublicFieldVisibility(job.publicFieldVisibility);
  const show = (field: JobPublicVisibilityField) =>
    isJobFieldPubliclyVisible(visibility, field, job.showClientNamePublicly);

  const htmlSource = show('jobDescription') ? (job.description || job.overview || '').trim() : '';
  const hasHtml = /<[^>]+>/.test(htmlSource);

  const htmlSections = useMemo(
    () => (hasHtml ? parseHtmlJobSections(htmlSource) : []),
    [hasHtml, htmlSource]
  );

  const employmentLabel = show('employmentType') ? formatEmploymentType(job.employmentType) : '';
  const skills = show('skills')
    ? [...(job.skills || []), ...(job.preferredSkills || [])].filter(Boolean)
    : [];
  const hasStructuredLists =
    !hasHtml &&
    ((show('keyResponsibilities') && (job.keyResponsibilities?.length ?? 0) > 0) ||
      (show('qualifications') && (job.requirements?.length ?? 0) > 0) ||
      (show('candidateRequirements') && (job.candidateRequirements?.length ?? 0) > 0) ||
      (job.benefits?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      {show('location') && job.location ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={16} className="shrink-0 text-slate-400" />
          {job.location}
        </p>
      ) : null}

      {(employmentLabel || job.workMode) && (
        <div className="flex flex-wrap gap-2">
          {employmentLabel ? (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 border border-indigo-100">
              {employmentLabel}
            </span>
          ) : null}
          {job.workMode ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {job.workMode}
            </span>
          ) : null}
        </div>
      )}

      {hasHtml && htmlSections.length > 0
        ? htmlSections.map((section, index) => (
            <SectionCard key={`${section.title}-${index}`} title={section.title}>
              <div
                className={htmlBodyClass}
                dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
              />
            </SectionCard>
          ))
        : null}

      {!hasHtml && (job.overview || job.description) ? (
        <SectionCard title="Overview">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {stripHtml(job.overview || job.description || '')}
          </p>
        </SectionCard>
      ) : null}

      {hasStructuredLists && show('keyResponsibilities') && (job.keyResponsibilities?.length ?? 0) > 0 ? (
        <SectionCard title="Key responsibilities">
          <BulletList items={job.keyResponsibilities!} />
        </SectionCard>
      ) : null}

      {hasStructuredLists && show('qualifications') && (job.requirements?.length ?? 0) > 0 ? (
        <SectionCard title="Preferred education / qualifications">
          <BulletList items={job.requirements!} />
        </SectionCard>
      ) : null}

      {hasStructuredLists && show('candidateRequirements') && (job.candidateRequirements?.length ?? 0) > 0 ? (
        <SectionCard title="Candidate requirements">
          <BulletList items={job.candidateRequirements!} />
        </SectionCard>
      ) : null}

      {skills.length > 0 ? (
        <SectionCard title="Skills">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {job.experienceRequired ? (
        <SectionCard title="Experience">
          <p className="text-sm text-slate-700">
            {String(job.experienceRequired).includes('-')
              ? `${job.experienceRequired} years`
              : job.experienceRequired}
          </p>
        </SectionCard>
      ) : null}

      {job.education ? (
        <SectionCard title="Education">
          <p className="text-sm text-slate-700">{job.education}</p>
        </SectionCard>
      ) : null}

      {hasStructuredLists && (job.benefits?.length ?? 0) > 0 ? (
        <SectionCard title="Benefits">
          <BulletList items={job.benefits!} />
        </SectionCard>
      ) : null}
    </div>
  );
}
