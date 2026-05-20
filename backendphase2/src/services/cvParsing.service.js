import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { createRequire } from 'module';
import { env } from '../config/env.js';
import { getActiveTenantDbName } from '../config/prisma.js';
import { uploadBufferToCloudinary, uploadContentTypeForFile } from '../utils/s3.js';
import {
  chatCompletionWithFallback,
  extractUsageFromLlmError,
  getCvLlmCircuitSnapshot,
  hasLlmProvider,
} from './llmChatFallback.service.js';
import {
  buildCvExtractionJsonSchemaBlock,
  buildCvExtractionPromptInstructions,
  countPipelineFieldCoverage,
  applyPipelineFieldsToNormalized,
  enrichParsedFromNarrative,
  logPipelineSectionsExtraction,
  CV_PIPELINE_SECTIONS,
} from './cvPipelineSchema.js';

const require = createRequire(import.meta.url);

const MIME_TO_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
};

const CV_PASS_DIVIDER = '--- CV_PASS_DIVIDER ---';

const SECTION_HEADER_KEYWORDS =
  /\b(education|experience|skills|summary|contact|profile|objective|employment|formation|parcours|projets|extracurricular|curricular|activities|volunteers?|certifications?|courses?|projects?|references?|languages?|awards?|honou?rs|hobbies|interests|achievements?|qualifications?|academic|strengths|competencies)\b/i;

/** Full-line section titles (PDF often emits these as pseudo "names"). */
const RESUME_SECTION_LINE =
  /^(?:summary|objective|profile|contact|skills|technical\s+skills|core\s+competencies|work\s+experience|employment|experience|education|academic|projects?|certifications?|courses?|languages?|references?|hobbies|interests|volunteers?|volunteering|achievements?|awards?|honou?rs(?:\s*(?:&|and)\s*awards)?|extra\s+curricular(?:\s+activities)?|extracurricular(?:\s+activities)?|professional\s+summary|personal\s+details|career\s+objective)\b/i;

const NAME_JOB_TITLE_SUFFIX =
  /\s*(?:Computer|Software|Full[\s-]?Stack|Frontend|Front[\s-]?end|Backend|Back[\s-]?end|Web|Data|Mechanical|Electrical|Civil|UI|UX|DevOps|Cloud|Machine\s+Learning|ML|AI)\s+Engineer\b/i;

const NON_NAME_WORD_PARTS = new Set([
  'extra',
  'curricular',
  'extracurricular',
  'activities',
  'activity',
  'volunteer',
  'volunteers',
  'project',
  'projects',
  'certification',
  'certifications',
  'course',
  'courses',
  'education',
  'experience',
  'summary',
  'skills',
  'profile',
  'contact',
  'references',
  'languages',
  'awards',
  'honours',
  'honors',
  'technical',
  'strengths',
  'objective',
  'employment',
  'internship',
  'academic',
  'qualification',
  'institute',
  'university',
  'college',
  'school',
  'work',
  'history',
  'personal',
  'information',
  'details',
  'formation',
  'parcours',
  'projets',
]);

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
      ? extractNameFromContactHeader(cleanedText).firstName
        ? '(name before email/phone on contact line)'
        : '(header line / filename / email local-part heuristic)'
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

function logStage8FinalResponse(normalizedData, { totalMs, apiSummary }) {
  const name = [normalizedData.firstName, normalizedData.lastName].filter(Boolean).join(' ');
  const emailOk = Boolean(normalizedData.email);
  const phoneOk = Boolean(normalizedData.phone);
  const nEdu = normalizedData.educationEntries?.length || 0;
  const nWork = normalizedData.workExperienceEntries?.length || 0;
  const summary = apiSummary || {};
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
  console.log(`Parse chain:    ${summary.parseChain || 'N/A'}`);
  console.log(`API key used:   ${summary.apiUsedLabel || 'N/A'}`);
  if (summary.billable) {
    console.log(
      `Billable tokens: input ${summary.inputTokens ?? 0}, output ${summary.outputTokens ?? 0}, total ${summary.totalTokens ?? 0} (${summary.provider})`
    );
  } else {
    console.log('Billable tokens: N/A (system regex fallback — OpenAI/Mistral not billed for this resume)');
  }
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

function titleCaseWord(word = '') {
  const w = String(word || '').trim();
  if (!w) return '';
  if (w.length <= 2 && /^[A-Z]+$/.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function isResumeSectionHeaderLine(line = '') {
  const t = String(line || '').trim();
  if (!t || t.length > 90) return true;
  if (RESUME_SECTION_LINE.test(t)) return true;
  if (/@|https?:\/\//i.test(t)) return true;
  const parts = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => NON_NAME_WORD_PARTS.has(p))) return true;
  if (parts.length >= 2) {
    const nameLike = parts.filter((p) => !NON_NAME_WORD_PARTS.has(p));
    if (nameLike.length < 2 && parts.some((p) => NON_NAME_WORD_PARTS.has(p))) return true;
  }
  if (SECTION_HEADER_KEYWORDS.test(t) && parts.length <= 5 && !/\d/.test(t)) return true;
  return false;
}

/** Split glued PDF headers (NAME+Title, contact pipes) before regex / name heuristics. */
function preprocessResumeTextForParsing(rawText = '') {
  let t = String(rawText || '').replace(/\r/g, '\n');

  t = t.replace(
    /\b([A-Z][A-Z]{1,}(?:\s+[A-Z][A-Z]{1,}){0,4})\s*(Computer|Software|Full[\s-]?Stack|Frontend|Front[\s-]?end|Backend|Back[\s-]?end|Web|Data|Mechanical|Electrical|Civil|UI|UX|DevOps|Cloud|Machine\s+Learning|ML|AI)\s+Engineer\b/g,
    '$1\n$2 Engineer'
  );

  const sectionBreaks = [
    'Summary',
    'Work Experience',
    'Experience',
    'Education',
    'Skills',
    'Projects',
    'Certifications',
    'Extra Curricular Activities',
    'Extracurricular Activities',
    'Languages',
    'Volunteers',
    'Honours & Awards',
    'Honors & Awards',
  ];
  for (const hdr of sectionBreaks) {
    const esc = hdr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`(?<!\\n)(${esc})(?=\\s)`, 'gi'), '\n$1\n');
  }

  t = t.replace(/\s*\|\s*(?=\+?\d|[a-zA-Z0-9._%+-]+@)/g, '\n');

  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function extractPrimaryResumeBlock(fullText = '') {
  const t = String(fullText || '');
  const idx = t.indexOf(CV_PASS_DIVIDER);
  return idx > 0 ? t.slice(0, idx).trim() : t;
}

function extractNameFromContactHeader(text = '') {
  const primary = extractPrimaryResumeBlock(text);
  const emailMatch = primary.match(RX_EMAIL_IN_TEXT);
  const phoneMatch = primary.match(RX_PHONE_LOOSE);
  if (!emailMatch && !phoneMatch) return { firstName: '', lastName: '' };

  let cutAt = primary.length;
  if (emailMatch?.index != null && emailMatch.index >= 0) cutAt = Math.min(cutAt, emailMatch.index);
  if (phoneMatch?.index != null && phoneMatch.index >= 0) cutAt = Math.min(cutAt, phoneMatch.index);

  const before = primary.slice(0, cutAt);
  const lines = before.split('\n').map((l) => l.trim()).filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let line = lines[i].replace(NAME_JOB_TITLE_SUFFIX, '').replace(/\|+\s*$/g, '').trim();
    if (!line || line.length > 80 || isResumeSectionHeaderLine(line)) continue;

    const split = splitNameCandidate(line);
    if (split.firstName) return split;

    const caps = line.replace(/[^A-Za-zÀ-ÿ\s.'-]/g, '').trim();
    if (/^[A-Z][A-Z\s.'-]{3,}$/.test(caps)) {
      const w = caps.split(/\s+/).filter(Boolean);
      if (w.length >= 2 && w.length <= 5) {
        return {
          firstName: titleCaseWord(w[0]),
          lastName: w.slice(1).map(titleCaseWord).join(' '),
        };
      }
    }
  }

  return { firstName: '', lastName: '' };
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
  if (isResumeSectionHeaderLine(cleaned)) return false;

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;

  const lowerParts = parts.map((part) => part.toLowerCase());
  if (lowerParts.some((part) => NON_NAME_WORD_PARTS.has(part))) return false;
  if (lowerParts.some((part) => RESUME_TITLE_STOPWORDS.has(part))) return false;
  if (lowerParts.some((part) => /(?:engineer|developer|designer|manager|analyst|consultant|architect|student|intern)/.test(part))) {
    return false;
  }

  return parts.every((part) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]*$/.test(part));
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
  const cleanedText = preprocessResumeTextForParsing(fullText);
  const primary = extractPrimaryResumeBlock(cleanedText);
  let nameGuess = '';

  const headerName = extractNameFromContactHeader(cleanedText);
  if (headerName.firstName || headerName.lastName) {
    return headerName;
  }

  const gluedHeader = primary.match(
    /^([A-Z][A-Z\s.'-]{3,60}?)(?:\s*(?:Computer|Software|Full[\s-]?Stack|Frontend|Front[\s-]?end|Backend|Back[\s-]?end|Web|Data|Mechanical|Electrical|Civil|UI|UX|DevOps|Cloud|Machine\s+Learning|ML|AI)\s+Engineer)?/m
  );
  if (gluedHeader?.[1]) {
    const fromGlued = splitNameCandidate(gluedHeader[1].trim());
    if (fromGlued.firstName) return fromGlued;
  }

  const allCapsLines = primary.split('\n').map((l) => l.trim());
  for (const line of allCapsLines.slice(0, 30)) {
    if (
      /^[A-Z][A-Z\s.'-]{4,60}$/.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.split(/\s+/).length <= 5 &&
      !/EXPERIENCE|EDUCATION|SKILLS|SUMMARY|PROFILE|CONTACT|FORMATION|COMPÉTENCES|LANGUES|PROJETS|ACTIVIT|CURRICULAR|VOLUNTEER|CERTIFICATION|PROJECT/i.test(
        line
      ) &&
      !isResumeSectionHeaderLine(line)
    ) {
      nameGuess = line.trim();
      break;
    }
  }

  if (!nameGuess) {
    const spacedMatch = primary.match(/\b([A-Z]\s){2,}[A-Z](\s{2,}([A-Z]\s){1,}[A-Z])?\b/);
    if (spacedMatch) {
      let s = spacedMatch[0].replace(/\s+/g, ' ').trim();
      s = s.replace(/([A-Z])\s+(?=[A-Z])/g, '$1');
      nameGuess = s;
    }
  }

  if (!nameGuess) {
    const lines = primary.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 25)) {
      if (isResumeSectionHeaderLine(line)) continue;
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
        !/experience|engineer|developer|manager|analyst|intern|worked|designed|developed|summary|education|skills|profile|contact|formation|compétences|langues|computer|software|mechanical|electrical|frontend|backend|fullstack|at |pvt|ltd|inc|interface|dynamic|responsive|curricular|activities|volunteer|certification|project/i.test(
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

function isPlausiblePortfolioUrl(url = '') {
  try {
    const u = new URL(String(url).startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    if (!host.includes('.')) return false;
    const base = host.split('.')[0] || '';
    const tld = host.split('.').pop() || '';
    const techTlds = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'php', 'py', 'java', 'net', 'edu', 'gov']);
    if (techTlds.has(tld) && !host.includes('github') && !host.includes('linkedin')) return false;
    if (/^(react|node|vue|next|express|mongodb|mysql|graphql|redux|flask|tailwind|material|b\.?sc|b\.?tech|outlook|yahoo|hotmail|gmail)$/i.test(base)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractPortfolioLinks(text = '') {
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi) || [];
  const ignored = ['gmail.com', 'socket.io', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const seen = new Set();

  return matches
    .map((item) => normalizeUrl(item))
    .filter((item) => item && isPlausiblePortfolioUrl(item))
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
  const head = t.slice(0, 900);
  if (/@[a-zA-Z][a-zA-Z0-9._-]*[a-zA-Z0-9]/.test(t)) score += 20;
  if (RX_EMAIL_IN_TEXT.test(head)) score += 12;
  if (
    /\+?\d[\d\s().-]{6,}\d/.test(t) ||
    /\b\d(?:[\s-]?\d){7,}\b/.test(t.replace(/\s+/g, ' '))
  ) {
    score += 15;
  }
  if (RX_PHONE_LOOSE.test(head)) score += 10;
  if (RX_EMAIL_IN_TEXT.test(head) && RX_PHONE_LOOSE.test(head)) score += 15;
  const emailIdx = head.search(RX_EMAIL_IN_TEXT);
  if (emailIdx > 20 && emailIdx < 500) {
    const beforeEmail = head.slice(0, emailIdx);
    if (/[A-Z][A-Z\s.'-]{3,}\s*(?:Computer|Software|Engineer)/i.test(beforeEmail)) score += 20;
    if (/\b[A-Z]{2,}(?:\s+[A-Z]{2,}){1,4}\b/.test(beforeEmail)) score += 10;
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

function extractWorkRolesFromText(text = '', experienceRaw = '') {
  const blob = [experienceRaw, extractPrimaryResumeBlock(text)].filter(Boolean).join('\n');
  const matches = [
    ...blob.matchAll(
      /(?:^|[\n•·])\s*([A-Za-z][A-Za-z0-9\s/.-]{2,55}?)\s+at\s+([A-Za-z0-9][A-Za-z0-9\s&.'()-]{2,70}?)(?=\s*\n|\s+\d+\s*years?|\s*[•·]|\s+Worked|\s+•)/gi
    ),
  ];
  const entries = [];
  const seen = new Set();
  for (const m of matches) {
    const title = String(m[1] || '')
      .trim()
      .replace(/\s+\d+\s*years?.*$/i, '');
    const company = String(m[2] || '')
      .trim()
      .replace(/\s+\d+\s*years?.*$/i, '');
    if (!title || !company || title.length < 3 || company.length < 2) continue;
    if (/^(work|experience|summary|education|skills)$/i.test(title)) continue;
    const key = `${title}|${company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      title,
      company,
      location: null,
      startDate: null,
      endDate: null,
      durationText: null,
      responsibilities: [],
    });
  }
  const current = entries[0];
  return {
    workExperienceEntries: entries.slice(0, 8),
    currentCompany: current?.company || '',
    designation: current?.title || '',
    currentDesignation: current?.title || '',
  };
}

function extractRegexFallbackData(cleanedText = '', fileName = '') {
  const text = preprocessResumeTextForParsing(cleanedText);
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

  const workParsed = extractWorkRolesFromText(text, experienceRaw);

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email,
    phone,
    currentCompany: workParsed.currentCompany,
    designation: workParsed.designation,
    currentDesignation: workParsed.currentDesignation,
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
    workExperienceEntries: workParsed.workExperienceEntries,
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
    if (k === 'firstName' || k === 'lastName') continue;
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

  const fbFull = [fallback.firstName, fallback.lastName].filter(Boolean).join(' ').trim();
  const aiFull = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
  const fbOk = looksLikePersonName(fbFull);
  const aiOk = looksLikePersonName(aiFull);
  if (aiOk || !fbOk) {
    if (isPresentVal(a.firstName)) out.firstName = String(a.firstName).trim();
    if (isPresentVal(a.lastName)) out.lastName = String(a.lastName).trim();
  } else {
    out.firstName = String(fallback.firstName || '').trim();
    out.lastName = String(fallback.lastName || '').trim();
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
  const prompt = `Extract structured candidate data from the resume text below for a recruitment ATS import.

Rules:
- CV may be any language. Extract all supported fields wherever they appear (headers, sidebars, tables).
- Extract every email into rawEmailsFound and every phone into rawPhonesFound.
- Never invent data: use null for missing scalar fields. Omit empty extraFields keys.
- Return ONLY one valid JSON object. No markdown or commentary.
- All score.* values: integers 0-100 (never decimals like 0.85).

${buildCvExtractionPromptInstructions()}

INSTRUCTIONS FOR educationEntries:
- Use qualification (degree title) and instituteName (school/college). Also set degree/institution to the same values when present.
- startYear/endYear: copy date text from CV exactly (Month Year, year only, etc.).

INSTRUCTIONS FOR workExperienceEntries:
- title, company, location, startDate, endDate, durationText, responsibilities[].
- Dates: copy as written; use "Present"/"Current" when ongoing.

INSTRUCTIONS FOR portfolioLinks / website:
- Every http(s) URL and classified type (Portfolio, LinkedIn, GitHub, WorkProject, etc.).
- website: primary personal or company site; portfolioUrl: best portfolio link.

INSTRUCTIONS FOR extraFields:
- Only keys with real CV data (awards, projects, softSkills, hackathons, etc.). No null placeholders.

JSON schema:
${buildCvExtractionJsonSchemaBlock()}

Resume file name: ${file?.originalname || 'resume'}

Resume text:
${capped}
`;

  const t0 = Date.now();
  try {
    const completion = await chatCompletionWithFallback(
      {
        model: env.OPENAI_CHAT_MODEL,
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
    const modelName = String(completion?.model || '').toLowerCase();
    const usedMistral =
      modelName.includes('mistral') ||
      (!modelName.includes('gpt') && !modelName.includes('o1') && !modelName.includes('o3'));
    const tokenUsage = extractCompletionTokenUsage(completion, usedMistral);
    const content = completion.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(content);
    logNarrative([
      `Billable tokens (${tokenUsage.provider}) — input: ${tokenUsage.inputTokens}, output: ${tokenUsage.outputTokens}, total: ${tokenUsage.totalTokens}`,
      `API key used: OpenAI API key (${env.OPENAI_CHAT_MODEL})`,
    ]);
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
        ...tokenUsage,
      },
    };
  } catch (llmErr) {
    const ms = Date.now() - t0;
    const mistralAttempted = Boolean(llmErr?.mistralError);
    logNarrative([
      '',
      `AI call failed: ${llmErr?.message || llmErr}`,
      mistralAttempted
        ? 'Parse chain: OpenAI (failed) → Mistral (failed) → System regex fallback ✓'
        : `Parse chain: OpenAI ${env.OPENAI_CHAT_MODEL} (failed) → System regex fallback ✓`,
      'Billable tokens: N/A (system regex only — not counted)',
    ]);
    return {
      parsed: null,
      meta: {
        skipped: true,
        ms,
        model: null,
        usedMistral: mistralAttempted,
        validJson: false,
        circuitWasOpen: circuitBefore.circuitOpen,
        charsSent: cleanedText.length,
        reason: 'ai_error',
        errorMessage: String(llmErr?.message || llmErr),
        provider: 'system',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    };
  }
}

/** @param {unknown} completion */
function extractCompletionTokenUsage(completion, usedMistral) {
  const usage = completion?.usage;
  const inputTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0) || 0;
  const outputTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0) || 0;
  const totalTokens =
    Number(usage?.total_tokens ?? 0) || inputTokens + outputTokens;
  const provider = usedMistral ? 'mistral' : 'openai';
  return {
    provider,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

/** Remove client-only parse metadata before persisting a candidate. */
export function stripCvParseMeta(payload) {
  if (!payload || typeof payload !== 'object') {
    return { cleaned: payload, cvParseMeta: null };
  }
  const { cvParseMeta, ...cleaned } = payload;
  return { cleaned, cvParseMeta: cvParseMeta ?? null };
}

/**
 * Resolve which API path ran and whether Mistral/OpenAI usage is billable.
 * Order: OpenAI → Mistral → System (Stage 4 regex). Tokens only when an LLM succeeds.
 */
function buildCvParseApiSummary(aiMeta = {}) {
  const skipped = Boolean(aiMeta.skipped);
  const validJson = Boolean(aiMeta.validJson);
  const usedMistral = Boolean(aiMeta.usedMistral);
  const circuitWasOpen = Boolean(aiMeta.circuitWasOpen);
  const reason = aiMeta.reason;
  const chatModel = env.OPENAI_CHAT_MODEL;

  let provider = 'system';
  let apiUsedLabel = 'System (regex fallback)';
  let parseChain = 'System regex ✓';
  let billable = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  if (reason === 'no_llm' || !hasLlmProvider()) {
    provider = 'none';
    apiUsedLabel = 'System (regex only — no API keys)';
    parseChain = 'No OpenAI/Mistral keys — System regex ✓';
  } else if (!skipped && validJson && usedMistral) {
    provider = 'mistral';
    apiUsedLabel = 'Mistral API key';
    billable = true;
    inputTokens = Number(aiMeta.inputTokens) || 0;
    outputTokens = Number(aiMeta.outputTokens) || 0;
    totalTokens = Number(aiMeta.totalTokens) || 0;
    parseChain = circuitWasOpen
      ? 'OpenAI (circuit open, skipped) → Mistral ✓'
      : 'OpenAI (failed) → Mistral ✓';
  } else if (!skipped && validJson && !usedMistral) {
    provider = 'openai';
    apiUsedLabel = `OpenAI API key (${chatModel})`;
    billable = true;
    inputTokens = Number(aiMeta.inputTokens) || 0;
    outputTokens = Number(aiMeta.outputTokens) || 0;
    totalTokens = Number(aiMeta.totalTokens) || 0;
    parseChain = `OpenAI ${chatModel} ✓`;
  } else if (skipped && reason === 'ai_error') {
    provider = 'system';
    apiUsedLabel = 'System (regex fallback)';
    parseChain = usedMistral
      ? 'OpenAI (failed) → Mistral (failed) → System regex ✓'
      : `OpenAI ${chatModel} (failed) → System regex ✓`;
    if (aiMeta.errorMessage) {
      parseChain += ` — ${String(aiMeta.errorMessage).slice(0, 120)}`;
    }
  } else if (skipped) {
    provider = 'system';
    apiUsedLabel = 'System (regex fallback)';
    parseChain = 'System regex ✓ (AI skipped)';
  }

  return {
    provider,
    apiUsedLabel,
    parseChain,
    billable,
    inputTokens,
    outputTokens,
    totalTokens,
    model: aiMeta.model && aiMeta.model !== 'n/a' ? String(aiMeta.model) : null,
  };
}

function buildCvParseMeta(aiMeta = {}) {
  if (!aiMeta || typeof aiMeta !== 'object') return null;
  const summary = buildCvParseApiSummary(aiMeta);
  const skipped = Boolean(aiMeta.skipped);
  return {
    provider: summary.provider,
    apiUsedLabel: summary.apiUsedLabel,
    parseChain: summary.parseChain,
    billable: summary.billable,
    model: summary.model,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    totalTokens: summary.totalTokens,
    durationMs: Number(aiMeta.ms) || 0,
    skipped,
    charsSent: Number(aiMeta.charsSent) || 0,
    aiFailed: aiMeta.reason === 'ai_error' || summary.provider === 'system',
    errorMessage: aiMeta.errorMessage ? String(aiMeta.errorMessage) : undefined,
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

  const core = {
    firstName: String(base.firstName || fallback.firstName || '').trim(),
    lastName: String(base.lastName || fallback.lastName || '').trim(),
    email: normalizeEmail(base.email || fallback.email || ''),
    phone: String(base.phone || fallback.phone || '').trim(),
    currentCompany: String(base.currentCompany || base.currentEmployer || fallback.currentCompany || '').trim(),
    designation: String(base.designation || base.currentDesignation || fallback.designation || '').trim(),
    currentDesignation: String(
      base.currentDesignation || base.designation || fallback.currentDesignation || ''
    ).trim(),
    experience: parsePositiveNumber(base.experience ?? base.totalExperience),
    location: buildLocation(base.location, base.city, base.country) || buildLocation(fallback.location, fallback.city, fallback.country),
    city: String(base.city || fallback.city || '').trim(),
    state: String(base.state || '').trim(),
    country: String(base.country || fallback.country || '').trim(),
    currentAddress: String(base.currentAddress || '').trim(),
    zip: String(base.zip || '').trim(),
    age: parsePositiveNumber(base.age),
    candidateScore: parsePositiveNumber(base.candidateScore),
    nationality: String(base.nationality || '').trim(),
    currentCompanyWebsite: normalizeUrl(base.currentCompanyWebsite || ''),
    maritalStatus: String(base.maritalStatus || '').trim(),
    birthDate: String(base.birthDate || '').trim(),
    passportNumber: String(base.passportNumber || '').trim(),
    remarks: String(base.remarks || '').trim(),
    linkedinUrl: normalizeUrl(base.linkedinUrl || fallback.linkedinUrl || ''),
    twitterUrl: normalizeUrl(base.twitterUrl || ''),
    xingUrl: normalizeUrl(base.xingUrl || ''),
    skypeId: String(base.skypeId || '').trim(),
    facebookUrl: normalizeUrl(base.facebookUrl || ''),
    stackOverflowUrl: normalizeUrl(base.stackOverflowUrl || ''),
    githubUrl: normalizeUrl(base.githubUrl || fallback.githubUrl || ''),
    website: normalizeUrl(base.website || base.portfolioUrl || ''),
    portfolioUrl: normalizeUrl(base.portfolioUrl || fallback.portfolioUrl || ''),
    workHistory: String(base.workHistory || '').trim(),
    honoursAndAwards: Array.isArray(base.honoursAndAwards) ? base.honoursAndAwards.filter(Boolean) : [],
    languageProficiency: Array.isArray(base.languageProficiency) ? base.languageProficiency : [],
    courses: Array.isArray(base.courses) ? base.courses.filter(Boolean) : [],
    extracurricularActivities: Array.isArray(base.extracurricularActivities)
      ? base.extracurricularActivities.filter(Boolean)
      : [],
    volunteers: Array.isArray(base.volunteers) ? base.volunteers.filter(Boolean) : [],
    currentBenefits: String(base.currentBenefits || '').trim(),
    expectedBenefits: String(base.expectedBenefits || '').trim(),
    currentSalaryCurrency: String(base.currentSalaryCurrency || '').trim(),
    expectedSalaryCurrency: String(base.expectedSalaryCurrency || '').trim(),
    noticePeriodInDays: parsePositiveNumber(base.noticePeriodInDays),
    source: sourceOk ? String(base.source).trim() : 'Other',
    priority: priorityOk ? String(base.priority).trim() : 'Medium',
    tags: Array.isArray(base.tags) ? base.tags.filter(Boolean).slice(0, 10) : [],
    skills: skillsArr,
    expectedSalary: parsePositiveNumber(base.expectedSalary),
    currentSalary: parsePositiveNumber(base.currentSalary),
    currency: String(base.currency ?? base.expectedSalaryCurrency ?? base.currentSalaryCurrency ?? '').trim(),
    education: String(base.education || fallback.education || '').trim(),
    languages: Array.isArray(base.languages) ? base.languages.filter(Boolean).slice(0, 15) : [],
    certifications: Array.isArray(base.certifications) ? base.certifications.filter(Boolean).slice(0, 15) : [],
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
    extraFields:
      base.extraFields && typeof base.extraFields === 'object' && !Array.isArray(base.extraFields)
        ? base.extraFields
        : {},
    rawEmailsFound: Array.isArray(base.rawEmailsFound) ? base.rawEmailsFound : [],
    rawPhonesFound: Array.isArray(base.rawPhonesFound) ? base.rawPhonesFound : [],
  };

  return applyPipelineFieldsToNormalized(core, fallback, extras, extras.cleanedText || '');
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
    /**
     * Pass 1 first (pdf-parse only). Then run in parallel:
     * - Branch A: Pass 2 → Pass 3 (pdf.js, serialized via runWithIsolatedPdfJsWorker) → profile photo (pdf.js).
     * - Branch B: Pass 4 OCR (pdf-parse + Tesseract, separate code path).
     * Same four text passes + same photo extraction as before; wall time ≈ t1 + max(t2+t3+tPhoto, t4).
     */
    const settled1 = await settlePass(() => pdfPass1Default(buffer));
    const [pass23Photo, settled4] = await Promise.all([
      (async () => {
        const s2 = await settlePass(() => pdfPass2RawItemDump(buffer));
        const s3 = await settlePass(() => pdfPass3PositionSorted(buffer));
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
          extractedProfilePhoto = null;
          logNarrative(['', `Embedded profile image: ❌ failed — ${photoErr?.message || photoErr}`]);
        }
        return { s2, s3 };
      })(),
      settlePass(() => pdfPass4OcrTesseract(file.path)),
    ]);
    const settled = [settled1, pass23Photo.s2, pass23Photo.s3, settled4];
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
  const cleaned = preprocessResumeTextForParsing(dupStats.text);

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

  logStageBanner(5, 'AI Structured Extraction (ATS field pipeline)');
  logNarrative([
    'Pipeline sections:',
    `  Personal: ${CV_PIPELINE_SECTIONS.personal.join(', ')}`,
    `  Education: ${CV_PIPELINE_SECTIONS.education.join(', ')}`,
    `  Professional: ${CV_PIPELINE_SECTIONS.professional.join(', ')}`,
    `  Social: ${CV_PIPELINE_SECTIONS.social.join(', ')}`,
    `  Summary: ${CV_PIPELINE_SECTIONS.summary.join(', ')}`,
    '',
  ]);
  const circuitSnap = getCvLlmCircuitSnapshot();
  logNarrative([
    'Circuit breaker check:',
    `  OpenAI last failed at: ${
      circuitSnap.lastFailureIso
        ? `${circuitSnap.lastFailureIso} (within 10 min window)`
        : 'never'
    }`,
    `  Circuit: ${circuitSnap.circuitOpen ? 'OPEN → OpenAI quota cooldown (Mistral fallback when configured)' : 'CLOSED → OpenAI gpt-4.1'}`,
    ...(circuitSnap.circuitOpen
      ? [`  Log: "OpenAI quota cooldown — Mistral fallback when MISTRAL_API_KEY is set"`]
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
    const mistralAttempted = Boolean(aiSettled.reason?.mistralError);
    aiMeta = {
      ...aiMeta,
      skipped: true,
      reason: 'ai_error',
      usedMistral: mistralAttempted,
      errorMessage: String(aiSettled.reason?.message || aiSettled.reason),
      provider: 'system',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    logNarrative([
      '',
      `AI extraction threw: ${aiSettled.reason?.message || aiSettled.reason}`,
      mistralAttempted
        ? 'Parse chain: OpenAI (failed) → Mistral (failed) → System regex fallback ✓'
        : `Parse chain: OpenAI ${env.OPENAI_CHAT_MODEL} (failed) → System regex fallback ✓`,
      'Billable tokens: N/A (system regex only)',
    ]);
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

  const apiSummary = buildCvParseApiSummary(aiMeta);

  logNarrative([
    '',
    `AI processing time: ~${aiMeta.ms}ms`,
    `Parse chain:    ${apiSummary.parseChain}`,
    `API key used:   ${apiSummary.apiUsedLabel}`,
    ...(apiSummary.billable
      ? [
          `Billable tokens — input: ${apiSummary.inputTokens}, output: ${apiSummary.outputTokens}, total: ${apiSummary.totalTokens} (${apiSummary.provider})`,
        ]
      : ['Billable tokens: N/A (system regex fallback — not counted)']),
    '',
    aiMeta.validJson && aiParsed
      ? 'AI returned valid JSON ✅'
      : 'AI returned valid JSON ❌ (using Stage 4 regex fallback where needed)',
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

  const mergedFlat = enrichParsedFromNarrative(mergeAiWithFallback(aiParsed, fallbackData), cleaned);
  const portfolioLinks = extractPortfolioLinks(cleaned);
  if (!mergedFlat.portfolioLinks?.length) mergedFlat.portfolioLinks = portfolioLinks;

  const extrasBase = {
    resumeFileName: displayName,
    resumeUrl,
    profilePhotoUrl,
    cleanedText: cleaned,
  };
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
  const eduSrc = normalizedData.educationEntries?.length
    ? aiParsed?.educationEntries?.length
      ? 'AI'
      : 'enriched'
    : 'fallback';
  const expSrc = normalizedData.workExperienceEntries?.length
    ? aiParsed?.workExperienceEntries?.length
      ? 'AI'
      : 'enriched'
    : 'fallback';

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

  const pipelineCoverage = countPipelineFieldCoverage(normalizedData);
  logNarrative([
    '',
    `Pipeline field coverage: ${pipelineCoverage.count}/${pipelineCoverage.total} core groups`,
    pipelineCoverage.filled.length
      ? `  Captured: ${pipelineCoverage.filled.join(', ')}`
      : '  Captured: (minimal — mostly regex fallback)',
  ]);

  logNarrative(['', 'Section-wise extraction (all ATS fields):']);
  logPipelineSectionsExtraction(normalizedData);

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
  const finalApiSummary = buildCvParseApiSummary(aiMeta);
  logStage8FinalResponse(normalizedData, {
    totalMs,
    apiSummary: finalApiSummary,
  });

  const cvParseMeta = buildCvParseMeta(aiMeta);
  return cvParseMeta ? { ...normalizedData, cvParseMeta } : normalizedData;
}

export async function processCandidateCv(file, { candidateId } = {}) {
  const stage4 = await runCvPipelineThroughStage4(file);
  const tenantDbName = String(getActiveTenantDbName() || 'default').trim() || 'default';
  return finalizeCvPipelineFromStage5(file, candidateId, stage4, null, tenantDbName);
}
