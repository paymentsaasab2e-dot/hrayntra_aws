/** Custom JD sections beyond the fixed Responsibilities / Qualifications / Requirements fields. */

export type JobCustomJdSection = {
  id: string;
  title: string;
  body: string;
};

const KNOWN_SECTION_KEYWORDS = [
  'overview',
  'about the role',
  'about this role',
  'job summary',
  'summary',
  'key responsibilities',
  'responsibilities',
  'roles and responsibilities',
  'what you will do',
  "what you'll do",
  'requirements',
  'requirement',
  'qualifications',
  'qualification',
  'preferred qualifications',
  'preferred qualification',
  'preferred education',
  'education',
  'candidate requirements',
  'additional requirements',
  'must have',
  'must-have',
  'benefits',
  'compensation',
  'compensation & benefits',
  'perks',
  'skills',
  'required skills',
];

function stripHtmlTags(value: string): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeading(heading: string): string {
  return stripHtmlTags(heading).toLowerCase().replace(/\s+/g, ' ').trim();
}

function isKnownSectionHeading(heading: string): boolean {
  const h = normalizeHeading(heading);
  if (!h) return true;
  return KNOWN_SECTION_KEYWORDS.some(
    (kw) => h === kw || h.includes(kw) || kw.split(/\s+/).every((part) => h.includes(part)),
  );
}

function bodyHtmlToText(bodyHtml: string): string {
  const liItems = [...String(bodyHtml || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripHtmlTags(m[1]))
    .filter(Boolean);
  if (liItems.length) return liItems.join('\n');

  const paragraphs = [...String(bodyHtml || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtmlTags(m[1]))
    .filter(Boolean);
  if (paragraphs.length) return paragraphs.join('\n');

  return stripHtmlTags(bodyHtml);
}

function newSectionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Extract JD headings that are not the fixed core sections. */
export function extractAdditionalJdSectionsFromHtml(html: string): JobCustomJdSection[] {
  const raw = String(html || '').trim();
  if (!raw) return [];

  const headingRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  const sections: Array<{ title: string; headingStart: number; bodyStart: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(raw)) !== null) {
    sections.push({
      title: stripHtmlTags(match[1]),
      headingStart: match.index,
      bodyStart: match.index + match[0].length,
    });
  }

  const out: JobCustomJdSection[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const title = sections[i].title.trim();
    if (!title || isKnownSectionHeading(title)) continue;
    const bodyEnd = i + 1 < sections.length ? sections[i + 1].headingStart : raw.length;
    const body = bodyHtmlToText(raw.slice(sections[i].bodyStart, bodyEnd));
    if (!body) continue;
    out.push({
      id: newSectionId(),
      title,
      body,
    });
  }
  return out;
}

export function createEmptyCustomJdSection(
  partial?: Partial<Pick<JobCustomJdSection, 'title' | 'body'>>,
): JobCustomJdSection {
  return {
    id: newSectionId(),
    title: partial?.title?.trim() || '',
    body: partial?.body?.trim() || '',
  };
}

export function mergeCustomJdSections(
  existing: JobCustomJdSection[] | undefined,
  incoming: JobCustomJdSection[],
): JobCustomJdSection[] {
  const current = Array.isArray(existing) ? existing : [];
  if (!incoming.length) return current;
  if (!current.length) return incoming;

  const byTitle = new Map(
    current.map((section) => [normalizeHeading(section.title), section] as const),
  );
  const merged = [...current];
  for (const section of incoming) {
    const key = normalizeHeading(section.title);
    if (!key) continue;
    if (byTitle.has(key)) {
      const idx = merged.findIndex((row) => normalizeHeading(row.title) === key);
      if (idx >= 0 && !String(merged[idx].body || '').trim() && section.body.trim()) {
        merged[idx] = { ...merged[idx], body: section.body };
      }
      continue;
    }
    byTitle.set(key, section);
    merged.push(section);
  }
  return merged;
}

export function customJdSectionsToHtml(sections: JobCustomJdSection[]): string {
  return (sections || [])
    .filter((section) => section.title.trim() || section.body.trim())
    .map((section) => {
      const title = section.title.trim() || 'Additional section';
      const lines = section.body
        .split('\n')
        .map((line) => line.replace(/^[\-\u2022]\s*/, '').trim())
        .filter(Boolean);
      if (lines.length > 1) {
        return `<h3>${escapeHtml(title)}</h3><ul>${lines
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')}</ul>`;
      }
      if (lines.length === 1) {
        return `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(lines[0])}</p>`;
      }
      return `<h3>${escapeHtml(title)}</h3>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
