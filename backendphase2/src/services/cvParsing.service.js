import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { createRequire } from 'module';
import { env } from '../config/env.js';
import { getActiveTenantDbName } from '../config/prisma.js';
import { uploadBufferToCloudinary, uploadContentTypeForFile } from '../utils/s3.js';
import {
  chatCompletionWithFallback,
  getCvLlmCircuitSnapshot,
  hasLlmProvider,
} from './llmChatFallback.service.js';

const require = createRequire(import.meta.url);

const MIME_TO_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
};

const SECTION_HEADER_KEYWORDS =
  /\b(education|experience|skills|summary|contact|profile|objective|employment|formation|parcours|projets)\b/i;

const FALLBACK_SKILL_KEYWORDS = [
  'maintenance',
  'mécanique',
  'mecanique',
  'diagnostic',
  'inspection',
  'entretien',
  'sécurité',
  'securite',
  'rapport',
  'rédaction',
  'redaction',
  'curative',
  'préventive',
  'preventive',
  'agricole',
  'équipement',
  'equipement',
  'processus',
  'intervention',
  'réparation',
  'reparation',
  'anomalie',
  'organisation',
  'gestion',
  'autonome',
  'équipe',
  'equipe',
  'contact',
  'dynamisme',
  'communication',
  'javascript',
  'python',
  'react',
  'node',
  'sql',
  'java',
  'css',
  'html',
  'docker',
  'aws',
  'git',
  'api',
  'linux',
  'management',
  'analysis',
  'development',
  'engineering',
  'testing',
  'design',
  'database',
];

const TECH_SKILLS_REGEX = (() => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inner = FALLBACK_SKILL_KEYWORDS.map(esc).join('|');
  return new RegExp(`\\b(?:${inner})\\b`, 'iu');
})();

const EDU_SCORE_WORDS =
  /\b(bachelor|master|degree|licence|license|brevet|university|école|ecole|institute|diplôme|diploma|phd|b\.?s\.?c|m\.?s\.?c|mba|btech|mtech)\b/i;

const WORK_SCORE_WORDS =
  /\b(experience|worked|company|société|societe|manager|engineer|analyst|developer|développeur|developpeur|consultant|internship|stage)\b/i;

const PROJECT_SCORE_WORDS = /\b(project|projet|built|developed|created|créé|cree)\b/i;

const LINK_SCORE_PATTERNS = /\b(linkedin|github|behance|portfolio|https?:\/\/)\b/i;

const DATE_SCORE_PATTERN = /\b(19|20)\d{2}\b|\b\d{1,2}\s*\/\s*\d{4}\b/;

function divider(char = '=') {
  return char.repeat(80);
}

function logBlock(title) {
  console.log('');
  console.log(divider('='));
  console.log(title);
  console.log(divider('='));
}

function logStageBanner(stageNum, title) {
  console.log('');
  console.log(divider('='));
  console.log(`Stage ${stageNum} — ${title}`);
  console.log(divider('='));
}

function logNarrative(lines) {
  for (const line of lines) console.log(line);
}

function safeJsonForLog(obj, maxLen = 45000) {
  try {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n… (truncated; ${s.length} chars total)`;
  } catch {
    return String(obj);
  }
}

const RX_EMAIL_IN_TEXT = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const RX_PHONE_LOOSE = /\+?\d[\d\s().-]{7,}\d|\b\d(?:[\s-]?\d){7,}\b/;

function passTextSignals(text) {
  const t = String(text || '');
  const emailMatch = t.match(RX_EMAIL_IN_TEXT);
  const phoneMatch = t.match(RX_PHONE_LOOSE);
  return {
    len: t.length,
    hasEmail: Boolean(emailMatch),
    hasPhone: Boolean(phoneMatch),
    emailSample: emailMatch ? String(emailMatch[0]) : '',
    phoneSample: phoneMatch ? String(phoneMatch[0]).replace(/\s+/g, ' ').trim() : '',
    hasProfile: /\b(profil|profile)\b/i.test(t),
    hasFormation: /\b(formation|éducation|education|academic|parcours)\b/i.test(t),
    hasExperience: /\b(expérience|experience|employment|parcours\s+professionnel)\b/i.test(t),
    hasSkills: /\b(compétence|skills|technical)\b/i.test(t),
    hasLang: /\b(langue|languages)\b/i.test(t),
    hasContactLabel: /(?:téléphone|telephone|tel|courriel|e-mail|email)\s*:/i.test(t),
  };
}

function findQuotedLine(text, rx) {
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (line && rx.test(line)) return line.slice(0, 140);
  }
  return '';
}

function describePassMissing(passNum, sig) {
  if (!sig.len) return ['(no text extracted)'];
  if (passNum === 1 && sig.hasFormation && (!sig.hasEmail || !sig.hasPhone)) {
    if (!sig.hasEmail && !sig.hasPhone) return ['CONTACT box (email + phone not captured)'];
  }
  const m = [];
  if (!sig.hasEmail) m.push('email');
  if (!sig.hasPhone) m.push('phone');
  if (!m.length) return [];
  if (passNum === 1) return [`CONTACT signals weak (${m.join(', ')})`];
  return [];
}

function linesForPdfPassNarrative(passNum, title, text, settled) {
  const lines = [title];
  if (settled?.status === 'rejected') {
    lines.push(`Status: ❌ FAILED — ${settled.reason?.message || settled.reason}`);
    return lines;
  }
  const sig = passTextSignals(text);
  const sc = scorePassText(text);
  lines.push(`len=${sig.len} score=${sc}`);

  if (passNum === 1) {
    const missing = describePassMissing(1, sig);
    if (missing.length) lines.push(`Missing: ${missing.join('; ')}`);
    else lines.push('Missing: (none)');
    return lines;
  }

  if (passNum === 2) {
    const telLine = findQuotedLine(text, /téléphone|telephone|tel/i);
    const mailLine = findQuotedLine(text, /courriel|e-mail|email/i);
    const addrLine = findQuotedLine(text, /\badresse\b|\baddress\b/i);
    if (telLine) lines.push(`Captured: "${telLine}"`);
    if (mailLine) lines.push(`Captured: "${mailLine}"`);
    if (addrLine) lines.push(`Captured: "${addrLine}"`);
    return lines;
  }

  if (passNum === 3) {
    if (sig.phoneSample && sig.emailSample) {
      lines.push(`Captured: "${sig.phoneSample}" and "${sig.emailSample}"`);
    } else {
      if (sig.phoneSample) lines.push(`Captured: "${sig.phoneSample}"`);
      if (sig.emailSample) lines.push(`Captured: "${sig.emailSample}"`);
    }
    return lines;
  }

  if (passNum === 4) {
    if (sig.emailSample) lines.push(`Captured: "${sig.emailSample}"`);
    return lines;
  }

  return lines;
}

function buildPdfCombineResult(text1, text2, text3, text4) {
  const passes = [
    { order: 1, title: 'Pass 1 — Default pdf-parse', key: 'pass1_default', text: text1, score: scorePassText(text1) },
    { order: 2, title: 'Pass 2 — Raw item string dump', key: 'pass2_raw_dump', text: text2, score: scorePassText(text2) },
    { order: 3, title: 'Pass 3 — Position-aware render', key: 'pass3_sorted', text: text3, score: scorePassText(text3) },
    { order: 4, title: 'Pass 4 — OCR Tesseract', key: 'pass4_ocr', text: text4, score: scorePassText(text4) },
  ];
  const sorted = [...passes].sort((a, b) => b.score - a.score);
  const dividerLine = '\n\n--- CV_PASS_DIVIDER ---\n\n';
  const combined = sorted.map((p) => p.text || '').join(dividerLine);
  return { combined, passes, sorted };
}

function dedupeConsecutiveLinesMaxTwiceWithStats(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let removed = 0;
  for (const raw of lines) {
    const line = raw;
    const n = out.length;
    if (n >= 2 && out[n - 1] === line && out[n - 2] === line) {
      removed += 1;
      continue;
    }
    out.push(line);
  }
  return { text: out.join('\n'), removed };
}

function regexHintsForLogs(cleanedText, fallbackData) {
  const text = String(cleanedText || '');
  const labeledEmail = text.match(
    /(?:email|e-mail|mail|courriel)\s*[:#]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
  );
  const emailHow = fallbackData.email
    ? labeledEmail
      ? '(matched label "Email:" before address)'
      : '(bare email pattern in text)'
    : '';
  const labeledPhone = text.match(
    /(?:phone|tel|téléphone|telephone|mobile|tél)\s*[:#]?\s*(\+?\d[\d\s().-]{7,}\d)/i
  );
  const phoneHow = fallbackData.phone
    ? labeledPhone
      ? '(matched label "Téléphone:" before number)'
      : '(phone pattern in text)'
    : '';
  const nameHow =
    fallbackData.firstName || fallbackData.lastName
      ? '(first non-empty multi-word line, no @ or http)'
      : '';
  const addrLabeled = /Adresse\s*:\s*[^\n\r\\]+/i.test(text);
  const locHow = fallbackData.location
    ? addrLabeled
      ? '(matched label "Adresse:" before city)'
      : '(short header line heuristic)'
    : '';
  return { emailHow, phoneHow, nameHow, locHow };
}

/** Mistral/OpenAI sometimes return score.overall in 0–1; normalize to 0–100 for ATS display. */
function scaleProvidedScorePercents(score) {
  if (!score || typeof score !== 'object') return {};
  const out = { ...score };
  for (const k of ['overall', 'skills', 'experience', 'education', 'completeness']) {
    if (!(k in out)) continue;
    const n = Number(out[k]);
    if (Number.isFinite(n) && n > 0 && n <= 1) {
      out[k] = Math.round(n * 10000) / 100;
    }
  }
  return out;
}

function validateAiShapeForLogs(ai) {
  if (!ai || typeof ai !== 'object') {
    return {
      jsonValid: false,
      eduArr: false,
      eduLen: 0,
      workArr: false,
      workLen: 0,
      skillsArr: false,
      skillsLen: 0,
      scoreOk: false,
      sourceOk: false,
      priorityOk: false,
    };
  }
  const a = ai;
  const srcOk = ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Company Career Page', 'Agency', 'Other'].includes(
    String(a.source || '').trim()
  );
  const priOk = ['High', 'Medium', 'Low'].includes(String(a.priority || '').trim());
  const overallRaw = Number(a?.score?.overall);
  const overallScaled =
    Number.isFinite(overallRaw) && overallRaw > 0 && overallRaw <= 1 ? overallRaw * 100 : overallRaw;
  const scoreOk = Number.isFinite(overallScaled) && overallScaled >= 0 && overallScaled <= 100;
  return {
    jsonValid: Boolean(ai && typeof ai === 'object'),
    eduArr: Array.isArray(a.educationEntries),
    eduLen: Array.isArray(a.educationEntries) ? a.educationEntries.length : 0,
    workArr: Array.isArray(a.workExperienceEntries),
    workLen: Array.isArray(a.workExperienceEntries) ? a.workExperienceEntries.length : 0,
    skillsArr: Array.isArray(a.skills),
    skillsLen: Array.isArray(a.skills) ? a.skills.length : 0,
    scoreOk,
    sourceOk: srcOk,
    priorityOk: priOk,
  };
}

function logStage8FinalResponse(normalizedData, { totalMs, providerLabel }) {
  const name = [normalizedData.firstName, normalizedData.lastName].filter(Boolean).join(' ');
  const emailOk = Boolean(normalizedData.email);
  const phoneOk = Boolean(normalizedData.phone);
  const nEdu = normalizedData.educationEntries?.length || 0;
  const nWork = normalizedData.workExperienceEntries?.length || 0;
  console.log('');
  console.log(divider('='));
  console.log('Stage 8 — Final Response');
  console.log(divider('='));
  console.log('✅ CV PIPELINE COMPLETE');
  console.log(divider('='));
  console.log(`Personal Info:  ${name || 'N/A'}`);
  console.log(`Email:          ${normalizedData.email || 'N/A'}   ${emailOk ? '✅' : '❌'}`);
  console.log(`Phone:          ${normalizedData.phone || 'N/A'}   ${phoneOk ? '✅' : '❌'}`);
  console.log(`Education:      ${nEdu} entries`);
  console.log(`Work Exp:       ${nWork} ${nWork === 1 ? 'entry' : 'entries'}`);
  console.log(`Skills:         ${normalizedData.skills?.length || 0}`);
  console.log(`portfolioLinks: ${normalizedData.portfolioLinks?.length || 0} entries`);
  console.log(`ATS Score:      ${normalizedData.score?.overall || 0}%`);
  const providerStage8 =
    typeof providerLabel === 'string' && providerLabel.includes('circuit-open') && providerLabel.includes('Mistral')
      ? 'Mistral/circuit-open'
      : providerLabel;
  console.log(`Provider:       ${providerStage8}`);
  console.log(`Total time:     ~${totalMs}ms`);
  console.log(divider('='));
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/,/g, '').replace(/[^\d.]+/g, ' ').trim();
  const match = normalized.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.|linkedin\.com\/|github\.com\/|[a-z0-9-]+\.[a-z]{2,})/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

function cleanResumeText(rawText = '') {
  return String(rawText || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+$/gm, '')
    .trim();
}

const RESUME_TITLE_STOPWORDS = new Set([
  'computer',
  'software',
  'engineer',
  'developer',
  'designer',
  'analyst',
  'manager',
  'consultant',
  'architect',
  'specialist',
  'lead',
  'head',
  'intern',
  'student',
  'graduate',
  'professional',
  'full',
  'stack',
  'frontend',
  'front-end',
  'backend',
  'back-end',
  'data',
  'product',
  'project',
  'program',
  'executive',
  'director',
  'recruiter',
  'talent',
  'operations',
  'support',
  'qa',
  'tester',
  'devops',
  'cloud',
  'security',
  'marketing',
  'sales',
  'accountant',
  'accounts',
  'hr',
  'human',
  'resources',
]);

function looksLikePersonName(value = '') {
  const cleaned = String(value || '')
    .replace(/[\u2013\u2014|,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /[@\d]/.test(cleaned)) return false;
  if (SECTION_HEADER_KEYWORDS.test(cleaned)) return false;

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;

  const lowerParts = parts.map((part) => part.toLowerCase());
  if (lowerParts.some((part) => RESUME_TITLE_STOPWORDS.has(part))) return false;
  if (lowerParts.some((part) => /(?:engineer|developer|designer|manager|analyst|consultant|architect|student|intern)/.test(part))) {
    return false;
  }

  return parts.every((part) => /^[A-Za-z][A-Za-z.'-]*$/.test(part));
}

function splitNameCandidate(value = '') {
  const cleaned = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\u2013\u2014|,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!looksLikePersonName(cleaned)) {
    return { firstName: '', lastName: '' };
  }

  const nameParts = cleaned.split(' ').filter(Boolean);
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
  };
}

function nameFromFileName(fileName = '') {
  const base = path
    .parse(String(fileName || ''))
    .name.replace(/^[0-9_,\-\s.]+/i, '')
    .replace(/[_.-]+/g, ' ')
    .trim();
  return splitNameCandidate(base);
}

function extractResumeName(fullText = '', fileName = '') {
  const cleanedText = String(fullText || '');
  let nameGuess = '';

  const allCapsLines = cleanedText.split('\n').map((l) => l.trim());
  for (const line of allCapsLines.slice(0, 30)) {
    if (
      /^[A-Z][A-Z\s]{4,40}$/.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.split(/\s+/).length <= 5 &&
      !/EXPERIENCE|EDUCATION|SKILLS|SUMMARY|PROFILE|CONTACT|FORMATION|COMPÉTENCES|LANGUES|PROJETS|ACTIVITIES/i.test(line)
    ) {
      nameGuess = line.trim();
      break;
    }
  }

  if (!nameGuess) {
    const spacedMatch = cleanedText.match(/\b([A-Z]\s){2,}[A-Z](\s{2,}([A-Z]\s){1,}[A-Z])?\b/);
    if (spacedMatch) {
      let s = spacedMatch[0].replace(/\s+/g, ' ').trim();
      s = s.replace(/([A-Z])\s+(?=[A-Z])/g, '$1');
      nameGuess = s;
    }
  }

  if (!nameGuess) {
    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 25)) {
      const words = line.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        !line.includes('.') &&
        !line.includes(',') &&
        !line.includes('@') &&
        !line.includes('http') &&
        !line.includes('+') &&
        !/\d/.test(line) &&
        !/experience|engineer|developer|manager|analyst|intern|worked|designed|developed|summary|education|skills|profile|contact|formation|compétences|langues|computer|software|mechanical|electrical|frontend|backend|fullstack|at |pvt|ltd|inc|interface|dynamic|responsive/i.test(
          line
        ) &&
        /^[A-Za-zÀ-ÿ\s\-']+$/.test(line) &&
        words.every((w) => /^[A-ZÀ-Ÿa-zà-ÿ\-']{1,}$/.test(w))
      ) {
        nameGuess = line.trim();
        break;
      }
    }
  }

  if (!nameGuess && fileName) {
    const cleaned = String(fileName)
      .replace(/\.(pdf|docx|doc|txt)$/i, '')
      .replace(/[_\-\d]+/g, ' ')
      .replace(/cv|resume|curriculum|vitae/gi, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      nameGuess = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  if (nameGuess) {
    const fromLine = splitNameCandidate(nameGuess);
    if (fromLine.firstName || fromLine.lastName) return fromLine;
    const w = nameGuess.trim().split(/\s+/).filter(Boolean);
    if (w.length >= 2 && /^[A-Z][A-Z0-9\s'-]+$/i.test(nameGuess.replace(/\s+/g, ' '))) {
      return { firstName: w[0], lastName: w.slice(1).join(' ') };
    }
  }

  const fileCandidate = nameFromFileName(fileName);
  if (fileCandidate.firstName || fileCandidate.lastName) return fileCandidate;

  const emailMatch = cleanedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const emailLocalPart = emailMatch?.[0]?.split('@')[0] || '';
  const emailCandidate = splitNameCandidate(
    emailLocalPart
      .replace(/\d+/g, ' ')
      .replace(/[._-]+/g, ' ')
      .trim()
  );

  if (emailCandidate.firstName || emailCandidate.lastName) {
    return emailCandidate;
  }

  return { firstName: '', lastName: '' };
}

function buildLocation(location = '', city = '', country = '') {
  const explicit = String(location || '').trim();
  if (explicit) return explicit;
  return [city, country].map((item) => String(item || '').trim()).filter(Boolean).join(', ');
}

function findSection(text = '', sectionName = '', nextSections = []) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextPattern = nextSections
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(
    `${escaped}\\s*\\n([\\s\\S]*?)(?:\\n(?:${nextPattern})\\s*\\n|$)`,
    'i'
  );
  return text.match(regex)?.[1]?.trim() || '';
}

function extractPortfolioLinks(text = '') {
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi) || [];
  const ignored = ['gmail.com', 'socket.io'];
  const seen = new Set();

  return matches
    .map((item) => normalizeUrl(item))
    .filter((item) => item && !ignored.some((ignoredHost) => item.toLowerCase().includes(ignoredHost)))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => {
      let type = 'Portfolio Website';
      if (url.includes('github.com')) type = 'GitHub';
      if (url.includes('linkedin.com')) type = 'LinkedIn';
      if (url.includes('behance.net')) type = 'Behance';
      return { type, url };
    });
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function buildHeuristicScore(merged = {}) {
  const skillsCount = Array.isArray(merged.skills) ? merged.skills.filter(Boolean).length : 0;
  const educationCount = Array.isArray(merged.educationEntries) ? merged.educationEntries.filter(Boolean).length : 0;
  const experienceCount = Array.isArray(merged.workExperienceEntries)
    ? merged.workExperienceEntries.filter(Boolean).length
    : 0;
  const keywordSignals = [
    merged.summary,
    merged.linkedinUrl,
    merged.portfolioUrl,
    merged.githubUrl,
    merged.currentCompany,
    merged.currentDesignation || merged.designation,
  ].filter((item) => String(item || '').trim()).length;

  const skillsMatch = clampScore(Math.min(30, skillsCount) / 30 * 100);
  const experienceFit = clampScore(
    experienceCount > 0
      ? Math.min(100, 45 + Math.min(5, Number(merged.experience || 0)) * 8 + (merged.currentCompany ? 10 : 0))
      : 20
  );
  const educationFit = clampScore(
    educationCount > 0 ? Math.min(100, 50 + educationCount * 15 + (merged.education ? 10 : 0)) : 20
  );
  const keywordMatch = clampScore(Math.min(100, 30 + skillsCount * 4 + keywordSignals * 8));
  const overall = clampScore((skillsMatch + experienceFit + educationFit + keywordMatch) / 4);

  const insights = [];
  if (skillsCount >= 8) insights.push('Strong technical skill coverage detected in the resume.');
  if (experienceCount > 0) insights.push('Work experience section is present and contributes to profile strength.');
  if (educationCount > 0) insights.push('Education details are well represented in the resume.');
  if (merged.linkedinUrl || merged.portfolioUrl || merged.githubUrl) {
    insights.push('External profile links improve recruiter confidence.');
  }
  if (!insights.length) insights.push('Resume parsed successfully, but more structured detail would improve scoring.');

  return {
    overall,
    breakdown: {
      skillsMatch,
      experienceFit,
      educationFit,
      keywordMatch,
    },
    insights: insights.slice(0, 4),
  };
}

function hasMeaningfulProvidedScore(providedScore = {}, providedBreakdown = {}) {
  const numericValues = [
    providedScore?.overall,
    providedBreakdown?.skillsMatch,
    providedBreakdown?.experienceFit,
    providedBreakdown?.educationFit,
    providedBreakdown?.keywordMatch,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return numericValues.some((value) => value > 0);
}

/** Stage 1 — file validation before any parsing. */
export function validateCvUploadFile(file) {
  const name = file?.originalname || file?.filename || 'upload';
  const mime = String(file?.mimetype || '').trim();
  const ext = path.extname(name).toLowerCase();
  const statSize = file?.path && fs.existsSync(file.path) ? fs.statSync(file.path).size : Number(file?.size || 0);

  if (!statSize || statSize <= 0) {
    return { ok: false, message: `File is empty (0 bytes): ${name}` };
  }

  if (!MIME_TO_EXTENSIONS[mime]) {
    return {
      ok: false,
      message: `Unsupported MIME type "${mime}" for ${name}. Allowed: PDF, DOC, DOCX, TXT.`,
    };
  }

  const allowedExt = MIME_TO_EXTENSIONS[mime];
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      message: `Extension "${ext}" does not match declared MIME "${mime}" for ${name}.`,
    };
  }

  return { ok: true };
}

/** Legacy Word 97–2003 `.doc` (OLE). Mammoth only supports `.docx`. */
async function extractLegacyDocText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Missing temp file path for .doc extraction');
  }
  const { default: WordExtractor } = await import('word-extractor');
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(filePath);
  return String(extracted.getBody() || '').trim();
}

function getPdfParseFn() {
  const pdfParseModule = require('pdf-parse');
  if (typeof pdfParseModule?.PDFParse === 'function') {
    return async (buffer, parseParams = {}) => {
      const parser = new pdfParseModule.PDFParse({ data: Buffer.from(buffer) });
      try {
        const result = await parser.getText(parseParams);
        return { text: result?.text || '' };
      } finally {
        if (typeof parser.destroy === 'function') await parser.destroy();
      }
    };
  }
  if (typeof pdfParseModule === 'function') {
    return pdfParseModule;
  }
  if (typeof pdfParseModule?.default === 'function') {
    return pdfParseModule.default;
  }
  throw new Error('Unsupported pdf-parse module shape');
}

async function pdfPass1Default(buffer) {
  const pdfParse = getPdfParseFn();
  const out = await pdfParse(buffer, {});
  return String(out?.text || '');
}

/** pdfjs `getDocument` rejects Node `Buffer`; use a plain Uint8Array view (not Buffer subclass). */
function binaryToPdfUint8Array(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array && !Buffer.isBuffer(input)) return input;
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

let cachedPdfJsWorkerSrc = null;
/**
 * Worker must be the sibling of the **same** pdf.mjs that we `import()` — otherwise pnpm can
 * resolve `pdfjs-dist@4.10` for the API but load a `pdf.worker.mjs` from another version (e.g. 5.x)
 * and throw: "API version does not match the Worker version".
 */
function getPdfJsWorkerSrcHref() {
  if (cachedPdfJsWorkerSrc !== null) return cachedPdfJsWorkerSrc;
  try {
    let pdfMjsDir = '';
    if (typeof import.meta.resolve === 'function') {
      const resolved = import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs');
      const pdfMjsPath = resolved.startsWith('file:')
        ? fileURLToPath(new URL(resolved))
        : path.isAbsolute(resolved)
          ? resolved
          : fileURLToPath(new URL(resolved, import.meta.url));
      pdfMjsDir = path.dirname(pdfMjsPath);
    } else {
      const pkgJson = require.resolve('pdfjs-dist/package.json');
      pdfMjsDir = path.join(path.dirname(pkgJson), 'legacy/build');
    }
    const workerAbs = path.join(pdfMjsDir, 'pdf.worker.mjs');
    if (!fs.existsSync(workerAbs)) {
      cachedPdfJsWorkerSrc = '';
      return '';
    }
    cachedPdfJsWorkerSrc = pathToFileURL(workerAbs).href;
    return cachedPdfJsWorkerSrc;
  } catch {
    cachedPdfJsWorkerSrc = '';
    return '';
  }
}

async function loadPdfJsWithWorker() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const href = getPdfJsWorkerSrcHref();
  if (pdfjs.GlobalWorkerOptions && href) {
    pdfjs.GlobalWorkerOptions.workerSrc = href;
  }
  return pdfjs;
}

/**
 * pdf-parse bundles pdfjs 5.x; its worker sets `globalThis.pdfjsWorker`. Node's pdfjs 4 fake worker
 * prefers that global over `workerSrc`, so we get API 4.x + handler 5.x → version mismatch.
 * Isolate our pdfjs 4 passes, then restore so later pdf-parse (OCR) still sees its worker.
 */
async function runWithIsolatedPdfJsWorker(run) {
  const saved = globalThis.pdfjsWorker;
  try {
    delete globalThis.pdfjsWorker;
    return await run(await loadPdfJsWithWorker());
  } finally {
    if (saved !== undefined) globalThis.pdfjsWorker = saved;
    else delete globalThis.pdfjsWorker;
  }
}

/**
 * pdf-parse v2 has no `pagerender` hook; use getText with distinct params as fallback when pdf.js returns empty.
 */
async function pdfPass2FallbackViaPDFParse(uint8) {
  try {
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    if (typeof PDFParse !== 'function') return '';
    const parser = new PDFParse({ data: Buffer.from(uint8) });
    try {
      const result = await parser.getText({
        lineEnforce: false,
        itemJoiner: ' ',
      });
      return String(result?.text || '');
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } catch (e) {
    console.error(`[CV] Pass 2 (pdf-parse fallback) failed: ${e?.message || e}`);
    return '';
  }
}

async function pdfPass3FallbackViaPDFParse(uint8) {
  try {
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    if (typeof PDFParse !== 'function') return '';
    const parser = new PDFParse({ data: Buffer.from(uint8) });
    try {
      const result = await parser.getText({
        lineEnforce: true,
        lineThreshold: 2,
        cellThreshold: 5,
        itemJoiner: ' ',
      });
      return String(result?.text || '');
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } catch (e) {
    console.error(`[CV] Pass 3 (pdf-parse fallback) failed: ${e?.message || e}`);
    return '';
  }
}

/** Pass 2 — raw item order: join each page's text items with spaces (pdf.js + pdf-parse fallback). */
async function pdfPass2RawItemDump(buffer) {
  const uint8 = new Uint8Array(binaryToPdfUint8Array(buffer));
  let pdfjsText = '';
  try {
    await runWithIsolatedPdfJsWorker(async (pdfjs) => {
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(uint8),
        verbosity: 0,
        useSystemFonts: true,
      }).promise;
      try {
        let acc = '';
        for (let p = 1; p <= pdf.numPages; p += 1) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent({
            normalizeWhitespace: true,
            includeMarkedContent: true,
          });
          let pageText = '';
          for (const item of textContent.items || []) {
            if (item && item.str !== undefined && item.str !== null) {
              pageText += item.str;
              if (item.hasEOL) pageText += '\n';
              else pageText += ' ';
            }
            if (item && (item.type === 'beginMarkedContent' || item.type === 'endMarkedContent')) {
              pageText += '\n';
            }
          }
          const pageLine = pageText.trim();
          acc += acc ? `\n${pageLine}` : pageLine;
        }
        pdfjsText = acc;
      } finally {
        if (typeof pdf?.destroy === 'function') await pdf.destroy();
      }
    });
  } catch (e) {
    console.error(`[CV] Pass 2 (pdfjs raw dump) failed: ${e?.message || e}`);
    if (e?.stack) console.error(e.stack);
  }
  let text = pdfjsText;
  if (!text || text.length < 50) {
    text = await pdfPass2FallbackViaPDFParse(uint8);
  }
  console.log(`[CV] Pass 2 raw dump text length: ${text.length}`);
  return text;
}

/** Pass 3 — visual order: sort items by Y (desc) then X (asc) within 2 units Y tolerance. */
async function pdfPass3PositionSorted(buffer) {
  const uint8 = new Uint8Array(binaryToPdfUint8Array(buffer));
  let pdfjsText = '';
  try {
    await runWithIsolatedPdfJsWorker(async (pdfjs) => {
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(uint8),
        verbosity: 0,
        useSystemFonts: true,
      }).promise;
      try {
        const pages = [];
        const textContentParams = {
          normalizeWhitespace: true,
          includeMarkedContent: true,
        };
        for (let p = 1; p <= pdf.numPages; p += 1) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent(textContentParams);
          const items = (content.items || [])
            .filter(
              (it) =>
                it &&
                typeof it.str === 'string' &&
                it.str.length &&
                Array.isArray(it.transform)
            )
            .map((it) => ({
              str: it.str,
              x: Array.isArray(it.transform) ? Number(it.transform[4] || 0) : 0,
              y: Array.isArray(it.transform) ? Number(it.transform[5] || 0) : 0,
            }));
          items.sort((a, b) => {
            if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
            return a.x - b.x;
          });
          pages.push(items.map((i) => i.str).join(' '));
        }
        pdfjsText = pages.join('\n');
      } finally {
        if (typeof pdf?.destroy === 'function') await pdf.destroy();
      }
    });
  } catch (e) {
    console.error(`[CV] Pass 3 (pdfjs position sort) failed: ${e?.message || e}`);
    if (e?.stack) console.error(e.stack);
  }
  let text = pdfjsText;
  if (!text || text.length < 50) {
    text = await pdfPass3FallbackViaPDFParse(uint8);
  }
  console.log(`[CV] Pass 3 position-sorted text length: ${text.length}`);
  return text;
}

/**
 * Pass 4 — OCR via pdf-parse getScreenshot (no GraphicsMagick) + Tesseract.
 * pdf2pic requires `gm`/`convert` on PATH; Windows dev machines often lack it.
 */
async function pdfPass4OcrTesseract(filePath) {
  try {
    const { createWorker } = await import('tesseract.js');
    const buf = fs.readFileSync(filePath);
    const data = new Uint8Array(binaryToPdfUint8Array(buf));
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    if (typeof PDFParse !== 'function') {
      console.error('[CV] Pass 4 (OCR): PDFParse constructor missing');
      return '';
    }
    const parser = new PDFParse({ data: Buffer.from(buf) });
    let worker;
    try {
      worker = await createWorker('eng');
      const maxPages = 8;
      const screenshot = await parser.getScreenshot({
        first: maxPages,
        scale: 2,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const chunks = [];
      for (const page of screenshot.pages || []) {
        if (!page?.data?.length) continue;
        const pageNum = page.pageNumber ?? 0;
        try {
          const {
            data: { text },
          } = await worker.recognize(Buffer.from(page.data));
          chunks.push(String(text || '').trim());
        } catch (pageErr) {
          console.error(`[CV] Pass 4 (OCR) page ${pageNum} failed: ${pageErr?.message || pageErr}`);
          if (pageErr?.stack) console.error(pageErr.stack);
        }
      }
      const out = chunks.filter(Boolean).join('\n');
      console.log(`[CV] Pass 4 OCR text length: ${out.length}`);
      return out;
    } finally {
      if (worker && typeof worker.terminate === 'function') {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
      if (typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    console.error(`[CV] Pass 4 (OCR) failed: ${e?.message || e}`);
    if (e?.stack) console.error(e.stack);
    return '';
  }
}

/** pdf.js image kinds (see `util_ImageKind` in pdfjs-dist). */
const PDF_IMG_KIND_RGBA = 3;
const PDF_IMG_KIND_RGB = 2;

function scoreEmbeddedProfileImage(img) {
  if (!img || typeof img.width !== 'number' || typeof img.height !== 'number') return -1e9;
  const w = img.width;
  const h = img.height;
  const minD = Math.min(w, h);
  const maxD = Math.max(w, h);
  const aspect = maxD / Math.max(1, minD);
  const area = w * h;
  let s = 0;
  if (minD < 28) s -= 500;
  if (maxD > 2400) s -= 200;
  if (aspect > 4) s -= 400;
  if (aspect < 1.85) s += 120;
  if (minD >= 64 && maxD <= 800) s += 80;
  s += Math.log(area + 1) * 8;
  if (area < 400) s -= 300;
  return s;
}

function poolGetSyncImage(page, objId) {
  if (typeof objId !== 'string' || !page) return null;
  const pool = objId.startsWith('g_') ? page.commonObjs : page.objs;
  try {
    if (pool?.has(objId)) return pool.get(objId);
  } catch {
    /* unresolved */
  }
  return null;
}

function pdfImageToUploadBuffer(img) {
  if (!img || typeof img.width !== 'number' || typeof img.height !== 'number') return null;
  const w = img.width;
  const h = img.height;
  if (w < 2 || h < 2 || w > 4000 || h > 4000) return null;
  if (img.bitmap) {
    return null;
  }
  const raw = img.data;
  if (!raw) return null;
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    return { buffer: buf, filename: 'cv-profile.jpg' };
  }
  const kind = img.kind;
  const { PNG } = require('pngjs');
  const rgbaBytes = w * h * 4;
  if (kind === PDF_IMG_KIND_RGBA || (kind == null && buf.length >= rgbaBytes)) {
    const png = new PNG({ width: w, height: h });
    buf.copy(png.data, 0, 0, rgbaBytes);
    return { buffer: Buffer.from(PNG.sync.write(png)), filename: 'cv-profile.png' };
  }
  if (kind === PDF_IMG_KIND_RGB) {
    const need = w * h * 3;
    if (buf.length < need) return null;
    const png = new PNG({ width: w, height: h });
    const dst = png.data;
    let si = 0;
    for (let i = 0; i < w * h; i += 1) {
      const o = i * 4;
      dst[o] = buf[si++];
      dst[o + 1] = buf[si++];
      dst[o + 2] = buf[si++];
      dst[o + 3] = 255;
    }
    return { buffer: Buffer.from(PNG.sync.write(png)), filename: 'cv-profile.png' };
  }
  return null;
}

/**
 * Best-effort: pull embedded raster images from page 1 via pdf.js operator list,
 * score by size/aspect (CV headshots are usually modest and roughly square).
 * @returns {{ buffer: Buffer, filename: string } | null}
 */
async function extractCvProfilePhotoFromPdfBuffer(pdfBuffer) {
  const bytes = binaryToPdfUint8Array(pdfBuffer);
  if (!bytes?.length) return null;

  return runWithIsolatedPdfJsWorker(async (pdfjs) => {
    const OPS = pdfjs.OPS;
    const pdf = await pdfjs
      .getDocument({
        data: new Uint8Array(bytes),
        verbosity: 0,
        useSystemFonts: true,
      })
      .promise;
    try {
      const page = await pdf.getPage(1);
      const opList = await page.getOperatorList({ intent: 'display' });
      const { fnArray, argsArray } = opList;
      const candidates = [];

      for (let i = 0; i < fnArray.length; i += 1) {
        const op = fnArray[i];
        const args = argsArray[i];
        if (op === OPS.dependency) continue;

        if (op === OPS.paintInlineImageXObject && args?.[0]) {
          const img = args[0];
          const score = scoreEmbeddedProfileImage(img);
          if (score > -1e8) candidates.push({ img, score });
        }
        if (op === OPS.paintImageXObject && typeof args?.[0] === 'string') {
          const img = poolGetSyncImage(page, args[0]);
          if (img) {
            const score = scoreEmbeddedProfileImage(img);
            if (score > -1e8) candidates.push({ img, score });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      for (const { img } of candidates) {
        const out = pdfImageToUploadBuffer(img);
        if (out?.buffer?.length) return out;
      }
      return null;
    } finally {
      if (typeof pdf?.destroy === 'function') await pdf.destroy();
    }
  });
}

function scorePassText(text) {
  const t = String(text || '');
  let score = 0;
  if (/@[a-zA-Z][a-zA-Z0-9._-]*[a-zA-Z0-9]/.test(t)) score += 20;
  if (
    /\+?\d[\d\s().-]{6,}\d/.test(t) ||
    /\b\d(?:[\s-]?\d){7,}\b/.test(t.replace(/\s+/g, ' '))
  ) {
    score += 15;
  }
  if (EDU_SCORE_WORDS.test(t)) score += 15;
  if (WORK_SCORE_WORDS.test(t) || DATE_SCORE_PATTERN.test(t)) score += 15;
  if (TECH_SKILLS_REGEX.test(t)) score += 10;
  if (PROJECT_SCORE_WORDS.test(t)) score += 5;
  if (LINK_SCORE_PATTERNS.test(t)) score += 5;
  if (t.length > 2000) score += 10;
  if (t.length > 4000) score += 15;
  return score;
}

function dedupeConsecutiveLinesMaxTwice(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (const raw of lines) {
    const line = raw;
    const n = out.length;
    if (n >= 2 && out[n - 1] === line && out[n - 2] === line) continue;
    out.push(line);
  }
  return out.join('\n');
}

function extractSkillsRegex(text = '') {
  const raw = String(text || '');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seen = new Set();
  const out = [];
  for (const kw of FALLBACK_SKILL_KEYWORDS) {
    if (out.length >= 12) break;
    if (!new RegExp(`\\b${esc(kw)}\\b`, 'iu').test(raw)) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

function extractRegexFallbackData(cleanedText = '', fileName = '') {
  const text = String(cleanedText || '');
  const labeledEmail =
    text.match(
      /(?:email|e-mail|mail|courriel)\s*[:#]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
    )?.[1] || '';
  const bareEmail = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
  const email = normalizeEmail(labeledEmail || bareEmail);

  const labeledPhone =
    text.match(
      /(?:phone|tel|téléphone|telephone|mobile|tél)\s*[:#]?\s*(\+?\d[\d\s().-]{7,}\d)/i
    )?.[1] || '';
  const intlCluster = text.match(/\+\d{1,3}[\s-]?\d(?:[\d\s().-]{6,}\d)/);
  const digitCluster = text.match(/\b\d(?:[\s-]?\d){7,}\b/);
  const phone = String(labeledPhone || intlCluster?.[0] || digitCluster?.[0] || '')
    .replace(/\s+/g, ' ')
    .trim();

  const linkedinUrl = normalizeUrl(text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)\]}>]+/i)?.[0] || '');
  let githubUrl = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)\]}>]+/i)?.[0] || '';
  githubUrl = normalizeUrl(githubUrl);

  const nameParts = extractResumeName(text, fileName);

  const eduSectionRegex = /(?:formation|[eé]ducation)\s*:?\s*([\s\S]*?)(?=\n[A-ZÉÀÈÙÂÊÎÔÛÇ]{3,}|\n={3,}|$)/i;
  const expSectionRegex = /exp[eé]riences?\s*:?\s*([\s\S]*?)(?=\n[A-ZÉÀÈÙÂÊÎÔÛÇ]{3,}|\n={3,}|$)/i;

  const eduHeaders = [
    'Education',
    'FORMATION',
    'Formations',
    'FORMATIO',
    'ORMATIO',
    'Academic',
    'Academics',
  ];
  const nextAfterEdu = ['Experience', 'EXPÉRIENCE', 'EXPÉRIENCES', 'Work', 'Skills', 'Projects', 'Certifications'];
  let educationRaw = '';
  const eduMatch = text.match(eduSectionRegex);
  if (eduMatch?.[1]) educationRaw = eduMatch[1].trim();
  if (!educationRaw) {
    for (const h of eduHeaders) {
      educationRaw = findSection(text, h, nextAfterEdu);
      if (educationRaw) break;
    }
  }

  const expHeaders = ['Experience', 'EXPÉRIENCE', 'EXPÉRIENCES', 'Work Experience', 'Employment'];
  const nextAfterExp = ['Education', 'FORMATION', 'Skills', 'Projects', 'Certifications'];
  let experienceRaw = '';
  const expMatch = text.match(expSectionRegex);
  if (expMatch?.[1]) experienceRaw = expMatch[1].trim();
  if (!experienceRaw) {
    for (const h of expHeaders) {
      experienceRaw = findSection(text, h, nextAfterExp);
      if (experienceRaw) break;
    }
  }

  let location = '';

  const addrSameLine = text.match(
    /(?:[Aa]d(?:dress|resse))\s*[:\-]\s*(?!(?:e-?mail|email|courriel|@))([\w\s,.-À-ÿ]{2,60}?)(?=\s*(?:\n|e-?mail|email|tel|phone|$))/i
  );
  if (addrSameLine?.[1]?.trim().length > 1) {
    location = addrSameLine[1].trim();
  }

  if (!location) {
    const addrNextLine = text.match(
      /(?:[Aa]d(?:dress|resse))\s*[:\-][^\n]*\n\s*\\?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s,-]{1,50}?)(?:\s+[a-zA-Z0-9._%+-]+@|\s*\n|$)/i
    );
    if (addrNextLine?.[1]?.trim().length > 1) {
      location = addrNextLine[1].trim();
    }
  }

  if (!location) {
    const linesLoc = text.split('\n').slice(0, 20);
    for (const line of linesLoc) {
      const t = line.trim();
      if (
        t.includes(',') &&
        !t.includes('@') &&
        !t.includes('http') &&
        !/\d/.test(t) &&
        t.length >= 4 &&
        t.length <= 60 &&
        /^[A-Za-zÀ-ÿ\s,.-]+$/.test(t) &&
        !/experience|engineer|developer|summary|education|skills|university|college|institute|pvt|ltd|company|at |worked/i.test(t)
      ) {
        location = t;
        break;
      }
    }
  }

  if (!location) {
    const knownCities = [
      'Mumbai',
      'Delhi',
      'Bangalore',
      'Bengaluru',
      'Hyderabad',
      'Chennai',
      'Kolkata',
      'Pune',
      'Ahmedabad',
      'Panvel',
      'Navi Mumbai',
      'Thane',
      'Kharghar',
      'Khopoli',
      'Nkoteng',
      'Yaoundé',
      'Yaounde',
      'Douala',
      'Paris',
      'Lyon',
      'Marseille',
      'London',
      'Dubai',
      'Singapore',
      'New York',
      'Toronto',
      'Sydney',
      'Melbourne',
      'Nairobi',
      'Lagos',
      'Casablanca',
      'Dakar',
      'Accra',
      'Abidjan',
    ];
    const escCity = (city) => {
      let p = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      p = p.replace(/é|è/g, '[eéè]');
      return new RegExp(`\\b${p.replace(/\s+/g, '\\s+')}\\b`, 'i');
    };
    const cityHit = knownCities.find((city) => escCity(city).test(text));
    if (cityHit) location = cityHit;
  }

  location = location
    .replace(/\s*(e-?mail|email|courriel|@.+|tel\.?|phone).*$/i, '')
    .replace(/\\+/g, '')
    .trim();

  const skills = extractSkillsRegex(text);
  const portfolioLinks = extractPortfolioLinks(text);

  const summaryText = findSection(text, 'Summary', ['Experience', 'Skills', 'Projects', 'Education', 'Certifications']);

  const allEmails = [
    ...new Set(
      [...String(text).matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map((m) => normalizeEmail(m[0]))
    ),
  ].filter(Boolean);
  const rawEmailsFound = allEmails.length ? allEmails : email ? [email] : [];

  const phoneLike = [
    ...String(text).matchAll(/\+?\d[\d\s().-]{7,}\d/g),
    ...String(text).matchAll(/\b\d(?:[\s-]?\d){7,}\b/g),
  ]
    .map((m) => String(m[0]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const rawPhonesFound = [...new Set(phoneLike)];

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email,
    phone,
    currentCompany: '',
    designation: '',
    currentDesignation: '',
    experience: parsePositiveNumber(text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?|ans?)/i)?.[1] || ''),
    location,
    linkedinUrl,
    githubUrl,
    source: 'Other',
    priority: 'Medium',
    tags: skills.slice(0, 6),
    skills,
    expectedSalary: null,
    currentSalary: null,
    currency: '',
    portfolioUrl: portfolioLinks.find((x) => x.type === 'Portfolio Website')?.url || '',
    education: educationRaw,
    educationRaw,
    experienceRaw,
    languages: [],
    certifications: [],
    summary: summaryText,
    city: '',
    country: '',
    noticePeriod: '',
    educationEntries: [],
    workExperienceEntries: [],
    portfolioLinks,
    rawEmailsFound,
    rawPhonesFound,
    totalExperience: null,
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Stage 6: if AI returned 0–1 decimals for scores, convert to 0–100 integers before merge. */
function normalizeAiScoreDecimalsBeforeMerge(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  if (!parsed.score || typeof parsed.score !== 'object') return;
  if (typeof parsed.score.overall !== 'number') return;
  const o = parsed.score.overall;
  if (!(o > 0 && o <= 1)) return;
  let touched = false;
  const fields = ['overall', 'skills', 'experience', 'education', 'completeness'];
  for (const k of fields) {
    if (parsed.score[k] == null) continue;
    const v = Number(parsed.score[k]);
    if (Number.isFinite(v) && v > 0 && v <= 1) {
      parsed.score[k] = Math.round(v * 100);
      touched = true;
    }
  }
  if (touched) console.log('[cv-parse] Score normalised from decimal to integer range');
}

function stripNullishExtraFieldsFromParsed(parsed) {
  if (!parsed?.extraFields || typeof parsed.extraFields !== 'object' || Array.isArray(parsed.extraFields)) return;
  parsed.extraFields = omitNullValuesFromObject(parsed.extraFields);
}

function isPresentVal(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return false;
}

function omitNullValuesFromObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val) && val.constructor === Object) {
      const nested = omitNullValuesFromObject(val);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = val;
  }
  return out;
}

function mergeAiWithFallback(ai, fallback) {
  const out = { ...fallback };
  const a = ai && typeof ai === 'object' ? ai : {};
  for (const [k, v] of Object.entries(a)) {
    if (k === 'extraFields' && v && typeof v === 'object' && !Array.isArray(v)) {
      const mergedExtra = {
        ...(out.extraFields && typeof out.extraFields === 'object' && !Array.isArray(out.extraFields) ? out.extraFields : {}),
        ...v,
      };
      out.extraFields = omitNullValuesFromObject(mergedExtra);
      continue;
    }
    if (isPresentVal(v)) out[k] = v;
  }

  const emails = [
    ...new Set(
      [...(Array.isArray(out.rawEmailsFound) ? out.rawEmailsFound : []), ...(Array.isArray(a.rawEmailsFound) ? a.rawEmailsFound : [])]
        .map((e) => normalizeEmail(String(e || '')))
        .filter(Boolean)
    ),
  ];
  out.rawEmailsFound = emails;
  if (!isPresentVal(out.email) && emails.length) out.email = emails[0];

  const phones = [
    ...new Set(
      [...(Array.isArray(out.rawPhonesFound) ? out.rawPhonesFound : []), ...(Array.isArray(a.rawPhonesFound) ? a.rawPhonesFound : [])].map((p) =>
        String(p || '').trim()
      )
    ),
  ].filter(Boolean);
  out.rawPhonesFound = phones;
  if (!isPresentVal(out.phone) && phones.length) out.phone = phones[0];

  if (!isPresentVal(out.experience) && a.totalExperience != null) {
    const ex = parsePositiveNumber(a.totalExperience);
    if (ex != null) out.experience = ex;
  }

  return out;
}

async function extractStructuredResumeDataWithOpenAI(cleanedText, file) {
  const circuitBefore = getCvLlmCircuitSnapshot();
  if (!cleanedText) {
    return {
      parsed: null,
      meta: {
        skipped: true,
        ms: 0,
        model: null,
        usedMistral: false,
        validJson: false,
        circuitWasOpen: circuitBefore.circuitOpen,
        charsSent: 0,
        reason: 'empty_text',
      },
    };
  }
  if (!hasLlmProvider()) {
    return {
      parsed: null,
      meta: {
        skipped: true,
        ms: 0,
        model: null,
        usedMistral: false,
        validJson: false,
        circuitWasOpen: circuitBefore.circuitOpen,
        charsSent: 0,
        reason: 'no_llm',
      },
    };
  }

  const capped = cleanedText.slice(0, 22000);
  const prompt = `Extract structured candidate data from the resume text below.

Rules:
- The CV may be in any language (English, French, Spanish, Arabic, etc.). Extract all fields regardless of language.
- Contact details may appear in shaded boxes, sidebars, or without labels (including French labels like Téléphone, Courriel). Find email and phone wherever they appear.
- Extract every email pattern into rawEmailsFound (array of strings).
- Extract every phone pattern into rawPhonesFound (array of strings).
- Never invent data: use null for missing fields. Do not guess names, employers, or dates.
- extraFields (see INSTRUCTIONS below): never use null placeholder keys; omit keys you cannot support from the CV text.
- Return ONLY a single valid JSON object. No markdown, no code fences, no commentary.

INSTRUCTIONS FOR "extraFields" IN THE JSON OUTPUT:
- Do NOT invent keys. Do NOT return null values for things not in the CV.
- Only include keys where you actually found real data in the CV text.
- If a section exists in the CV that does not fit any other field above, capture it here with a descriptive key name.
- The COMPÉTENCES section of this CV often contains soft skills — capture them as: "softSkills": ["skill1", "skill2", "skill3"]
- Other examples: "awards", "publications", "volunteerWork", "drivingLicence", "nationality", "hobbies", "references"
- If none of these exist in the CV, return an empty object: {}
- NEVER return: { "nationality": null, "hobbies": null } — omit missing keys entirely.

INSTRUCTIONS FOR workExperienceEntries (apply to ALL CVs):
- startDate: extract whatever date text marks the start of this role. Accept any format: ISO, Month Year, year only, DD/MM/YYYY, or a range fragment. Return exactly as written in the CV. Do not reformat. If truly not present, return null.
- endDate: same rules. If the role is current/ongoing, return "Present" or "Current" if the CV uses that wording.
- durationText: if the CV states duration as plain text (e.g. "1 year experience", "2 years", "6 months", "1yr", "2yr"), capture it here. Return null if no such text exists for that entry.
- Do NOT return null for startDate/endDate if any date-like text exists in the job block or the lines immediately above/below it.

INSTRUCTIONS FOR portfolioLinks and portfolioUrl (apply to ALL CVs):
- portfolioLinks: extract every substantive URL from the CV: portfolio sites, GitHub profile/repos, LinkedIn, live demos, startup/company sites, freelancer project links, any http:// or https:// link, and domain-like text without a scheme (prefix with https://).
- For each URL return one object: { "type": classify as Portfolio|GitHub|LinkedIn|StartupWebsite|WorkProject|FreelancerProject|Demo|CompanyWebsite|Other, "url": always full URL with https://, "label": section heading near the link (e.g. "Projects", "Portfolio") or null }.
- Include every distinct URL the CV shows (do not drop URLs because they look similar).
- portfolioUrl: set to the single best personal portfolio URL, or the first clear portfolio/demo URL if none is obviously primary.

JSON fields (use null when absent):
{
  "firstName": string|null,
  "lastName": string|null,
  "email": string|null,
  "phone": string|null,
  "currentCompany": string|null,
  "designation": string|null,
  "location": string|null,
  "city": string|null,
  "country": string|null,
  "linkedinUrl": string|null,
  "githubUrl": string|null,
  "portfolioUrl": string|null,
  "portfolioLinks": [{"type": string, "url": string, "label": string|null}],
  "skills": string[],
  "languages": string[],
  "certifications": string[],
  "summary": string|null,
  "noticePeriod": string|null,
  "expectedSalary": number|null,
  "currentSalary": number|null,
  "totalExperience": number|null,
  "educationEntries": [{"degree": string, "institution": string, "startYear": string|null, "endYear": string|null, "grade": string|null}],
  "workExperienceEntries": [{"title": string, "company": string, "location": string|null, "startDate": string|null, "endDate": string|null, "durationText": string|null, "responsibilities": string[]}],
  "score": {
    "overall": integer 0-100 (whole number only, never a 0-1 decimal),
    "skills": integer 0-100,
    "experience": integer 0-100,
    "education": integer 0-100,
    "completeness": integer 0-100
  },
  "rawEmailsFound": string[],
  "rawPhonesFound": string[],
  "extraFields": object,
  "source": "LinkedIn"|"Naukri"|"Indeed"|"Referral"|"Company Career Page"|"Agency"|"Other"|null,
  "priority": "High"|"Medium"|"Low"|null
}

CRITICAL — score values: All score.* fields MUST be whole integers from 0 to 100. Return 75 not 0.75. Return 90 not 0.9. Never use decimals.

Resume file name: ${file?.originalname || 'resume'}

Resume text:
${capped}
`;

  const t0 = Date.now();
  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a multilingual resume parsing engine. Output JSON only, no markdown, following the user instructions exactly. All score fields must be integers 0-100, never decimals between 0 and 1.',
        },
        { role: 'user', content: prompt },
      ],
    },
    'cv-parse',
    { quiet: true }
  );
  const ms = Date.now() - t0;
  const usedMistral = !String(completion?.model || '').toLowerCase().includes('gpt');
  const content = completion.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse(content);
  return {
    parsed: parsed || null,
    meta: {
      skipped: false,
      ms,
      model: completion?.model || 'n/a',
      usedMistral,
      validJson: Boolean(parsed),
      circuitWasOpen: circuitBefore.circuitOpen,
      charsSent: cleanedText.length,
    },
  };
}

function normalizeResumeExtraction(merged = {}, fallback = {}, extras = {}) {
  const base = { ...fallback, ...merged };
  const providedScore = scaleProvidedScorePercents(
    base.score && typeof base.score === 'object' ? { ...base.score } : {}
  );
  const providedBreakdown =
    providedScore.breakdown && typeof providedScore.breakdown === 'object' ? providedScore.breakdown : {};

  const heuristicScore = buildHeuristicScore(base);
  const overallNum = Number(providedScore.overall);
  const overallValid = Number.isFinite(overallNum) && overallNum >= 0 && overallNum <= 100;

  const sm = Number(providedBreakdown.skillsMatch ?? providedScore.skills);
  const ef = Number(providedBreakdown.experienceFit ?? providedScore.experience);
  const edf = Number(providedBreakdown.educationFit ?? providedScore.education);
  const km = Number(providedBreakdown.keywordMatch ?? providedScore.completeness);
  const useLegacyBreakdown = hasMeaningfulProvidedScore(providedScore, providedBreakdown);

  const score = {
    overall: overallValid ? clampScore(overallNum) : heuristicScore.overall,
    breakdown: {
      skillsMatch: clampScore(
        useLegacyBreakdown && Number.isFinite(Number(providedBreakdown.skillsMatch))
          ? Number(providedBreakdown.skillsMatch)
          : Number.isFinite(sm) && sm > 0
            ? sm
            : heuristicScore.breakdown.skillsMatch
      ),
      experienceFit: clampScore(
        useLegacyBreakdown && Number.isFinite(Number(providedBreakdown.experienceFit))
          ? Number(providedBreakdown.experienceFit)
          : Number.isFinite(ef) && ef > 0
            ? ef
            : heuristicScore.breakdown.experienceFit
      ),
      educationFit: clampScore(
        useLegacyBreakdown && Number.isFinite(Number(providedBreakdown.educationFit))
          ? Number(providedBreakdown.educationFit)
          : Number.isFinite(edf) && edf > 0
            ? edf
            : heuristicScore.breakdown.educationFit
      ),
      keywordMatch: clampScore(
        useLegacyBreakdown && Number.isFinite(Number(providedBreakdown.keywordMatch))
          ? Number(providedBreakdown.keywordMatch)
          : Number.isFinite(km) && km > 0
            ? km
            : heuristicScore.breakdown.keywordMatch
      ),
    },
    skills: clampScore(Number.isFinite(sm) && sm > 0 ? sm : heuristicScore.breakdown.skillsMatch),
    experience: clampScore(Number.isFinite(ef) && ef > 0 ? ef : heuristicScore.breakdown.experienceFit),
    education: clampScore(Number.isFinite(edf) && edf > 0 ? edf : heuristicScore.breakdown.educationFit),
    completeness: clampScore(Number.isFinite(km) && km > 0 ? km : heuristicScore.breakdown.keywordMatch),
    insights:
      Array.isArray(providedScore.insights) && providedScore.insights.length
        ? providedScore.insights
        : heuristicScore.insights,
  };

  if (!overallValid) {
    score.overall = heuristicScore.overall;
  }

  const eduEntries = Array.isArray(base.educationEntries) ? base.educationEntries : [];
  const workEntries = Array.isArray(base.workExperienceEntries) ? base.workExperienceEntries : [];
  const skillsArr = Array.isArray(base.skills) ? base.skills.filter(Boolean).slice(0, 30) : [];

  const sourceOk = ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Company Career Page', 'Agency', 'Other'].includes(
    String(base.source || '').trim()
  );
  const priorityOk = ['High', 'Medium', 'Low'].includes(String(base.priority || '').trim());

  const linkSource = [base.summary, base.education, base.linkedinUrl, base.githubUrl, base.portfolioUrl]
    .filter(Boolean)
    .join('\n');
  const portfolioLinks = Array.isArray(base.portfolioLinks) ? base.portfolioLinks : extractPortfolioLinks(linkSource);

  const extraData =
    base.extraFields && typeof base.extraFields === 'object' && !Array.isArray(base.extraFields)
      ? base.extraFields
      : {};

  return {
    firstName: String(base.firstName || fallback.firstName || '').trim(),
    lastName: String(base.lastName || fallback.lastName || '').trim(),
    email: normalizeEmail(base.email || fallback.email || ''),
    phone: String(base.phone || fallback.phone || '').trim(),
    currentCompany: String(base.currentCompany || fallback.currentCompany || '').trim(),
    designation: String(base.designation || fallback.designation || '').trim(),
    currentDesignation: String(
      base.currentDesignation || base.designation || fallback.currentDesignation || ''
    ).trim(),
    experience: parsePositiveNumber(base.experience ?? base.totalExperience),
    location: buildLocation(base.location, base.city, base.country) || buildLocation(fallback.location, fallback.city, fallback.country),
    city: String(base.city || fallback.city || '').trim(),
    country: String(base.country || fallback.country || '').trim(),
    linkedinUrl: normalizeUrl(base.linkedinUrl || fallback.linkedinUrl || ''),
    githubUrl: normalizeUrl(base.githubUrl || fallback.githubUrl || ''),
    portfolioUrl: normalizeUrl(base.portfolioUrl || fallback.portfolioUrl || ''),
    source: sourceOk ? String(base.source).trim() : 'Other',
    priority: priorityOk ? String(base.priority).trim() : 'Medium',
    tags: Array.isArray(base.tags) ? base.tags.filter(Boolean).slice(0, 10) : [],
    skills: skillsArr,
    expectedSalary: parsePositiveNumber(base.expectedSalary),
    currentSalary: parsePositiveNumber(base.currentSalary),
    currency: String(base.currency ?? '').trim(),
    education: String(base.education || fallback.education || '').trim(),
    languages: Array.isArray(base.languages) ? base.languages.filter(Boolean).slice(0, 10) : [],
    certifications: Array.isArray(base.certifications) ? base.certifications.filter(Boolean).slice(0, 10) : [],
    summary: String(base.summary || fallback.summary || '').trim(),
    noticePeriod: String(base.noticePeriod || '').trim(),
    educationEntries: eduEntries,
    workExperienceEntries: workEntries,
    portfolioLinks,
    score,
    resumeUrl: extras.resumeUrl || null,
    resumeFileName: extras.resumeFileName || null,
    profilePhotoUrl:
      typeof extras.profilePhotoUrl === 'string' && extras.profilePhotoUrl.trim()
        ? extras.profilePhotoUrl.trim()
        : null,
    parsedAt: new Date().toISOString(),
    isMockData: false,
    extraData,
    rawEmailsFound: Array.isArray(base.rawEmailsFound) ? base.rawEmailsFound : [],
    rawPhonesFound: Array.isArray(base.rawPhonesFound) ? base.rawPhonesFound : [],
  };
}

/**
 * Stages 1–4 only: file validation, text extraction, clean, regex fallback (no AI / no uploads).
 * Used by bulk CV duplicate gate so we never call the LLM until the user resolves a duplicate.
 */
export async function runCvPipelineThroughStage4(file) {
  const displayName = file.originalname || file.filename || 'upload';
  const sizeBytes =
    file?.path && fs.existsSync(file.path) ? fs.statSync(file.path).size : Number(file?.size || 0);
  const sizeKb = (sizeBytes / 1024).toFixed(2);
  const mime = file.mimetype || 'unknown';
  const ext = path.extname(displayName).toLowerCase();

  logStageBanner(1, 'File Validation');
  logNarrative([
    `File: ${displayName}`,
    `Size: ${sizeKb} KB`,
    `MIME: ${mime}`,
    `Extension: ${ext || '(none)'}`,
  ]);
  const v = validateCvUploadFile(file);
  if (!v.ok) {
    logNarrative([`Status: ❌ REJECTED — ${v.message}`]);
    throw new Error(v.message);
  }
  logNarrative(['Status: ✅ ACCEPTED — proceeding to extraction']);

  /** Own copy of bytes — pdf-parse / pdfjs may detach underlying ArrayBuffer; avoid "detached ArrayBuffer" on later passes. */
  const buffer = Buffer.from(fs.readFileSync(file.path));

  /** Set only for PDFs when `extractCvProfilePhotoFromPdfBuffer` finds a usable raster. */
  let extractedProfilePhoto = null;

  let combinedRaw = '';
  if (mime === 'application/pdf' || ext === '.pdf') {
    logStageBanner(2, 'Text Extraction Engine (All 4 Passes)');
    async function settlePass(fn) {
      try {
        return { status: 'fulfilled', value: await fn() };
      } catch (reason) {
        return { status: 'rejected', reason };
      }
    }
    /** Run passes 1→4 sequentially — parallel pdf.js + pdf-parse hits DataCloneError / worker races in Node. */
    const settled = [
      await settlePass(() => pdfPass1Default(buffer)),
      await settlePass(() => pdfPass2RawItemDump(buffer)),
      await settlePass(() => pdfPass3PositionSorted(buffer)),
      await settlePass(() => pdfPass4OcrTesseract(file.path)),
    ];
    const text1 = settled[0].status === 'fulfilled' ? settled[0].value : '';
    const text2 = settled[1].status === 'fulfilled' ? settled[1].value : '';
    const text3 = settled[2].status === 'fulfilled' ? settled[2].value : '';
    const text4 = settled[3].status === 'fulfilled' ? settled[3].value : '';

    const passTitles = [
      'Pass 1 — Default pdf-parse',
      'Pass 2 — Raw item string dump',
      'Pass 3 — Position-aware render',
      'Pass 4 — OCR Tesseract',
    ];
    const texts = [text1, text2, text3, text4];
    for (let i = 0; i < 4; i += 1) {
      logNarrative(linesForPdfPassNarrative(i + 1, passTitles[i], texts[i], settled[i]));
      logNarrative(['']);
    }

    const { combined, sorted } = buildPdfCombineResult(text1, text2, text3, text4);
    combinedRaw = combined;

    const sortHints = ['← listed FIRST (winner)', '← listed second', '← listed third', '← listed last'];
    logNarrative(['Scoring summary:']);
    sorted.forEach((p, idx) => {
      const hint = sortHints[idx] || '';
      logNarrative([`Pass ${p.order}: len=${String(p.text || '').length}  score=${p.score}  ${hint}`]);
    });
    logNarrative(['']);
    const emailInCombined = RX_EMAIL_IN_TEXT.test(combinedRaw);
    const phoneInCombined = RX_PHONE_LOOSE.test(combinedRaw);
    logNarrative([
      `Combined text block length: ~${combinedRaw.length} chars`,
      `Email found in combined text: ${emailInCombined ? '✅ YES' : '❌ NO'}`,
      `Phone found in combined text: ${phoneInCombined ? '✅ YES' : '❌ NO'}`,
    ]);

    try {
      extractedProfilePhoto = await extractCvProfilePhotoFromPdfBuffer(buffer);
      logNarrative([
        '',
        extractedProfilePhoto?.buffer?.length
          ? `Embedded profile image: ✅ extracted (${extractedProfilePhoto.filename}, ${(
              extractedProfilePhoto.buffer.length / 1024
            ).toFixed(1)} KB)`
          : 'Embedded profile image: ⚪ none (no suitable embedded raster on page 1)',
      ]);
    } catch (photoErr) {
      logNarrative(['', `Embedded profile image: ❌ failed — ${photoErr?.message || photoErr}`]);
    }
  } else {
    logStageBanner(2, 'Text Extraction Engine');
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      logNarrative(['Engine: DOCX — mammoth.extractRawText({ buffer })']);
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const result = await mammoth.extractRawText({ buffer });
      combinedRaw = result?.value || '';
    } else if (mime === 'application/msword' || ext === '.doc') {
      logNarrative(['Engine: DOC (legacy Word) — word-extractor']);
      try {
        combinedRaw = await extractLegacyDocText(file.path);
      } catch (docErr) {
        const msg = docErr?.message || String(docErr);
        throw new Error(`Could not read Word .doc file: ${msg}`);
      }
    } else {
      logNarrative(['Engine: Plain text — UTF-8 decode of buffer']);
      combinedRaw = buffer.toString('utf8');
    }
    logNarrative([`Extracted text length: ${combinedRaw.length} chars`]);
  }

  const nulCount = (combinedRaw.match(/\u0000/g) || []).length;
  const afterCleanOnly = cleanResumeText(combinedRaw);
  const dupStats = dedupeConsecutiveLinesMaxTwiceWithStats(afterCleanOnly);
  const cleaned = dupStats.text;

  logStageBanner(3, 'Clean + Deduplicate');
  logNarrative([
    `Input length:  ${combinedRaw.length} chars`,
    `After cleaning: ${cleaned.length} chars`,
    `Duplicate lines removed: ${dupStats.removed}`,
    `NUL chars removed: ${nulCount}`,
    'Extra spaces collapsed: yes',
    '',
    'Cleaned preview (first 500 chars):',
    cleaned.slice(0, 500).replace(/\n/g, '↵'),
  ]);

  logStageBanner(4, 'Regex Safety Net');
  const fallbackData = extractRegexFallbackData(cleaned, displayName);
  const hints = regexHintsForLogs(cleaned, fallbackData);
  const fullName = `${fallbackData.firstName} ${fallbackData.lastName}`.trim();
  const skillSample = (fallbackData.skills || []).slice(0, 12).join(', ');
  logNarrative([
    fallbackData.email
      ? `✅ Email found:    ${fallbackData.email}`
      : '❌ Email:       not found',
    ...(fallbackData.email && hints.emailHow ? [`                   ${hints.emailHow}`] : []),
    '',
    fallbackData.phone
      ? `✅ Phone found:    ${fallbackData.phone}`
      : '❌ Phone:       not found',
    ...(fallbackData.phone && hints.phoneHow ? [`                   ${hints.phoneHow}`] : []),
    '',
    fullName
      ? `✅ Name found:     ${fullName}`
      : '❌ Name:        not found',
    ...(fullName && hints.nameHow ? [`                   ${hints.nameHow}`] : []),
    '',
    fallbackData.location
      ? `✅ Location found: ${fallbackData.location}`
      : '❌ Location:    not found',
    ...(fallbackData.location && hints.locHow ? [`                   ${hints.locHow}`] : []),
    '',
    fallbackData.linkedinUrl ? `✅ LinkedIn:       ${fallbackData.linkedinUrl}` : '❌ LinkedIn:       not found',
    fallbackData.githubUrl ? `✅ GitHub:         ${fallbackData.githubUrl}` : '❌ GitHub:         not found',
    '',
    skillSample ? `✅ Skills found:\n   ${skillSample}` : '❌ Skills:         (no keyword hits)',
    '',
    String(fallbackData.educationRaw || '').trim()
      ? '✅ Education raw block captured'
      : '❌ Education raw block: not captured',
    String(fallbackData.experienceRaw || '').trim()
      ? '✅ Experience raw block captured'
      : '❌ Experience raw block: not captured',
    '',
    'fallbackData saved — will fill any AI nulls',
  ]);

  return {
    displayName,
    mime,
    ext,
    buffer,
    extractedProfilePhoto,
    combinedRaw,
    cleaned,
    fallbackData,
    fullName,
  };
}

/**
 * Stages 5–8: uploads + AI + merge + normalize.
 * @param {Record<string, string>|null|undefined} identityPatch - merged into regex fallback before AI merge (bulk create_anyway).
 */
export async function finalizeCvPipelineFromStage5(
  file,
  candidateId,
  stage4,
  identityPatch,
  tenantDbNameOpt
) {
  let { displayName, buffer, extractedProfilePhoto, cleaned, fallbackData, fullName } = stage4;
  if (identityPatch && typeof identityPatch === 'object') {
    fallbackData = { ...fallbackData, ...identityPatch };
    fullName = `${String(fallbackData.firstName || '').trim()} ${String(fallbackData.lastName || '').trim()}`.trim();
  }
  const tenantDbName =
    String(tenantDbNameOpt || getActiveTenantDbName() || 'default').trim() || 'default';
  const tPipeline = Date.now();

  logStageBanner(5, 'AI Structured Extraction');
  const circuitSnap = getCvLlmCircuitSnapshot();
  logNarrative([
    'Circuit breaker check:',
    `  OpenAI last failed at: ${
      circuitSnap.lastFailureIso
        ? `${circuitSnap.lastFailureIso} (within 10 min window)`
        : 'never'
    }`,
    `  Circuit: ${circuitSnap.circuitOpen ? 'OPEN → skipping OpenAI, going directly to Mistral' : 'CLOSED → OpenAI preferred when configured'}`,
    ...(circuitSnap.circuitOpen
      ? [`  Log: "provider=Mistral/circuit-open"`]
      : ['  Log: (quiet mode — see Provider line after AI run)']),
    '',
    `Text sent to AI: ${cleaned.length} chars (well under 22,000 cap)`,
  ]);

  const uploadPromise = uploadBufferToCloudinary(buffer, {
    folder: `jobportal/candidates/${candidateId || 'temp'}/resumes`,
    contentType: uploadContentTypeForFile(file.mimetype, displayName),
    originalFilename: displayName,
    tenantDbName,
  });

  const profilePhotoPromise =
    extractedProfilePhoto?.buffer?.length > 0
      ? uploadBufferToCloudinary(extractedProfilePhoto.buffer, {
          folder: `jobportal/candidates/${candidateId || 'temp'}/profile-photos`,
          resourceType: 'image',
          originalFilename: extractedProfilePhoto.filename || 'cv-profile.png',
          tenantDbName,
        })
      : Promise.resolve(null);

  const aiPromise = extractStructuredResumeDataWithOpenAI(cleaned, file);
  const [uploadSettled, profilePhotoSettled, aiSettled] = await Promise.allSettled([
    uploadPromise,
    profilePhotoPromise,
    aiPromise,
  ]);

  let aiParsed = null;
  let aiMeta = {
    skipped: true,
    ms: 0,
    model: null,
    usedMistral: false,
    validJson: false,
    circuitWasOpen: circuitSnap.circuitOpen,
    charsSent: cleaned.length,
    reason: !hasLlmProvider() ? 'no_llm' : undefined,
  };
  if (aiSettled.status === 'fulfilled' && aiSettled.value && typeof aiSettled.value === 'object') {
    aiParsed = aiSettled.value.parsed ?? null;
    aiMeta = { ...aiMeta, ...(aiSettled.value.meta || {}) };
  } else if (aiSettled.status === 'rejected') {
    logNarrative(['', `AI extraction threw: ${aiSettled.reason?.message || aiSettled.reason}`]);
  }
  if (aiParsed) {
    normalizeAiScoreDecimalsBeforeMerge(aiParsed);
    stripNullishExtraFieldsFromParsed(aiParsed);
  }

  let resumeUrl = null;
  if (uploadSettled.status === 'fulfilled') {
    const u = uploadSettled.value;
    resumeUrl = u?.secure_url || u?.url || null;
  }

  let profilePhotoUrl = null;
  if (profilePhotoSettled.status === 'fulfilled' && profilePhotoSettled.value) {
    const ph = profilePhotoSettled.value;
    profilePhotoUrl = ph?.secure_url || ph?.url || null;
  }

  const snapAfterAi = getCvLlmCircuitSnapshot();

  let providerLine = 'OpenAI';
  if (aiMeta.skipped && aiMeta.reason === 'no_llm') {
    providerLine = 'N/A (no LLM configured)';
  } else if (aiMeta.skipped && aiMeta.reason === 'empty_text') {
    providerLine = 'N/A (empty resume text)';
  } else if (aiSettled.status === 'rejected') {
    providerLine = `error: ${aiSettled.reason?.message || 'unknown'}`;
  } else if (aiMeta.usedMistral && aiMeta.circuitWasOpen) {
    providerLine = 'Mistral (circuit-open, no OpenAI wait)';
  } else if (aiMeta.usedMistral && snapAfterAi.circuitOpen && !aiMeta.circuitWasOpen) {
    providerLine = 'Mistral (after OpenAI 429 — circuit now open for next requests)';
  } else if (aiMeta.usedMistral) {
    providerLine = 'Mistral (fallback or OpenAI unavailable)';
  }

  logNarrative([
    '',
    `AI processing time: ~${aiMeta.ms}ms`,
    `Provider: ${providerLine}`,
    '',
    aiMeta.validJson && aiParsed ? 'AI returned valid JSON ✅' : 'AI returned valid JSON ❌ (using Stage 4 fallback where needed)',
  ]);
  if (aiParsed && aiMeta.validJson) {
    console.log('');
    console.log('AI result:');
    console.log(safeJsonForLog(aiParsed));
  }

  logStageBanner(6, 'Validate + Merge');
  const chk = validateAiShapeForLogs(aiParsed);
  logNarrative([
    `JSON valid:                  ${chk.jsonValid ? '✅' : '❌'}`,
    `educationEntries is array:   ${chk.eduArr ? '✅' : '❌'} (${chk.eduLen} entries)`,
    `workExperienceEntries array: ${chk.workArr ? '✅' : '❌'} (${chk.workLen} entries)`,
    `skills is array:             ${chk.skillsArr ? '✅' : '❌'} (${chk.skillsLen} items)`,
    `score.overall in 0-100:      ${chk.scoreOk ? '✅' : '❌'}`,
    `source enum valid:           ${chk.sourceOk ? '✅' : '✅ defaulted to "Other"'}`,
    `priority enum valid:         ${chk.priorityOk ? '✅' : '✅ defaulted to "Medium"'}`,
  ]);

  const mergedFlat = mergeAiWithFallback(aiParsed, fallbackData);
  const portfolioLinks = extractPortfolioLinks(cleaned);
  if (!mergedFlat.portfolioLinks?.length) mergedFlat.portfolioLinks = portfolioLinks;

  const extrasBase = { resumeFileName: displayName, resumeUrl, profilePhotoUrl };
  const normalizedData = normalizeResumeExtraction(mergedFlat, {}, extrasBase);

  const gh = normalizedData.githubUrl;
  if (gh && !normalizedData.portfolioLinks.some((p) => p.url?.includes('github.com'))) {
    normalizedData.portfolioLinks = [...normalizedData.portfolioLinks, { type: 'GitHub', url: gh }];
  }

  // Bulk CV "create_anyway": mergeAiWithFallback prefers AI fields, which can restore the original
  // duplicate email/name from the CV text. Re-apply explicit identityPatch on the outbound payload.
  if (identityPatch && typeof identityPatch === 'object') {
    const fn = identityPatch.firstName != null ? String(identityPatch.firstName).trim() : '';
    const ln = identityPatch.lastName != null ? String(identityPatch.lastName).trim() : '';
    const em = identityPatch.email != null ? String(identityPatch.email).trim() : '';
    if (fn) normalizedData.firstName = fn;
    if (ln) normalizedData.lastName = ln;
    if (em) normalizedData.email = em;
  }

  const pickSrc = (aiKey, fbKey) => {
    const av = aiParsed?.[aiKey];
    if (isPresentVal(av)) return 'AI';
    if (isPresentVal(fallbackData[fbKey])) return 'fallback';
    return '—';
  };

  const nameSrc =
    isPresentVal(aiParsed?.firstName) || isPresentVal(aiParsed?.lastName)
      ? 'AI'
      : fullName
        ? 'fallback'
        : '—';
  const eduSrc = aiParsed?.educationEntries?.length ? 'AI' : 'fallback';
  const expSrc = aiParsed?.workExperienceEntries?.length ? 'AI' : 'fallback';

  logNarrative([
    '',
    'Merge result:',
    `  email  → ${pickSrc('email', 'email')}:  ${normalizedData.email || 'N/A'}  ${normalizedData.email ? '✅' : '❌'}`,
    `  phone  → ${pickSrc('phone', 'phone')}:  ${normalizedData.phone || 'N/A'}  ${normalizedData.phone ? '✅' : '❌'}`,
    `  name   → ${nameSrc}:  ${[normalizedData.firstName, normalizedData.lastName].filter(Boolean).join(' ') || 'N/A'}  ${
      [normalizedData.firstName, normalizedData.lastName].filter(Boolean).length ? '✅' : '❌'
    }`,
    `  edu    → ${eduSrc}:  ${normalizedData.educationEntries?.length || 0} entries  ✅`,
    `  exp    → ${expSrc}:  ${normalizedData.workExperienceEntries?.length || 0} entries  ✅`,
    '',
    'Final merge log:',
    `  name="${[normalizedData.firstName, normalizedData.lastName].filter(Boolean).join(' ')}"`,
    `  email="${normalizedData.email || ''}"`,
    `  phone="${normalizedData.phone || ''}"`,
    `  edu=${normalizedData.educationEntries?.length || 0}  exp=${normalizedData.workExperienceEntries?.length || 0}`,
  ]);

  logStageBanner(7, 'Three Storage Destinations');
  const extraKeys =
    normalizedData.extraData && typeof normalizedData.extraData === 'object'
      ? Object.keys(normalizedData.extraData)
      : [];
  const softSkills = Array.isArray(normalizedData.extraData?.softSkills)
    ? normalizedData.extraData.softSkills
    : [];
  logNarrative([
    'Candidate DB record:    ⚪ not persisted (parse-resume returns JSON only)',
    '  name, email, phone, designation, company,',
    '  location, skills, education, experience,',
    '  languages, score, summary — all present on the response object for the client',
    '',
    `Extra data column:      ✅ merged into response payload extraData (${extraKeys.length} top-level keys)`,
    ...(softSkills.length
      ? [`  softSkills: [${softSkills.length} items from AI extraFields]`]
      : ['  (no softSkills array in extraData)']),
    '',
    `Cloudinary upload:      ${uploadSettled.status === 'fulfilled' && resumeUrl ? '✅ completed' : uploadSettled.status === 'fulfilled' ? '⚪ finished without URL' : '❌ failed'} (parallel with profile photo + AI)`,
    resumeUrl ? `                        resumeUrl attached to payload` : '                        (no resumeUrl — check Cloudinary config / error logs)',
    '',
    `Profile photo upload:   ${
      profilePhotoSettled.status === 'fulfilled' && profilePhotoUrl
        ? '✅ completed'
        : profilePhotoSettled.status === 'fulfilled'
          ? '⚪ skipped (no embedded image or upload returned no URL)'
          : '❌ failed'
    }`,
    profilePhotoUrl ? `                        profilePhotoUrl attached to payload` : '                        profilePhotoUrl: null (use initials in UI)',
  ]);

  const totalMs = Date.now() - tPipeline;
  logStage8FinalResponse(normalizedData, {
    totalMs,
    providerLabel: providerLine,
  });

  return normalizedData;
}

export async function processCandidateCv(file, { candidateId } = {}) {
  const stage4 = await runCvPipelineThroughStage4(file);
  const tenantDbName = String(getActiveTenantDbName() || 'default').trim() || 'default';
  return finalizeCvPipelineFromStage5(file, candidateId, stage4, null, tenantDbName);
}
