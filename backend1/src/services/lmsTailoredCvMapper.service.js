/** Phase 1 LMS studio template → Phase 2 CV editor template */
const PHASE1_TO_PHASE2_TEMPLATE = {
  'modern-minimal': 'modern',
  'impact-focused': 'executive',
  'technical-depth': 'minimal',
  arctic: 'modern',
  obsidian: 'executive',
  'serif-classic': 'classic',
  modern: 'modern',
  minimal: 'minimal',
  classic: 'classic',
  executive: 'executive',
};

const PHASE2_TEMPLATE_LAYOUT = {
  classic: {
    candidatePhotoPos: { x: 430, y: 36 },
    companyLogoPos: { x: 332, y: 108 },
  },
  modern: {
    candidatePhotoPos: { x: 448, y: 28 },
    companyLogoPos: { x: 48, y: 28 },
  },
  minimal: {
    candidatePhotoPos: { x: 448, y: 48 },
    companyLogoPos: { x: 48, y: 48 },
  },
  executive: {
    candidatePhotoPos: { x: 448, y: 24 },
    companyLogoPos: { x: 48, y: 24 },
  },
};

function getDefaultSaasaLogoUrl() {
  const base = String(
    process.env.JOBPORTAL_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000',
  ).replace(/\/$/, '');
  return `${base}/SAASA%20Logo.png`;
}

function mapStudioTemplateToPhase2(studioTemplateId) {
  const key = String(studioTemplateId || 'modern-minimal').trim().toLowerCase();
  return PHASE1_TO_PHASE2_TEMPLATE[key] || 'modern';
}

function buildCvEditorLayout(studioTemplateId, meta = {}) {
  const templateId = mapStudioTemplateToPhase2(studioTemplateId);
  const positions = PHASE2_TEMPLATE_LAYOUT[templateId] || PHASE2_TEMPLATE_LAYOUT.modern;
  const saasaLogoUrl = meta.saasaLogoUrl || getDefaultSaasaLogoUrl();
  const avatarUrl = meta.avatarUrl ? String(meta.avatarUrl).trim() : null;

  return {
    templateId,
    portalStudioTemplateId: String(studioTemplateId || 'modern-minimal').trim(),
    sectionOrder: ['summary', 'skills', 'experience', 'education'],
    candidatePhotoPos: positions.candidatePhotoPos,
    companyLogoPos: positions.companyLogoPos,
    candidatePhotoSize: { width: 72, height: 72 },
    companyLogoSize: { width: 96, height: 36 },
    showCandidatePhotoSlot: Boolean(avatarUrl),
    showCompanyLogoSlot: true,
    candidatePhotoUrl: avatarUrl,
    initialCandidatePhotoUrl: avatarUrl,
    companyLogoUrl: saasaLogoUrl,
    initialCompanyLogoUrl: saasaLogoUrl,
    watermark: {
      text: 'Hryantra',
      opacity: 12,
      color: '#28A8E1',
      active: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

function splitFullName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function splitDuration(duration) {
  const raw = String(duration || '').trim();
  if (!raw) return { start: '', end: '' };
  const parts = raw.split(/\s*[–—-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { start: parts[0], end: parts.slice(1).join(' – ') };
  return { start: raw, end: '' };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeTailoredSummaryText(summary) {
  let text = String(summary || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /Role alignment:[^.]*\./gi,
    /Seeking to contribute as[^.]*\./gi,
    /Seeking the [^.]* opportunity at[^.]*\./gi,
    /Targeting\s+[^.]+\s+at\s+[^.]+\./gi,
    /Core strengths:[^.]*\./gi,
    /Aligned with [^.]* requirements\./gi,
  ];
  for (const pattern of patterns) {
    text = text.replace(pattern, '');
  }
  const match = text.match(/^(.{8,90}?\s+with\s+[\d–\-+]+\s*(?:yrs?|years?))\s+/i);
  if (match?.[1]) {
    const prefix = match[1].trim();
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^(?:${escaped}\\s*)+`, 'i'), `${prefix} `);
  }
  return text.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();
}

/**
 * Map LMS resume studio draft / role-version snapshot into recruiter CV fields
 * used by Phase 1 portal candidate rows and Phase 2 tenant "Updated CV" tab.
 */
function mapLmsDraftToRecruiterCvFields(draft, meta = {}) {
  if (!draft || typeof draft !== 'object') return null;

  const basics = draft.basics && typeof draft.basics === 'object' ? draft.basics : {};
  const { firstName, lastName } = splitFullName(basics.name);
  const skills = asArray(draft.skills).map((s) => String(s || '').trim()).filter(Boolean);
  const experience = asArray(draft.experience);
  const education = asArray(draft.education);
  const rawSummary = String(basics.summary || draft.summary || '').trim();
  const summary = rawSummary ? sanitizeTailoredSummaryText(rawSummary) : null;
  const studioTemplateId = meta.templateId || draft.templateId || 'modern-minimal';

  return {
    firstName: firstName || null,
    lastName: lastName || null,
    email: String(basics.email || '').trim() || null,
    phone: String(basics.phone || '').trim() || null,
    linkedIn: String(basics.linkedin || basics.linkedIn || '').trim() || null,
    currentTitle: String(basics.headline || meta.jobTitle || '').trim() || null,
    location: String(basics.location || '').trim() || null,
    avatar: meta.avatarUrl || null,
    cvSummary: summary,
    skills,
    recruiterSkills: skills,
    cvWorkExperienceEntries: experience
      .map((exp) => {
        if (!exp || typeof exp !== 'object') return null;
        const { start, end } = splitDuration(exp.duration);
        return {
          title: String(exp.role || '').trim() || null,
          company: String(exp.company || '').trim() || null,
          startDate: start || null,
          endDate: end || null,
          responsibilities: String(exp.bullets || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        };
      })
      .filter(Boolean),
    cvEducationEntries: education
      .map((edu) => {
        if (!edu || typeof edu !== 'object') return null;
        const { start, end } = splitDuration(edu.duration);
        return {
          degree: String(edu.degree || '').trim() || null,
          institution: String(edu.institution || '').trim() || null,
          startYear: start || null,
          endYear: end || null,
        };
      })
      .filter(Boolean),
    cvEditorLayout: buildCvEditorLayout(studioTemplateId, meta),
    portalStudioTemplateId: String(studioTemplateId).trim(),
    portalTailoredCvHtml:
      typeof meta.resumeHtml === 'string' && meta.resumeHtml.trim().length > 80
        ? meta.resumeHtml.trim()
        : null,
    jobTitle: meta.jobTitle || null,
    company: meta.company || null,
  };
}

module.exports = {
  mapLmsDraftToRecruiterCvFields,
  mapStudioTemplateToPhase2,
  buildCvEditorLayout,
};
