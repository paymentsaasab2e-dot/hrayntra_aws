import type { CandidateProfileDrawerData } from '@/components/drawers/CandidateProfileDrawer';
import {
  getPhase1ProfileSnapshot,
  resolveCandidateResumeUrlFromSources,
  type Phase1ProfileSnapshot,
} from '@/lib/phase1ProfileSnapshot';
import { normalizeCareerPreferencesRecord } from '@/lib/normalizeCareerPreferencesRecord';

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
  if (Array.isArray(snap?.portfolioLinks) && snap.portfolioLinks.length) {
    return snap.portfolioLinks.map((link) => ({
      type: link.type ? String(link.type) : undefined,
      label: link.type ? String(link.type) : undefined,
      url: link.url ? String(link.url) : undefined,
    }));
  }
  const fromCv = candidate.cvPortfolioLinks || [];
  if (fromCv.length) {
    return fromCv.map((link) => ({
      type: link.type,
      label: link.label || link.type,
      url: link.url,
    }));
  }
  const urls = [candidate.cvPortfolio, candidate.cvWebsite].filter(Boolean) as string[];
  return urls.map((url) => ({ type: 'Portfolio', label: 'Portfolio', url }));
}

export function resolvePhase1Internships(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.internships) && snap.internships.length) return snap.internships;
  return extraArray(candidate, 'phase1Internships');
}

export function resolvePhase1Accomplishments(
  snap: Phase1ProfileSnapshot | null,
  candidate: CandidateProfileDrawerData,
): Array<Record<string, unknown>> {
  if (Array.isArray(snap?.accomplishments) && snap.accomplishments.length) {
    return snap.accomplishments;
  }
  return extraArray(candidate, 'phase1Accomplishments');
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
