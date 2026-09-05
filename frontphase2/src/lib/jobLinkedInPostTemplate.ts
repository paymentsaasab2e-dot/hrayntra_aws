import type { JobPublicFieldVisibility } from './jobPublicFieldVisibility';
import {
  DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY,
  parseJobPublicFieldVisibility,
} from './jobPublicFieldVisibility';

export const LINKEDIN_POST_SECTION_DEFS = [
  { key: 'role', label: 'Role & company' },
  { key: 'location', label: 'Location' },
  { key: 'openings', label: 'Openings' },
  { key: 'priority', label: 'Priority' },
  { key: 'employmentType', label: 'Employment type' },
  { key: 'industryType', label: 'Industry' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'targetHireDate', label: 'Target hire date' },
  { key: 'experience', label: 'Experience' },
  { key: 'salary', label: 'Salary' },
  { key: 'skills', label: 'Skills' },
  { key: 'languages', label: 'Languages' },
  { key: 'contactPerson', label: 'Contact person' },
  { key: 'overview', label: 'Overview / summary' },
  { key: 'keyResponsibilities', label: 'Key responsibilities' },
  { key: 'qualifications', label: 'Qualifications / education' },
  { key: 'candidateRequirements', label: 'Candidate requirements' },
  { key: 'compensationBenefits', label: 'Compensation & benefits' },
] as const;

export type LinkedInPostSectionKey = (typeof LINKEDIN_POST_SECTION_DEFS)[number]['key'];

export type LinkedInPostTemplateSection = {
  key: LinkedInPostSectionKey;
  label: string;
  visible: boolean;
  order: number;
};

export type LinkedInPostTemplateSchema = {
  version: 1;
  sections: LinkedInPostTemplateSection[];
};

export type JobLinkedInPostTemplate = {
  id: string;
  name: string;
  schema: LinkedInPostTemplateSchema;
  createdAt?: string;
  updatedAt?: string;
};

/** Maps post sections → public field visibility keys used elsewhere in Create Job. */
export const LINKEDIN_SECTION_TO_VISIBILITY: Record<
  LinkedInPostSectionKey,
  Array<keyof JobPublicFieldVisibility>
> = {
  role: ['jobTitle', 'client'],
  location: ['location'],
  openings: ['openings'],
  priority: ['priority'],
  employmentType: ['employmentType'],
  industryType: ['industryType'],
  nationality: ['nationality'],
  targetHireDate: ['targetHireDate'],
  experience: ['experience'],
  salary: ['salary'],
  skills: ['skills'],
  languages: ['languages'],
  contactPerson: ['contactPerson'],
  overview: ['jobDescription'],
  keyResponsibilities: ['keyResponsibilities'],
  qualifications: ['qualifications'],
  candidateRequirements: ['candidateRequirements'],
  compensationBenefits: ['jobDescription'],
};

const SECTION_KEY_SET = new Set<string>(LINKEDIN_POST_SECTION_DEFS.map((s) => s.key));

export function defaultLinkedInPostTemplateSchema(): LinkedInPostTemplateSchema {
  return {
    version: 1,
    sections: LINKEDIN_POST_SECTION_DEFS.map((def, index) => ({
      key: def.key,
      label: def.label,
      visible: true,
      order: index,
    })),
  };
}

export function normalizeLinkedInPostTemplateSchema(raw: unknown): LinkedInPostTemplateSchema {
  const fallback = defaultLinkedInPostTemplateSchema();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;

  const source = raw as { sections?: unknown };
  const incoming = Array.isArray(source.sections) ? source.sections : [];
  const byKey = new Map<string, LinkedInPostTemplateSection>();

  incoming.forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const item = row as Record<string, unknown>;
    const key = String(item.key || '').trim();
    if (!SECTION_KEY_SET.has(key) || byKey.has(key)) return;
    const def = LINKEDIN_POST_SECTION_DEFS.find((d) => d.key === key);
    byKey.set(key, {
      key: key as LinkedInPostSectionKey,
      label: String(item.label || def?.label || key).trim() || key,
      visible: item.visible !== false,
      order: typeof item.order === 'number' ? item.order : index,
    });
  });

  const sections: LinkedInPostTemplateSection[] = [];
  const orderedKeys = [
    ...incoming
      .map((row) =>
        row && typeof row === 'object' ? String((row as { key?: unknown }).key || '').trim() : '',
      )
      .filter((k) => SECTION_KEY_SET.has(k)),
    ...LINKEDIN_POST_SECTION_DEFS.map((d) => d.key),
  ];
  const seen = new Set<string>();
  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = byKey.get(key);
    const def = LINKEDIN_POST_SECTION_DEFS.find((d) => d.key === key);
    sections.push(
      existing || {
        key: key as LinkedInPostSectionKey,
        label: def?.label || key,
        // New section types must not appear on templates the user already configured.
        visible: false,
        order: sections.length,
      },
    );
  }

  return {
    version: 1,
    sections: sections.map((section, index) => ({ ...section, order: index })),
  };
}

export function linkedInTemplateToPublicVisibility(
  schema: LinkedInPostTemplateSchema,
): JobPublicFieldVisibility {
  const visibility: JobPublicFieldVisibility = { ...DEFAULT_JOB_PUBLIC_FIELD_VISIBILITY };
  // Start by marking template-controlled fields; then apply section visibility.
  const controlled = new Set<keyof JobPublicFieldVisibility>();
  for (const section of schema.sections) {
    for (const field of LINKEDIN_SECTION_TO_VISIBILITY[section.key] || []) {
      controlled.add(field);
    }
  }
  for (const field of controlled) {
    visibility[field] = false;
  }
  for (const section of schema.sections) {
    if (!section.visible) continue;
    for (const field of LINKEDIN_SECTION_TO_VISIBILITY[section.key] || []) {
      visibility[field] = true;
    }
  }
  return parseJobPublicFieldVisibility(visibility);
}

export function moveLinkedInTemplateSection(
  schema: LinkedInPostTemplateSchema,
  key: LinkedInPostSectionKey,
  direction: 'up' | 'down',
): LinkedInPostTemplateSchema {
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  const index = sections.findIndex((s) => s.key === key);
  if (index < 0) return schema;
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sections.length) return schema;
  const next = [...sections];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return {
    version: 1,
    sections: next.map((section, order) => ({ ...section, order })),
  };
}

/** Drag-and-drop reorder by index (0-based). */
export function reorderLinkedInTemplateSections(
  schema: LinkedInPostTemplateSchema,
  fromIndex: number,
  toIndex: number,
): LinkedInPostTemplateSchema {
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sections.length ||
    toIndex >= sections.length ||
    fromIndex === toIndex
  ) {
    return schema;
  }
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return {
    version: 1,
    sections: next.map((section, order) => ({ ...section, order })),
  };
}

export function toggleLinkedInTemplateSectionVisible(
  schema: LinkedInPostTemplateSchema,
  key: LinkedInPostSectionKey,
): LinkedInPostTemplateSchema {
  return {
    version: 1,
    sections: schema.sections.map((section) =>
      section.key === key ? { ...section, visible: !section.visible } : section,
    ),
  };
}

function lastLinkedInTemplateStorageKey() {
  try {
    const tenant = String(localStorage.getItem('tenantDbName') || '').trim();
    return tenant ? `jobLinkedInPostTemplate:lastId:${tenant}` : 'jobLinkedInPostTemplate:lastId';
  } catch {
    return 'jobLinkedInPostTemplate:lastId';
  }
}

export function rememberLinkedInTemplateId(id: string | null) {
  try {
    const key = lastLinkedInTemplateStorageKey();
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const LINKEDIN_TEMPLATE_DEFAULT_CHANGED_EVENT = 'hrayntra:linkedin-template-default-changed';
export const LINKEDIN_TEMPLATES_CHANGED_EVENT = 'hrayntra:linkedin-templates-changed';

export function emitLinkedInTemplatesChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LINKEDIN_TEMPLATES_CHANGED_EVENT));
}

export function subscribeLinkedInTemplatesChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(LINKEDIN_TEMPLATES_CHANGED_EVENT, listener);
  return () => window.removeEventListener(LINKEDIN_TEMPLATES_CHANGED_EVENT, listener);
}

export function emitLinkedInTemplateDefaultChanged(template: JobLinkedInPostTemplate | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LINKEDIN_TEMPLATE_DEFAULT_CHANGED_EVENT, { detail: template }),
  );
}

export function subscribeLinkedInTemplateDefaultChanged(
  listener: (template: JobLinkedInPostTemplate | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    listener((event as CustomEvent<JobLinkedInPostTemplate | null>).detail ?? null);
  };
  window.addEventListener(LINKEDIN_TEMPLATE_DEFAULT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(LINKEDIN_TEMPLATE_DEFAULT_CHANGED_EVENT, handler);
}

/** Persist the default LinkedIn template used by Settings and Create Job. */
export function applyDefaultLinkedInPostTemplate(template: JobLinkedInPostTemplate | null): void {
  rememberLinkedInTemplateId(template?.id ?? null);
  emitLinkedInTemplateDefaultChanged(template);
}

export function readRememberedLinkedInTemplateId(): string | null {
  try {
    return localStorage.getItem(lastLinkedInTemplateStorageKey()) || null;
  } catch {
    return null;
  }
}

export function parseLinkedInPostTemplateList(res: unknown): JobLinkedInPostTemplate[] {
  const rows = (res as { data?: unknown })?.data ?? res;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id || ''),
        name: String(item.name || 'Untitled'),
        schema: normalizeLinkedInPostTemplateSchema(item.schema),
        createdAt: item.createdAt ? String(item.createdAt) : undefined,
        updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
      };
    })
    .filter((row) => row.id);
}

export function visibleLinkedInTemplateSectionLabels(
  sections?: LinkedInPostTemplateSection[] | null,
): string[] {
  if (!Array.isArray(sections) || !sections.length) return [];
  return [...sections]
    .filter((section) => section.visible !== false)
    .sort((a, b) => a.order - b.order)
    .map((section) => section.label);
}

/** Remembered default template, if it still exists. */
export function pickDefaultLinkedInPostTemplate(
  templates: JobLinkedInPostTemplate[],
): JobLinkedInPostTemplate | null {
  if (!templates.length) return null;
  const remembered = readRememberedLinkedInTemplateId();
  if (!remembered) return null;
  return templates.find((row) => row.id === remembered) || null;
}
