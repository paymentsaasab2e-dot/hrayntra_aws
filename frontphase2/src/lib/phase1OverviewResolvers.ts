import type { CandidateProfileDrawerData } from '@/components/drawers/CandidateProfileDrawer';
import {
  getPhase1ProfileSnapshot,
  resolveCandidateResumeUrlFromSources,
  type Phase1ProfileSnapshot,
} from '@/lib/phase1ProfileSnapshot';
import { normalizeCareerPreferencesRecord } from '@/lib/normalizeCareerPreferencesRecord';
import {
  dedupePortfolioLinksByUrl,
  filterPortfolioLinks,
  normalizePortfolioLinkRow,
} from '@/lib/portfolioLinkFilter';

export type Phase1SkillRow = {
  name: string;
  proficiency?: string;
  category?: string;
};

export type Phase1LanguageRow = {
  name: string;
  proficiency?: string;
};

export type Phase1PortfolioLinkRow = {
  type?: string;
  label?: string;
  url?: string;
};

export type Phase1ResumeInfo = {
  fileName: string;
  fileUrl: string;
  atsScore: number | null;
};

const SKILL_CATEGORIES = ['Hard Skills', 'Soft Skills', 'Tools / Technologies'] as const;

export { SKILL_CATEGORIES };

function extraArray(
  candidate: CandidateProfileDrawerData,
  key: string,
): Array<Record<string, unknown>> {
  const raw = candidate.extraData?.[key];
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

export function resolvePhase1Resume(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Phase1ResumeInfo {
  const fileUrl = resolveCandidateResumeUrlFromSources(candidate);
  const fileFromFiles = candidate.files?.find((f) => f.url)?.name;
  const fileName =
    snap?.resume?.fileName?.trim() ||
    fileFromFiles?.trim() ||
    (fileUrl ? 'Resume' : '');
  const atsFromSnap =
    typeof snap?.resume?.atsScore === 'number' && Number.isFinite(snap.resume.atsScore)
      ? Math.round(snap.resume.atsScore)
      : null;
  const atsFromAi =
    candidate.aiScore?.source === 'resume_ats' &&
    typeof candidate.aiScore.overall === 'number' &&
    Number.isFinite(candidate.aiScore.overall)
      ? Math.round(candidate.aiScore.overall)
      : null;
  return {
    fileName,
    fileUrl,
    atsScore: atsFromSnap ?? atsFromAi,
  };
}

export function resolvePhase1Skills(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Phase1SkillRow[] {
  if (Array.isArray(snap?.skills) && snap.skills.length) {
    return snap.skills
      .map((s) => ({
        name: String(s?.name || '').trim(),
        proficiency: s?.proficiency ? String(s.proficiency).trim() : undefined,
        category: s?.category ? String(s.category).trim() : 'Hard Skills',
      }))
      .filter((s) => s.name);
  }
  const names = [
    ...(Array.isArray(candidate.cvSkills) ? candidate.cvSkills : []),
  ]
    .map((n) => String(n).trim())
    .filter(Boolean);
  const unique = [...new Set(names)];
  return unique.map((name) => ({ name, category: 'Hard Skills' }));
}

function parseLanguageLabel(raw: string): Phase1LanguageRow {
  const text = raw.trim();
  if (!text) return { name: '' };
  const dash = text.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (dash) {
    return { name: dash[1].trim(), proficiency: dash[2].trim() };
  }
  return { name: text };
}

export function resolvePhase1Languages(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Phase1LanguageRow[] {
  if (Array.isArray(snap?.languages) && snap.languages.length) {
    return snap.languages
      .map((l) => ({
        name: String(l?.name || '').trim(),
        proficiency: l?.proficiency ? String(l.proficiency).trim() : undefined,
      }))
      .filter((l) => l.name);
  }
  return (candidate.cvLanguages || [])
    .map(parseLanguageLabel)
    .filter((l) => l.name);
}

export function resolvePhase1PortfolioLinks(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Phase1PortfolioLinkRow[] {
  const snapshotLinks = filterPortfolioLinks(snap?.portfolioLinks || []).map(normalizePortfolioLinkRow);
  if (snapshotLinks.length) {
    return dedupePortfolioLinksByUrl(snapshotLinks);
  }

  const fromCv = dedupePortfolioLinksByUrl(
    filterPortfolioLinks(candidate.cvPortfolioLinks || []).map((link) =>
      normalizePortfolioLinkRow({
        url: link.url,
        linkType: link.type,
        type: link.type,
        title: link.label,
      }),
    ),
  );
  if (fromCv.length) return fromCv;

  const urls = filterPortfolioLinks(
    [candidate.cvPortfolio, candidate.cvWebsite].filter(Boolean) as string[],
  );
  return dedupePortfolioLinksByUrl(
    urls.map((url) => ({ type: 'Portfolio', label: 'Portfolio', url: String(url) })),
  );
}

export function resolvePhase1Internships(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.internships) && snap.internships.length) return snap.internships;
  return extraArray(candidate, 'phase1Internships');
}

export function resolvePhase1Education(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.education) && snap.education.length) return snap.education;
  return (candidate.cvEducationEntries || []).map((entry) => ({
    degreeProgram: entry.degree,
    institutionName: entry.institution,
    fieldOfStudy: entry.field,
    startYear: entry.startYear,
    endYear: entry.endYear,
  }));
}

export function resolvePhase1GapExplanations(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.gapExplanations) && snap.gapExplanations.length) {
    return snap.gapExplanations;
  }
  return extraArray(candidate, 'phase1GapExplanations');
}

export function resolvePhase1AcademicAchievements(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.academicAchievements) && snap.academicAchievements.length) {
    return snap.academicAchievements;
  }
  return extraArray(candidate, 'phase1AcademicAchievements');
}

export function resolvePhase1CompetitiveExams(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.competitiveExams) && snap.competitiveExams.length) {
    return snap.competitiveExams;
  }
  return extraArray(candidate, 'phase1CompetitiveExams');
}

export function resolvePhase1Projects(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.projects) && snap.projects.length) {
    return snap.projects;
  }
  return extraArray(candidate, 'phase1Projects');
}

export function resolvePhase1Certifications(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.certifications) && snap.certifications.length) {
    return snap.certifications;
  }

  const fromExtra = extraArray(candidate, 'phase1Certifications');
  if (fromExtra.length) return fromExtra;

  return (candidate.cvCertifications || []).map((name) => ({
    certificationName: String(name),
  }));
}

export function resolvePhase1Accomplishments(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.accomplishments) && snap.accomplishments.length) {
    return snap.accomplishments;
  }
  const fromExtra = extraArray(candidate, 'phase1Accomplishments');
  if (fromExtra.length) return fromExtra;
  return [];
}

export function resolvePhase1VisaWorkAuthorization(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Record<string, unknown> | null {
  if (snap?.visaWorkAuthorization && typeof snap.visaWorkAuthorization === 'object') {
    return snap.visaWorkAuthorization as Record<string, unknown>;
  }

  const fromExtra = candidate.extraData?.phase1VisaWorkAuthorization;
  if (fromExtra && typeof fromExtra === 'object' && !Array.isArray(fromExtra)) {
    return fromExtra as Record<string, unknown>;
  }

  return null;
}

export function resolvePhase1Vaccination(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Record<string, unknown> | null {
  if (snap?.vaccination && typeof snap.vaccination === 'object') {
    return snap.vaccination as Record<string, unknown>;
  }

  const fromExtra = candidate.extraData?.phase1Vaccination;
  if (fromExtra && typeof fromExtra === 'object' && !Array.isArray(fromExtra)) {
    return fromExtra as Record<string, unknown>;
  }

  return null;
}

export function resolvePhase1CareerPreferences(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Record<string, unknown> | null {
  const merged = {
    ...((snap?.careerPreferences as Record<string, unknown> | null) || {}),
    ...((candidate.careerPreferences as Record<string, unknown> | null) || {}),
  };
  return normalizeCareerPreferencesRecord(merged, candidate);
}

export function getPhase1SnapshotOrNull(
  candidate: CandidateProfileDrawerData,
): Phase1ProfileSnapshot | null {
  return getPhase1ProfileSnapshot(candidate.extraData);
}
