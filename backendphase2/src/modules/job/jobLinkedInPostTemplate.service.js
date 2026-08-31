import { prisma } from '../../config/prisma.js';

/** Ordered sections that appear in LinkedIn job posts. */
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
];

const SECTION_KEY_SET = new Set(LINKEDIN_POST_SECTION_DEFS.map((s) => s.key));

export function defaultLinkedInPostTemplateSchema() {
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

export function normalizeLinkedInPostTemplateSchema(raw) {
  const fallback = defaultLinkedInPostTemplateSchema();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;

  const incoming = Array.isArray(raw.sections) ? raw.sections : [];
  const byKey = new Map();
  incoming.forEach((row, index) => {
    const key = String(row?.key || '').trim();
    if (!SECTION_KEY_SET.has(key) || byKey.has(key)) return;
    const def = LINKEDIN_POST_SECTION_DEFS.find((d) => d.key === key);
    byKey.set(key, {
      key,
      label: String(row?.label || def?.label || key).trim() || key,
      visible: row?.visible !== false,
      order: typeof row?.order === 'number' ? row.order : index,
    });
  });

  const sections = [];
  // Preserve incoming order first, then append any missing defaults.
  const orderedKeys = [
    ...incoming.map((row) => String(row?.key || '').trim()).filter((k) => SECTION_KEY_SET.has(k)),
    ...LINKEDIN_POST_SECTION_DEFS.map((d) => d.key),
  ];
  const seen = new Set();
  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = byKey.get(key);
    const def = LINKEDIN_POST_SECTION_DEFS.find((d) => d.key === key);
    sections.push(
      existing || {
        key,
        label: def?.label || key,
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

export const jobLinkedInPostTemplateService = {
  async list(req) {
    const templates = await prisma.jobLinkedInPostTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      schema: normalizeLinkedInPostTemplateSchema(t.schema),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  },

  async create(req) {
    const name = String(req.body?.name || '').trim() || 'Untitled LinkedIn template';
    const schema = normalizeLinkedInPostTemplateSchema(req.body?.schema);
    const row = await prisma.jobLinkedInPostTemplate.create({
      data: {
        name,
        schema,
        createdById: req.user?.id || null,
      },
    });
    return {
      id: row.id,
      name: row.name,
      schema: normalizeLinkedInPostTemplateSchema(row.schema),
    };
  },

  async update(id, req) {
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const schema =
      req.body?.schema != null ? normalizeLinkedInPostTemplateSchema(req.body.schema) : undefined;
    const row = await prisma.jobLinkedInPostTemplate.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(schema ? { schema } : {}),
      },
    });
    return {
      id: row.id,
      name: row.name,
      schema: normalizeLinkedInPostTemplateSchema(row.schema),
    };
  },

  async remove(id) {
    await prisma.jobLinkedInPostTemplate.delete({ where: { id } });
    return { deleted: true };
  },
};
