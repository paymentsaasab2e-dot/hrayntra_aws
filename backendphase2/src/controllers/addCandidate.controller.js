import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma, getActiveTenantDbName } from '../config/prisma.js';
import { env } from '../config/env.js';
import { uploadBufferToCloudinary, uploadContentTypeForFile } from '../utils/s3.js';
import {
  processCandidateCv,
  validateCvUploadFile,
  runCvPipelineThroughStage4,
  finalizeCvPipelineFromStage5,
  stripCvParseMeta,
} from '../services/cvParsing.service.js';
import { chatCompletionWithFallback, hasLlmProvider } from '../services/llmChatFallback.service.js';
import {
  findExistingCandidateDuplicate,
  nextCopyLastNameForBulk,
  normalizeCandidateEmailForDuplicate,
  notDeletedClause,
} from '../services/bulkCvDuplicate.service.js';
import { hardDeleteCandidateById } from '../services/bulkCvHardDelete.service.js';
import { waitBulkCvDuplicateDecision } from '../socket/bulkCvDuplicateWait.registry.js';
import { emitBulkCvDuplicateFound, getBulkCvIo } from '../socket/bulkCvSocket.js';
import { expandBulkCvZipArchive } from '../services/bulkCvZip.service.js';
import {
  getBulkCvStoredFile,
  registerBulkCvZipSession,
  releaseBulkCvZipSession,
  removeBulkCvStoredFile,
} from '../services/bulkCvZipStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANDIDATE_ENTITY = 'CANDIDATE';
const TAG_ACTIVITY_KIND = 'candidate-tag';
const NOTE_ACTIVITY_KIND = 'candidate-note';
const CREATED_ACTIVITY_KIND = 'candidate-created';
const DEFAULT_TAGS = [
  'React',
  'Node.js',
  'TypeScript',
  'JavaScript',
  'Urgent',
  'Referral',
  'Remote',
  'Frontend',
  'Backend',
  'Design',
];
const STAGE_ORDER = ['Applied', 'Screening', 'Shortlist', 'Interview', 'Offer', 'Hired'];
function normalizeEmail(email = '') {
  return normalizeCandidateEmailForDuplicate(email);
}

/** Non-empty normalized email, or null (never store empty string on Candidate). */
function normalizeCandidateEmail(value) {
  const normalized = normalizeCandidateEmailForDuplicate(value);
  return normalized || null;
}

/**
 * Bulk CV "create anyway": reuse the single LLM parse from this request and only change
 * identity fields. A second finalize/LLM run for the same file produced different
 * designation, experience, and location because models are not fully deterministic.
 */
function applyBulkCreateAnywayIdentityPatch(normalized, patch) {
  if (!normalized || typeof normalized !== 'object') return normalized;
  const out =
    typeof structuredClone === 'function'
      ? structuredClone(normalized)
      : JSON.parse(JSON.stringify(normalized));
  if (!patch || typeof patch !== 'object') return out;
  if (patch.firstName != null && String(patch.firstName).trim()) out.firstName = String(patch.firstName).trim();
  if (patch.lastName != null && String(patch.lastName).trim()) out.lastName = String(patch.lastName).trim();
  if (patch.email != null && String(patch.email).trim()) out.email = String(patch.email).trim();
  return out;
}

function normalizePhone(phone = '') {
  return String(phone).trim();
}

function normalizeTagId(value = '') {
  return `tag-${String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

function getTagColor(label = '') {
  const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];
  const seed = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function titleCase(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStageLabel(stage = '') {
  const normalized = String(stage).trim().toLowerCase();
  const stageMap = {
    applied: 'Applied',
    screening: 'Screening',
    shortlist: 'Shortlist',
    interview: 'Interview',
    offer: 'Offer',
    hired: 'Hired',
  };
  return stageMap[normalized] || titleCase(stage) || 'Applied';
}

function parsePositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.]+/g, ' ')
    .trim();

  const numericMatch = normalizedValue.match(/\d+(?:\.\d+)?/);
  const parsed = numericMatch ? Number(numericMatch[0]) : Number(value);
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

function buildLocation(location = '', city = '', country = '') {
  const trimmedLocation = String(location || '').trim();
  if (trimmedLocation) return trimmedLocation;

  return [city, country]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

function mapAvailabilityStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'not available') return 'not_available';
  if (normalized === 'interviewing elsewhere') return 'interviewing_elsewhere';
  return 'available';
}

function createCandidateName(firstName, lastName) {
  return `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
}

function buildExistingCandidateSummary(candidate) {
  return {
    _id: candidate.id,
    name: createCandidateName(candidate.firstName, candidate.lastName),
    email: candidate.email,
    stage: candidate.stage || 'Applied',
    currentTitle: candidate.currentTitle || null,
    currentCompany: candidate.currentCompany || null,
  };
}

function sanitizeRemoteAvatarUrl(value) {
  const s = String(value ?? '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return null;
  return s;
}

function validateCreateCandidatePayload(body) {
  const requiredFields = [
    ['firstName', 'First name is required'],
    ['lastName', 'Last name is required'],
    ['experience', 'Experience is required'],
    ['source', 'Source is required'],
  ];

  for (const [field, message] of requiredFields) {
    if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
      return { field, message };
    }
  }

  return null;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsvContent(content) {
  const lines = String(content)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });
    return row;
  });
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
  if (/\b(?:resume|curriculum vitae|cv|profile|summary|skills|experience|education|projects|contact)\b/i.test(cleaned)) {
    return false;
  }

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

function extractResumeName(fullText = '', fileName = '') {
  const lines = String(fullText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const topCandidates = lines.slice(0, 10).filter(looksLikePersonName);
  if (topCandidates.length) {
    return splitNameCandidate(topCandidates[0]);
  }

  const fileCandidate = splitNameCandidate(path.parse(String(fileName || '')).name || '');
  if (fileCandidate.firstName || fileCandidate.lastName) {
    return fileCandidate;
  }

  const emailMatch = String(fullText).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
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

function buildMockResumeData(filePath) {
  return {
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah@example.com',
    phone: '+91 98765 43210',
    currentCompany: 'Adobe Systems',
    designation: 'Senior Product Designer',
    experience: 8,
    location: 'Bangalore, India',
    linkedinUrl: 'linkedin.com/in/sarahjenkins',
    skills: ['Figma', 'Adobe XD', 'Prototyping', 'User Research'],
    expectedSalary: 1800000,
    currency: 'INR',
    portfolioUrl: 'sarahjenkins.design',
    parsedAt: new Date().toISOString(),
    isMockData: true,
    tempFilePath: filePath,
  };
}

function cleanResumeText(rawText = '') {
  return String(rawText || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractResumeTextFromFile(file) {
  if (!file?.path) {
    return '';
  }

  const extension = path.extname(file.originalname || file.filename || '').toLowerCase();

  if (file.mimetype === 'application/pdf' || extension === '.pdf') {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    return cleanResumeText(pdfData?.text || '');
  }

  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ path: file.path });
    return cleanResumeText(result?.value || '');
  }

  if (file.mimetype === 'text/plain' || extension === '.txt') {
    return cleanResumeText(fs.readFileSync(file.path, 'utf8'));
  }

  const buffer = fs.readFileSync(file.path);
  return cleanResumeText(buffer.toString('utf8'));
}

function extractFallbackResumeData(text = '', filePath = '') {
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  const linkedInMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  const portfolioMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:vercel\.app|netlify\.app|net|com)(?:\/[^\s]*)?/i);
  const extractedName = extractResumeName(text);
  const topLocation = lines.find((line, index) => index > 0 && index < 5 && /,/.test(line) && !/@/.test(line)) || '';
  const summaryIndex = lines.findIndex((line) => /^summary$/i.test(line));
  const summary =
    summaryIndex >= 0
      ? lines
          .slice(summaryIndex + 1, summaryIndex + 4)
          .filter((line) => !/^(experience|skills|projects|education|certifications)$/i.test(line))
          .join(' ')
      : '';
  const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
  const currentDesignation = experienceIndex >= 0 ? lines[experienceIndex + 1] || '' : '';
  const currentCompany = experienceIndex >= 0 ? lines[experienceIndex + 2] || '' : '';
  const location = experienceIndex >= 0 ? lines[experienceIndex + 4] || topLocation : topLocation;
  const skills = Array.from(
    new Set(
      (
        text.match(
          /\b(?:React|Node\.js|Node|JavaScript|TypeScript|Figma|Python|Java|AWS|SQL|Next\.js|MongoDB|PostgreSQL)\b/gi
        ) || []
      )
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

  return {
    firstName: extractedName.firstName,
    lastName: extractedName.lastName,
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    linkedinUrl: normalizeUrl(linkedInMatch?.[0] || ''),
    currentCompany,
    designation: currentDesignation,
    currentDesignation,
    experience: '',
    location,
    skills,
    education: '',
    languages: [],
    certifications: [],
    summary,
    city: '',
    country: '',
    portfolioUrl: normalizeUrl(portfolioMatch?.[0] || ''),
    parsedAt: new Date().toISOString(),
    isMockData: false,
    tempFilePath: filePath,
  };
}

async function extractStructuredResumeDataWithOpenAI(cleanedText, file) {
  if (!cleanedText || !hasLlmProvider()) {
    return null;
  }

  const prompt = `
Extract candidate data from this resume text and return strict JSON.
Use empty strings, empty arrays, or nulls when data is missing.
Do not invent facts.

JSON shape:
{
  "firstName": string,
  "lastName": string,
  "email": string,
  "phone": string,
  "currentCompany": string,
  "designation": string,
  "currentDesignation": string,
  "experience": number | null,
  "location": string,
  "linkedinUrl": string,
  "source": "LinkedIn" | "Naukri" | "Indeed" | "Referral" | "Company Career Page" | "Agency" | "Other",
  "priority": "High" | "Medium" | "Low" | "",
  "tags": string[],
  "skills": string[],
  "expectedSalary": number | null,
  "currency": string,
  "portfolioUrl": string,
  "education": string,
  "languages": string[],
  "certifications": string[],
  "summary": string,
  "city": string,
  "country": string,
  "currentSalary": number | null,
  "noticePeriod": string,
  "score": {
    "overall": number,
    "breakdown": {
      "skillsMatch": number,
      "experienceFit": number,
      "educationFit": number,
      "keywordMatch": number
    },
    "insights": string[]
  }
}

Resume file name: ${file?.originalname || 'resume'}

For source, use only the listed allowed values. If the CV does not clearly state the source, return "Other".
For priority, infer candidate priority from seniority, relevance, and strength of profile.
For tags, return short recruiter-friendly tags based on skills, seniority, domain, and work mode.

Resume text:
${cleanedText.slice(0, 18000)}
`;

  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a resume parsing engine. Extract only data present in the resume. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    'cv-parse-add-candidate'
  );

  const content = completion.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

function normalizeResumeExtraction(parsed = {}, fallback = {}, filePath = '') {
  const merged = {
    ...fallback,
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
  };

  const score = merged.score && typeof merged.score === 'object' ? merged.score : {};
  const breakdown = score.breakdown && typeof score.breakdown === 'object' ? score.breakdown : {};
  const safeSkills = Array.isArray(merged.skills) ? merged.skills.filter(Boolean).slice(0, 12) : [];
  const safeLanguages = Array.isArray(merged.languages) ? merged.languages.filter(Boolean).slice(0, 10) : [];
  const safeCertifications = Array.isArray(merged.certifications)
    ? merged.certifications.filter(Boolean).slice(0, 10)
    : [];

  return {
    firstName: String(merged.firstName || fallback.firstName || '').trim(),
    lastName: String(merged.lastName || fallback.lastName || '').trim(),
    email: normalizeEmail(merged.email || fallback.email || ''),
    phone: String(merged.phone || fallback.phone || '').trim(),
    currentCompany: String(merged.currentCompany || '').trim(),
    designation: String(merged.designation || '').trim(),
    currentDesignation: String(merged.currentDesignation || merged.designation || '').trim(),
    experience: parsePositiveNumber(merged.experience),
    location: buildLocation(merged.location, merged.city, merged.country),
    linkedinUrl: normalizeUrl(merged.linkedinUrl || fallback.linkedinUrl || ''),
    source: ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Company Career Page', 'Agency', 'Other'].includes(
      String(merged.source || '').trim()
    )
      ? String(merged.source).trim()
      : 'Other',
    priority: ['High', 'Medium', 'Low'].includes(String(merged.priority || '').trim())
      ? String(merged.priority).trim()
      : 'Medium',
    tags: Array.isArray(merged.tags) ? merged.tags.filter(Boolean).slice(0, 10) : safeSkills.slice(0, 6),
    skills: safeSkills,
    expectedSalary: parsePositiveNumber(merged.expectedSalary),
    currentSalary: parsePositiveNumber(merged.currentSalary),
    currency: String(merged.currency || 'INR').trim() || 'INR',
    portfolioUrl: normalizeUrl(merged.portfolioUrl || ''),
    education: String(merged.education || '').trim(),
    languages: safeLanguages,
    certifications: safeCertifications,
    summary: String(merged.summary || '').trim(),
    city: String(merged.city || '').trim(),
    country: String(merged.country || '').trim(),
    noticePeriod: String(merged.noticePeriod || '').trim(),
    score: {
      overall: Math.max(0, Math.min(100, Number(score.overall || 0) || 0)),
      breakdown: {
        skillsMatch: Math.max(0, Math.min(100, Number(breakdown.skillsMatch || 0) || 0)),
        experienceFit: Math.max(0, Math.min(100, Number(breakdown.experienceFit || 0) || 0)),
        educationFit: Math.max(0, Math.min(100, Number(breakdown.educationFit || 0) || 0)),
        keywordMatch: Math.max(0, Math.min(100, Number(breakdown.keywordMatch || 0) || 0)),
      },
      insights: Array.isArray(score.insights) ? score.insights.filter(Boolean).slice(0, 6) : [],
    },
    parsedAt: new Date().toISOString(),
    isMockData: false,
    tempFilePath: filePath,
  };
}

async function logActivity({
  candidateId,
  performedById,
  action,
  description,
  category = 'Candidates',
  relatedJob = null,
  metadata = {},
}) {
  return prisma.activity.create({
    data: {
      action,
      description,
      performedById,
      entityType: CANDIDATE_ENTITY,
      entityId: candidateId,
      category,
      relatedType: relatedJob ? 'job' : 'candidate',
      relatedLabel: relatedJob?.title || null,
      relatedId: relatedJob?.id || null,
      metadata,
    },
  });
}

async function ensurePipelineStage(jobId, requestedStage) {
  const stageName = getStageLabel(requestedStage);
  const existingStages = await prisma.pipelineStage.findMany({
    where: { jobId },
    orderBy: { order: 'asc' },
  });

  const matched = existingStages.find(
    (stage) => stage.name.toLowerCase() === stageName.toLowerCase()
  );

  if (matched) return matched;

  const orderIndex = STAGE_ORDER.findIndex(
    (label) => label.toLowerCase() === stageName.toLowerCase()
  );

  return prisma.pipelineStage.create({
    data: {
      jobId,
      name: stageName,
      order: orderIndex === -1 ? existingStages.length + 1 : orderIndex + 1,
      color: '#2563eb',
    },
  });
}

async function collectTagSuggestions() {
  const activities = await prisma.activity.findMany({
    where: {
      entityType: CANDIDATE_ENTITY,
    },
    select: {
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const usage = new Map();
  DEFAULT_TAGS.forEach((tag) => usage.set(tag, 1));

  activities.forEach((activity) => {
    const metadata = activity.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
    if (metadata.kind !== TAG_ACTIVITY_KIND) return;
    const label = String(metadata?.tag?.label || '').trim();
    if (!label) return;
    usage.set(label, (usage.get(label) || 0) + 1);
  });

  return Array.from(usage.entries())
    .map(([name, usageCount]) => ({
      id: normalizeTagId(name),
      name,
      label: name,
      usageCount,
      color: getTagColor(name),
    }))
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    .slice(0, 100);
}

export const addCandidateController = {
  async createCandidate(req, res) {
    try {
      const validationError = validateCreateCandidatePayload(req.body || {});
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError.message,
          field: validationError.field,
        });
      }

      const email = normalizeCandidateEmail(req.body.email);
      const isBulkCvPoolCreate =
        !req.body.jobId &&
        String(req.body.source || '')
          .trim()
          .toLowerCase() === 'bulk cv upload';
      // Only check email duplicates when a real email is present — `where: { email: null }`
      // would otherwise match unrelated profiles with no email.
      let existing = null;
      if (email) {
        const dup = await findExistingCandidateDuplicate({ email });
        existing = dup?.candidate ?? null;
      }

      const recruiterId = isBulkCvPoolCreate ? null : req.body.recruiterId || req.user.id;
      const creatorId = req.user.id;
      const stageLabel = isBulkCvPoolCreate
        ? null
        : req.body.jobId
          ? getStageLabel(req.body.stage || 'Applied')
          : req.body.stage
            ? getStageLabel(req.body.stage)
            : null;
      const expectedSalary = parsePositiveNumber(req.body.expectedSalary);
      const currentSalary = parsePositiveNumber(req.body.currentSalary);
      const duplicateActionRaw = String(req.body.duplicateAction || 'create');
      const duplicateAction =
        duplicateActionRaw === 'createAnyway' ? 'create_anyway' : duplicateActionRaw;
      const candidateData = {
        firstName: String(req.body.firstName).trim(),
        lastName: String(req.body.lastName).trim(),
        email,
        phone: req.body.phone ? normalizePhone(req.body.phone) : null,
        avatar: sanitizeRemoteAvatarUrl(req.body.avatar ?? req.body.profilePhotoUrl),
        linkedIn: req.body.linkedinUrl ? String(req.body.linkedinUrl).trim() : null,
        skills: Array.isArray(req.body.skills) ? req.body.skills.filter(Boolean).slice(0, 10) : [],
        experience: Number(req.body.experience),
        currentTitle: req.body.currentDesignation || req.body.designation || null,
        designation: req.body.currentDesignation || req.body.designation || null,
        currentCompany: req.body.currentCompany || null,
        location: req.body.location || null,
        status: req.body.jobId ? 'ACTIVE' : 'NEW',
        source: req.body.source || null,
        availability: mapAvailabilityStatus(req.body.availabilityStatus),
        noticePeriod: req.body.noticePeriod || null,
        stage: stageLabel,
        assignedJobs: req.body.jobId ? [req.body.jobId] : [],
        lastActivity: new Date(),
        city: req.body.city || null,
        country: req.body.country || null,
        address: req.body.address || null,
        salary:
          expectedSalary !== null
            ? {
                min: null,
                max: expectedSalary,
                currency: req.body.currency || 'INR',
              }
            : req.body.currency
              ? {
                  min: null,
                  max: null,
                  currency: req.body.currency,
                }
              : undefined,
        expectedSalary,
        currentSalary,
        education: req.body.education || null,
        certifications: Array.isArray(req.body.certifications) ? req.body.certifications.filter(Boolean) : [],
        languages: Array.isArray(req.body.languages) ? req.body.languages.filter(Boolean) : [],
        portfolio: req.body.portfolioUrl || req.body.portfolio || null,
        website: req.body.website || null,
        notes: req.body.notes || null,
        cvSummary: req.body.cvSummary || null,
        cvEducationEntries: Array.isArray(req.body.cvEducationEntries) ? req.body.cvEducationEntries : undefined,
        cvWorkExperienceEntries: Array.isArray(req.body.cvWorkExperienceEntries)
          ? req.body.cvWorkExperienceEntries
          : undefined,
        cvPortfolioLinks: Array.isArray(req.body.cvPortfolioLinks) ? req.body.cvPortfolioLinks : undefined,
        extraData:
          req.body.extraData && typeof req.body.extraData === 'object' && !Array.isArray(req.body.extraData)
            ? req.body.extraData
            : undefined,
        preferredLocation: req.body.preferredLocation || null,
        // Only touch `resume` when the client sent the key. `resume: null` from
        // `undefined || null` was wiping stored resumes on update and forcing
        // null on create before the follow-up multipart upload (manual entry).
        ...(req.body.resume !== undefined ? { resume: req.body.resume || null } : {}),
        assignedTo: recruiterId
          ? {
              connect: { id: recruiterId },
            }
          : undefined,
        createdBy: creatorId
          ? {
              connect: { id: creatorId },
            }
          : undefined,
      };

      if (existing && duplicateAction === 'updateExisting') {
        const updatedCandidate = await prisma.candidate.update({
          where: { id: existing.id },
          data: {
            ...candidateData,
            createdBy: undefined,
          },
        });

        return res.status(200).json({
          success: true,
          message: 'Existing candidate updated successfully',
          data: updatedCandidate,
        });
      }

      if (existing && duplicateAction === 'create_anyway') {
        const fnForCopy = String(candidateData.firstName || '').trim();
        const lnForCopy = String(candidateData.lastName || '').trim();
        candidateData.lastName = await nextCopyLastNameForBulk({
          firstName: fnForCopy,
          lastName: lnForCopy,
          email,
        });
        // Keep the extracted email — do not add +bulkcv or other mailbox variants.
        existing = null;
      }

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Candidate already exists',
          isDuplicate: true,
          data: {
            existingCandidate: buildExistingCandidateSummary(existing),
            canUpdate: true,
            canCreateAnyway: isBulkCvPoolCreate,
          },
        });
      }

      const candidate = await prisma.candidate.create({
        data: candidateData,
      });

      // When the create payload already carries a parsed resume URL (e.g. parsed
      // & uploaded to Cloudinary during /candidates/parse-resume), mirror it
      // into CandidateFile so the drawer's Files tab shows it without needing
      // a follow-up upload call.
      const seededResume = candidate.resume || candidate.resumeUrl;
      if (seededResume && /^https?:\/\//i.test(String(seededResume))) {
        try {
          await prisma.candidateFile.create({
            data: {
              candidateId: candidate.id,
              fileName: 'Resume',
              fileUrl: seededResume,
              fileType: 'Resume',
              uploadedById: creatorId || recruiterId,
            },
          });
        } catch (fileError) {
          console.error('Failed to seed candidate file from create payload:', fileError?.message || fileError);
        }
      }

      let relatedJob = null;
      if (req.body.jobId) {
        const job = await prisma.job.findUnique({
          where: { id: req.body.jobId },
          select: { id: true, title: true },
        });

        if (job) {
          const stage = await ensurePipelineStage(job.id, stageLabel);
          await prisma.pipelineEntry.create({
            data: {
              candidateId: candidate.id,
              jobId: job.id,
              stageId: stage.id,
              movedById: recruiterId,
              movedAt: new Date(),
              notes: req.body.initialNote || null,
            },
          });
          relatedJob = job;
        }
      }

      const tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean).slice(0, 10) : [];
      await Promise.all(
        tags.map((tagName) =>
          logActivity({
            candidateId: candidate.id,
            performedById: req.user.id,
            action: 'Candidate tag added',
            description: `Tag "${tagName}" added during candidate creation.`,
            relatedJob,
            metadata: {
              kind: TAG_ACTIVITY_KIND,
              operation: 'add',
              tag: {
                id: normalizeTagId(tagName),
                label: tagName,
                color: getTagColor(tagName),
              },
            },
          })
        )
      );

      if (req.body.initialNote) {
        await logActivity({
          candidateId: candidate.id,
          performedById: req.user.id,
          action: 'Candidate note added',
          description: req.body.initialNote,
          relatedJob,
          metadata: {
            kind: NOTE_ACTIVITY_KIND,
            text: req.body.initialNote,
            tags: ['Initial Note'],
            isPinned: false,
          },
        });
      }

      await logActivity({
        candidateId: candidate.id,
        performedById: req.user.id,
        action: 'Candidate added',
        description: `Added by ${req.user.name} via ${req.body.source}`,
        relatedJob,
        metadata: {
          kind: CREATED_ACTIVITY_KIND,
          source: req.body.source,
          sourceUrl: req.body.sourceUrl || null,
          referrerName: req.body.referrerName || null,
          agencyName: req.body.agencyName || null,
          priority: req.body.priority || 'medium',
          availabilityStatus: mapAvailabilityStatus(req.body.availabilityStatus),
          portfolioUrl: req.body.portfolioUrl || null,
          recruiterId,
          tags,
          expectedSalary,
          currency: req.body.currency || 'INR',
        },
      });

      return res.status(201).json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async parseResume(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Resume file is required',
        });
      }

      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
      ];
      const cvExt = path.extname(file.originalname || '').toLowerCase();
      const cvExtOk = ['.pdf', '.doc', '.docx', '.txt', '.png'].includes(cvExt);

      if (!allowedMimeTypes.includes(file.mimetype) && !cvExtOk) {
        return res.status(400).json({
          success: false,
          message: 'Only PDF, DOC, DOCX, TXT, and PNG files are allowed',
        });
      }

      const filePath = file.path;

      const stage1 = validateCvUploadFile(file);
      if (!stage1.ok) {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(400).json({
          success: false,
          message: stage1.message,
        });
      }

      try {
        const rawNormalized = await processCandidateCv(file, {
          candidateId: req.body?.candidateId || req.user?.id || null,
        });
        const { cleaned: normalizedData, cvParseMeta } = stripCvParseMeta(rawNormalized);

        return res.status(200).json({
          success: true,
          data: normalizedData,
          tokenUsage: cvParseMeta,
        });
      } catch (parseError) {
        console.error('Resume parsing failed, using non-AI fallback:', parseError.message);
        const fileNameFallback = path.parse(file.originalname || 'resume').name;
        const extractedName = extractResumeName(fileNameFallback, file.originalname || fileNameFallback);

        return res.status(200).json({
          success: true,
          data: {
            firstName: extractedName.firstName,
            lastName: extractedName.lastName,
            email: '',
            phone: '',
            currentCompany: '',
            designation: '',
            currentDesignation: '',
            experience: null,
            location: '',
            linkedinUrl: '',
            source: 'Other',
            priority: 'Medium',
            tags: [],
            skills: [],
            expectedSalary: null,
            currentSalary: null,
            currency: 'INR',
            portfolioUrl: '',
            education: '',
            languages: [],
            certifications: [],
            summary: '',
            city: '',
            country: '',
            noticePeriod: '',
            score: {
              overall: 0,
              breakdown: {
                skillsMatch: 0,
                experienceFit: 0,
                educationFit: 0,
                keywordMatch: 0,
              },
              insights: [],
            },
            parsedAt: new Date().toISOString(),
            isMockData: false,
            parseError: parseError.message,
            tempFilePath: filePath,
            profilePhotoUrl: null,
          },
        });
      } finally {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  /**
   * Bulk CV only: run regex/stages 1–4, optional duplicate gate (Socket.IO), then AI + normalize.
   * Does not persist the candidate — client calls `/candidates/create` with returned `data`.
   */
  async bulkCvExpandZip(req, res) {
    const zipPath = req.file?.path;
    const sessionId = String(req.body?.sessionId || '').trim();
    const userId = req.user?.id;

    const safeUnlinkZip = () => {
      if (zipPath && fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch {
          /* ignore */
        }
      }
    };

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'ZIP archive is required' });
      }
      if (!sessionId) {
        safeUnlinkZip();
        return res.status(400).json({ success: false, message: 'sessionId is required' });
      }
      if (!userId) {
        safeUnlinkZip();
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      releaseBulkCvZipSession(userId, sessionId);

      const { targetDir, fileEntries, skipped, total } = expandBulkCvZipArchive(zipPath, {
        userId,
        sessionId,
        maxFiles: env.BULK_CV_MAX_FILES,
        maxPerFileBytes: env.RESUME_MAX_FILE_BYTES,
      });

      safeUnlinkZip();
      registerBulkCvZipSession(userId, sessionId, targetDir, fileEntries);

      return res.json({
        success: true,
        data: {
          total,
          skipped,
          maxAllowed: env.BULK_CV_MAX_FILES,
          files: fileEntries.map((f) => ({
            storedFileId: f.storedFileId,
            name: f.originalname,
            size: f.size,
          })),
        },
      });
    } catch (error) {
      safeUnlinkZip();
      if (userId && sessionId) {
        releaseBulkCvZipSession(userId, sessionId);
      }
      console.error('[bulk-cv] bulkCvExpandZip failed:', error?.message || error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to extract ZIP archive',
      });
    }
  },

  async bulkCvReleaseZip(req, res) {
    const sessionId = String(req.body?.sessionId || req.query?.sessionId || '').trim();
    const userId = req.user?.id;
    if (!sessionId || !userId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }
    releaseBulkCvZipSession(userId, sessionId);
    return res.json({ success: true, message: 'Bulk ZIP session cleared' });
  },

  async bulkCvProcessFile(req, res) {
    const storedFileId = String(req.body?.storedFileId || '').trim();
    let file = req.file;
    let filePath = file?.path;
    const sessionId = String(req.body?.sessionId || '').trim();
    const fileIndex = Number(req.body?.fileIndex);
    const userId = req.user?.id;
    let fromZipStore = false;

    if (!file && storedFileId && userId && sessionId) {
      const stored = getBulkCvStoredFile(userId, sessionId, storedFileId);
      if (stored) {
        fromZipStore = true;
        filePath = stored.path;
        file = {
          path: stored.path,
          originalname: stored.originalname,
          filename: stored.originalname,
          mimetype: stored.mimetype,
          size: stored.size,
        };
      }
    }

    const safeUnlink = () => {
      if (fromZipStore && userId && sessionId && storedFileId) {
        removeBulkCvStoredFile(userId, sessionId, storedFileId);
        return;
      }
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    };

    try {
      if (!file) {
        return res.status(400).json({ success: false, message: 'Resume file or storedFileId is required' });
      }
      if (!sessionId) {
        safeUnlink();
        return res.status(400).json({ success: false, message: 'sessionId is required for bulk CV duplicate handling' });
      }
      if (!Number.isFinite(fileIndex) || fileIndex < 0) {
        safeUnlink();
        return res.status(400).json({ success: false, message: 'fileIndex is required (0-based)' });
      }

      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
      ];
      const cvExt = path.extname(file.originalname || '').toLowerCase();
      const cvExtOk = ['.pdf', '.doc', '.docx', '.txt', '.png'].includes(cvExt);
      if (!allowedMimeTypes.includes(file.mimetype) && !cvExtOk) {
        safeUnlink();
        return res.status(400).json({
          success: false,
          message: 'Only PDF, DOC, DOCX, TXT, and PNG files are allowed',
        });
      }

      const stage1 = validateCvUploadFile(file);
      if (!stage1.ok) {
        safeUnlink();
        return res.status(400).json({ success: false, message: stage1.message });
      }

      const stage4 = await runCvPipelineThroughStage4(file, { verboseLogs: false });
      const fb = stage4.fallbackData || {};
      const dup = await findExistingCandidateDuplicate({
        email: fb.email,
      });

      let identityPatch = null;
      let duplicateResolution = null;
      let updateExistingCandidateId = null;
      const tenantDbName =
        String(req.user?.tenantDbName || req.headers['x-tenant-db-name'] || '').trim() || undefined;
      const candidateIdForUpload = req.body?.candidateId || userId;

      let normalizedData;

      if (dup) {
        const io = getBulkCvIo();
        if (!io) {
          console.error('[bulk-cv] Socket.IO not initialized');
          safeUnlink();
          return res.status(503).json({
            success: false,
            message: 'Bulk duplicate resolution unavailable (real-time). Restart the API server.',
          });
        }

        const existing = dup.candidate;
        const decisionPromise = waitBulkCvDuplicateDecision(userId, sessionId, fileIndex);
        const finalizePromise = finalizeCvPipelineFromStage5(
          file,
          candidateIdForUpload,
          stage4,
          null,
          tenantDbName,
          { compactPrompt: true, verboseLogs: false },
        );

        emitBulkCvDuplicateFound(userId, sessionId, {
          fileIndex,
          fileName: file.originalname || file.filename || 'resume',
          newCandidate: {
            firstName: fb.firstName || '',
            lastName: fb.lastName || '',
            email: fb.email || '',
          },
          existingCandidate: {
            id: existing.id,
            firstName: existing.firstName,
            lastName: existing.lastName,
            email: existing.email,
            designation: existing.designation || existing.currentTitle || null,
            createdAt: existing.createdAt,
          },
          match: dup.match,
          canUpdate: true,
          canCreateAnyway: true,
        });

        let decisionRaw;
        let preNormalized;
        try {
          [decisionRaw, preNormalized] = await Promise.all([decisionPromise, finalizePromise]);
        } catch (parallelErr) {
          console.error('[bulk-cv] duplicate branch finalize/decision failed', parallelErr?.message || parallelErr);
          throw parallelErr;
        }

        const decision = String(decisionRaw || 'cancel').trim();
        console.log('[bulk-cv] user decision', { file: file.originalname, fileIndex, decision });

        if (decision === 'cancel') {
          safeUnlink();
          const { cvParseMeta: skippedTokenUsage } = stripCvParseMeta(preNormalized);
          return res.status(200).json({
            success: true,
            message: 'duplicate_skipped',
            data: {
              skipped: true,
              reason: 'duplicate_cancelled',
              fileIndex,
              tokenUsage: skippedTokenUsage,
            },
          });
        }

        if (decision === 'replace') {
          console.log('[bulk-cv] REPLACE: hard-deleting existing candidate', existing.id);
          await hardDeleteCandidateById(existing.id);
          duplicateResolution = 'replaced';
          normalizedData = preNormalized;
        } else if (decision === 'update_existing') {
          duplicateResolution = 'updated';
          updateExistingCandidateId = existing.id;
          normalizedData = preNormalized;
        } else if (decision === 'create_anyway') {
          const fnForCopy = String(preNormalized?.firstName || fb.firstName || '').trim();
          const lnForCopy = String(preNormalized?.lastName || fb.lastName || '').trim();
          const dupEmail = normalizeCandidateEmailForDuplicate(
            preNormalized?.email || fb.email || existing?.email
          );
          const newLast = await nextCopyLastNameForBulk({
            firstName: fnForCopy,
            lastName: lnForCopy,
            email: dupEmail,
            userId,
            sessionId,
          });
          identityPatch = { lastName: newLast };
          duplicateResolution = 'create_anyway';
          normalizedData = applyBulkCreateAnywayIdentityPatch(preNormalized, identityPatch);
        } else {
          console.warn('[bulk-cv] unknown decision, treating as cancel', decision);
          safeUnlink();
          const { cvParseMeta: skippedTokenUsage } = stripCvParseMeta(preNormalized);
          return res.status(200).json({
            success: true,
            message: 'duplicate_skipped',
            data: {
              skipped: true,
              reason: 'duplicate_cancelled',
              fileIndex,
              tokenUsage: skippedTokenUsage,
            },
          });
        }
      } else {
        normalizedData = await finalizeCvPipelineFromStage5(
          file,
          candidateIdForUpload,
          stage4,
          null,
          tenantDbName,
          { compactPrompt: true, verboseLogs: false },
        );
      }

      const postAiEmail = normalizeCandidateEmailForDuplicate(
        normalizedData?.email || normalizedData?.contactEmail || fb.email
      );
      if (!dup && postAiEmail) {
        const postDup = await findExistingCandidateDuplicate({ email: postAiEmail });
        if (postDup?.candidate) {
          const io = getBulkCvIo();
          if (!io) {
            safeUnlink();
            return res.status(503).json({
              success: false,
              message: 'Bulk duplicate resolution unavailable (real-time). Restart the API server.',
            });
          }

          const existing = postDup.candidate;
          const decisionPromise = waitBulkCvDuplicateDecision(userId, sessionId, fileIndex);
          emitBulkCvDuplicateFound(userId, sessionId, {
            fileIndex,
            fileName: file.originalname || file.filename || 'resume',
            newCandidate: {
              firstName: normalizedData?.firstName || fb.firstName || '',
              lastName: normalizedData?.lastName || fb.lastName || '',
              email: postAiEmail,
            },
            existingCandidate: {
              id: existing.id,
              firstName: existing.firstName,
              lastName: existing.lastName,
              email: existing.email,
              designation: existing.designation || existing.currentTitle || null,
              createdAt: existing.createdAt,
            },
            match: postDup.match,
            canUpdate: true,
            canCreateAnyway: true,
          });
          const decision = String((await decisionPromise) || 'cancel').trim();
          console.log('[bulk-cv] post-AI duplicate decision', {
            file: file.originalname,
            fileIndex,
            decision,
          });

          if (decision === 'cancel') {
            safeUnlink();
            const { cvParseMeta: skippedTokenUsage } = stripCvParseMeta(normalizedData);
            return res.status(200).json({
              success: true,
              message: 'duplicate_skipped',
              data: {
                skipped: true,
                reason: 'duplicate_cancelled',
                fileIndex,
                tokenUsage: skippedTokenUsage,
              },
            });
          }

          if (decision === 'replace') {
            await hardDeleteCandidateById(existing.id);
            duplicateResolution = 'replaced';
          } else if (decision === 'update_existing') {
            duplicateResolution = 'updated';
            updateExistingCandidateId = existing.id;
          } else if (decision === 'create_anyway') {
            const fnForCopy = String(normalizedData?.firstName || fb.firstName || '').trim();
            const lnForCopy = String(normalizedData?.lastName || fb.lastName || '').trim();
            identityPatch = {
              lastName: await nextCopyLastNameForBulk({
                firstName: fnForCopy,
                lastName: lnForCopy,
                email: postAiEmail,
                userId,
                sessionId,
              }),
            };
            duplicateResolution = 'create_anyway';
            normalizedData = applyBulkCreateAnywayIdentityPatch(normalizedData, identityPatch);
          } else {
            safeUnlink();
            const { cvParseMeta: skippedTokenUsage } = stripCvParseMeta(normalizedData);
            return res.status(200).json({
              success: true,
              message: 'duplicate_skipped',
              data: {
                skipped: true,
                reason: 'duplicate_cancelled',
                fileIndex,
                tokenUsage: skippedTokenUsage,
              },
            });
          }
        }
      }

      safeUnlink();

      const { cleaned: normalizedPayload, cvParseMeta: tokenUsage } = stripCvParseMeta(normalizedData);

      return res.status(200).json({
        success: true,
        message: 'ok',
        data: {
          normalized: normalizedPayload,
          duplicateResolution,
          updateExistingCandidateId: updateExistingCandidateId || undefined,
          fileIndex,
          tokenUsage,
        },
      });
    } catch (error) {
      console.error('[bulk-cv] bulkCvProcessFile failed:', error?.message || error);
      safeUnlink();
      return res.status(500).json({
        success: false,
        message: error.message || 'Bulk CV processing failed',
      });
    }
  },

  async importLinkedIn(req, res) {
    try {
      const linkedinUrl = String(req.body?.linkedinUrl || '').trim();
      if (!linkedinUrl.includes('linkedin.com/in/')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid LinkedIn profile URL',
        });
      }

      const username = linkedinUrl.split('linkedin.com/in/')[1]?.split(/[/?#]/)[0] || 'demo-candidate';

      return res.status(200).json({
        success: true,
        data: {
          firstName: 'Demo',
          lastName: 'Candidate',
          currentCompany: 'Google',
          designation: 'Software Engineer L4',
          experience: 5,
          location: 'Mumbai, India',
          linkedinUrl,
          skills: ['React', 'TypeScript', 'Node.js', 'System Design'],
          importedFrom: 'linkedin',
          importedAt: new Date().toISOString(),
          username,
          isMockData: true,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async checkDuplicate(req, res) {
    try {
      const email = req.query?.email ? normalizeEmail(req.query.email) : '';

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Provide email to check for duplicates',
        });
      }

      const dup = await findExistingCandidateDuplicate({ email });
      const existing = dup?.candidate ?? null;

      if (!existing) {
        return res.status(200).json({
          success: true,
          data: { isDuplicate: false },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          isDuplicate: true,
          matchedOn: 'email',
          candidate: {
            _id: existing.id,
            name: createCandidateName(existing.firstName, existing.lastName),
            email: existing.email,
            phone: existing.phone,
            currentCompany: existing.currentCompany,
            designation: existing.designation,
            stage: existing.stage || 'Applied',
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async uploadCandidateFile(req, res) {
    try {
      const { candidateId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Resume file is required',
        });
      }

      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
      });

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found',
        });
      }

      const tenantDbName =
        String(
          req.user?.tenantDbName ||
            req.headers['x-tenant-db-name'] ||
            getActiveTenantDbName() ||
            'default'
        ).trim() || 'default';

      const upload = await uploadBufferToCloudinary(file.buffer, {
        folder: `jobportal/candidates/${candidateId}/resumes`,
        contentType: uploadContentTypeForFile(file.mimetype, file.originalname),
        originalFilename: file.originalname,
        tenantDbName,
      });
      const resumeUrl = upload?.secure_url || upload?.url;
      const updatedCandidate = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          resume: resumeUrl,
          resumeUrl,
          lastActivity: new Date(),
        },
      });

      // Mirror the resume into CandidateFile so the drawer's Files tab (which
      // reads from /api/v1/files?entityType=candidate) shows the same file
      // alongside the synthetic "Primary resume" row driven by candidate.resume.
      try {
        await prisma.candidateFile.create({
          data: {
            candidateId,
            fileName: file.originalname || 'Resume',
            fileUrl: resumeUrl,
            fileType: 'Resume',
            uploadedById: req.user.id,
          },
        });
      } catch (fileError) {
        console.error('Failed to mirror resume into candidate files:', fileError?.message || fileError);
      }

      await logActivity({
        candidateId,
        performedById: req.user.id,
        action: 'Resume uploaded',
        description: `${file.originalname} uploaded for candidate.`,
        metadata: {
          kind: 'candidate-resume',
          fileName: file.originalname,
          filePath: resumeUrl,
        },
      });

      return res.status(200).json({
        success: true,
        data: updatedCandidate,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async bulkImport(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is required',
        });
      }

      const content = fs.readFileSync(file.path, 'utf8');
      const rows = parseCsvContent(content);
      const requiredHeaders = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'currentCompany',
        'designation',
        'experience',
        'location',
        'source',
      ];

      const headerKeys = rows[0] ? Object.keys(rows[0]) : [];
      const missingHeaders = requiredHeaders.filter((header) => !headerKeys.includes(header));
      if (rows.length > 0 && missingHeaders.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required CSV headers: ${missingHeaders.join(', ')}`,
        });
      }

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const skippedDetails = [];

      for (const row of rows) {
        const firstName = String(row.firstName || '').trim();
        const lastName = String(row.lastName || '').trim();
        const email = normalizeEmail(row.email || '');

        if (!firstName || !email) {
          failed += 1;
          skippedDetails.push({
            row: row.__rowNumber || 0,
            email,
            reason: !email ? 'Missing email' : 'Missing first name',
          });
          continue;
        }

        const dup = await findExistingCandidateDuplicate({ email });
        const duplicate = dup?.candidate ?? null;

        if (duplicate) {
          skipped += 1;
          skippedDetails.push({
            row: row.__rowNumber || 0,
            email,
            reason: 'Duplicate email',
          });
          continue;
        }

        try {
          const candidate = await prisma.candidate.create({
            data: {
              firstName,
              lastName,
              email,
              phone: row.phone ? normalizePhone(row.phone) : null,
              currentCompany: row.currentCompany || null,
              currentTitle: row.designation || null,
              designation: row.designation || null,
              experience: parsePositiveNumber(row.experience),
              location: row.location || null,
              source: row.source || null,
              assignedToId: req.user.id,
              createdById: req.user.id,
              status: 'NEW',
              stage: 'Applied',
              lastActivity: new Date(),
            },
          });

          await logActivity({
            candidateId: candidate.id,
            performedById: req.user.id,
            action: 'Candidate added',
            description: `Added by ${req.user.name} via bulk import`,
            metadata: {
              kind: CREATED_ACTIVITY_KIND,
              source: row.source || null,
              importedBy: 'bulk-csv',
            },
          });

          created += 1;
        } catch (createError) {
          failed += 1;
          skippedDetails.push({
            row: row.__rowNumber || 0,
            email,
            reason: createError.message || 'Failed to create candidate',
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          total: rows.length,
          created,
          skipped,
          failed,
          skippedDetails,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async downloadTemplate(req, res) {
    try {
      const headers =
        'firstName,lastName,email,phone,currentCompany,designation,experience,location,source\n';
      const example =
        'John,Smith,john@example.com,+91 98765 43210,Google,Software Engineer,5,Bangalore,LinkedIn\n';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="candidate_import_template.csv"');
      return res.send(headers + example);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async getTags(req, res) {
    try {
      const tags = await collectTagSuggestions();
      return res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
