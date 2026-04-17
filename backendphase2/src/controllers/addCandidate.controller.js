import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';
import { processCandidateCv } from '../services/cvParsing.service.js';

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
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
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

function validateCreateCandidatePayload(body) {
  const requiredFields = [
    ['firstName', 'First name is required'],
    ['lastName', 'Last name is required'],
    ['email', 'Email is required'],
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

function extractResumeName(fullText = '') {
  const firstLine = String(fullText)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return { firstName: 'Sarah', lastName: 'Jenkins' };
  }

  const nameParts = firstLine.split(/\s+/).filter(Boolean);
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }

  return {
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' '),
  };
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
  if (!openai || !cleanedText) {
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

  const completion = await openai.chat.completions.create({
    model: env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
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
  });

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

      const email = normalizeEmail(req.body.email);
      // email is not @unique on Candidate (Mongo null-email uniqueness); use findFirst
      const existing = await prisma.candidate.findFirst({
        where: { email },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          stage: true,
          currentTitle: true,
          currentCompany: true,
        },
      });

      const recruiterId = req.body.recruiterId || req.user.id;
      const creatorId = req.user.id;
      const stageLabel = getStageLabel(req.body.stage || 'Applied');
      const expectedSalary = parsePositiveNumber(req.body.expectedSalary);
      const currentSalary = parsePositiveNumber(req.body.currentSalary);
      const duplicateAction = String(req.body.duplicateAction || 'create');
      const candidateData = {
        firstName: String(req.body.firstName).trim(),
        lastName: String(req.body.lastName).trim(),
        email,
        phone: req.body.phone ? normalizePhone(req.body.phone) : null,
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
        preferredLocation: req.body.preferredLocation || null,
        resume: req.body.resume || null,
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

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Candidate already exists',
          isDuplicate: true,
          data: {
            existingCandidate: buildExistingCandidateSummary(existing),
            canUpdate: true,
            canCreateAnyway: false,
          },
        });
      }

      const candidate = await prisma.candidate.create({
        data: candidateData,
      });

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
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Only PDF, DOC, and DOCX files are allowed',
        });
      }

      const filePath = file.path;
      try {
        const normalizedData = await processCandidateCv(file, {
          candidateId: req.body?.candidateId || req.user?.id || null,
        });

        return res.status(200).json({
          success: true,
          data: normalizedData,
        });
      } catch (parseError) {
        console.error('Resume parsing failed, using non-AI fallback:', parseError.message);
        const fileNameFallback = path.parse(file.originalname || 'resume').name;
        const extractedName = extractResumeName(fileNameFallback);

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
      const phone = req.query?.phone ? normalizePhone(req.query.phone) : '';

      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          message: 'Provide email or phone',
        });
      }

      const existing = await prisma.candidate.findFirst({
        where: email ? { email } : { phone },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          currentCompany: true,
          designation: true,
          stage: true,
        },
      });

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
          matchedOn: email ? 'email' : 'phone',
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

      const upload = await uploadBufferToCloudinary(file.buffer, {
        folder: `jobportal/candidates/${candidateId}/resumes`,
        resourceType: 'raw',
        originalFilename: file.originalname,
      });
      const resumeUrl = upload?.secure_url || upload?.url;
      const updatedCandidate = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          resume: resumeUrl,
          lastActivity: new Date(),
        },
      });

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

        const duplicate = await prisma.candidate.findFirst({
          where: { email },
          select: { id: true },
        });

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
