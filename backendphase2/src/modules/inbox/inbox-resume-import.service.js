import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { processCandidateCv, stripCvParseMeta, validateCvUploadFile } from '../../services/cvParsing.service.js';
import {
  findExistingCandidateDuplicate,
  normalizeCandidateEmailForDuplicate,
} from '../../services/bulkCvDuplicate.service.js';
import { isResumeAttachment } from './inbox-attachments.util.js';
import {
  buildInboxPhase1Snapshot,
  mergeInboxExtraData,
  normalizeEducationEntriesForProfile,
  repairParsedEmail,
} from './inbox-parsed-profile.util.js';

const RESUME_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

function logInboxEngineBlock(title, lines = []) {
  console.log('');
  console.log('='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
  for (const line of lines) console.log(line);
}

function mimeFromFilename(filename = '', mimeType = '') {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return String(mimeType || 'application/octet-stream');
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const name = String(item.name || item.language || '').trim();
        const level = String(item.proficiency || item.level || '').trim();
        return level && name ? `${name} (${level})` : name;
      }
      return String(item || '').trim();
    })
    .filter(Boolean);
}

function parseExperienceYears(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function parseMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function cleanEducationQualification(value) {
  return String(value || '')
    .replace(/\bXilin\b/gi, 'XII')
    .replace(/\bXi\s*in\b/gi, 'XII')
    .replace(/\bXin\b/gi, 'X')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryEducationLabel(parsed = {}) {
  const entries = Array.isArray(parsed.educationEntries) ? parsed.educationEntries : [];
  if (entries[0] && typeof entries[0] === 'object') {
    const q = cleanEducationQualification(entries[0].qualification || entries[0].degree);
    const i = String(entries[0].instituteName || entries[0].institution || '').trim();
    const line = [q, i].filter(Boolean).join(' — ');
    if (line) return line;
  }
  const raw = String(parsed.education || '').trim();
  if (!raw) return null;
  return raw.split(/\s*\|\s*/)[0] || raw;
}

function languagesFromParsed(parsed = {}) {
  const fromProficiency = toStringList(parsed.languageProficiency);
  if (fromProficiency.length) return fromProficiency;
  return toStringList(parsed.languages);
}

function parsedExtraData(parsed = {}) {
  return parsed.extraData && typeof parsed.extraData === 'object' && !Array.isArray(parsed.extraData)
    ? parsed.extraData
    : undefined;
}

function parseBirthDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function candidateSummary(candidate) {
  if (!candidate) return null;
  return {
    id: candidate.id,
    firstName: candidate.firstName || '',
    lastName: candidate.lastName || '',
    email: candidate.email || '',
    resume: candidate.resume || candidate.resumeUrl || null,
  };
}

async function attachResumeFile({ candidateId, fileName, fileUrl, uploadedById, setPrimary = false }) {
  if (!candidateId || !fileUrl || !/^https?:\/\//i.test(String(fileUrl))) return;
  const existing = await prisma.candidateFile.findFirst({
    where: { candidateId, fileUrl: String(fileUrl) },
    select: { id: true },
  });
  if (!existing) {
    await prisma.candidateFile.create({
      data: {
        candidateId,
        fileName: String(fileName || 'Resume').slice(0, 180) || 'Resume',
        fileUrl: String(fileUrl),
        fileType: 'Resume',
        uploadedById,
      },
    });
  }
  if (!setPrimary) return;
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { resume: String(fileUrl), resumeUrl: String(fileUrl) },
  });
}

function writeTempResume(buffer, filename) {
  const safe = String(filename || 'resume.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120) || 'resume.pdf';
  const tempPath = path.join(
    os.tmpdir(),
    `inbox-cv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`
  );
  fs.writeFileSync(tempPath, buffer);
  return tempPath;
}

/**
 * Download a mailbox resume into the CRM: parse with the existing CV pipeline,
 * then create a candidate or match an existing one by email.
 */
export async function importResumeBufferAsCandidate({
  userId,
  orgUnitId,
  buffer,
  filename,
  mimeType,
  source = 'Inbox',
  attachmentId = '',
} = {}) {
  const originalName = String(filename || 'resume.pdf').trim() || 'resume.pdf';
  const ext = path.extname(originalName).toLowerCase();
  if (!isResumeAttachment(originalName, mimeType) || !RESUME_EXTENSIONS.has(ext)) {
    const error = new Error('Only PDF, DOC, and DOCX resume attachments can be imported');
    error.status = 400;
    throw error;
  }

  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!bytes.length) {
    const error = new Error('Attachment is empty');
    error.status = 400;
    throw error;
  }

  const maxBytes = Number(env.RESUME_MAX_FILE_BYTES) || 25 * 1024 * 1024;
  if (bytes.length > maxBytes) {
    const error = new Error('Resume attachment is larger than the allowed upload size');
    error.status = 400;
    throw error;
  }

  const resolvedMime = mimeFromFilename(originalName, mimeType);
  const tempPath = writeTempResume(bytes, originalName);
  const file = {
    path: tempPath,
    originalname: originalName,
    filename: path.basename(tempPath),
    mimetype: resolvedMime,
    size: bytes.length,
  };

  try {
    const stage1 = validateCvUploadFile(file);
    if (!stage1.ok) {
      const error = new Error(stage1.message || 'Invalid resume file');
      error.status = 400;
      throw error;
    }

    const engineTag = `Inbox ${String(source || 'Email').trim() || 'Email'}`;
    logInboxEngineBlock(`${engineTag} — Bulk CV engine`, [
      `File: ${originalName}`,
      `MIME: ${resolvedMime}`,
      `Size: ${(bytes.length / 1024).toFixed(2)} KB`,
      'Parser: processCandidateCv (same pipeline as Bulk CV)',
      'Logs: Stage 1–8 + EXTRACTED DATA (verbose on for inbox)',
    ]);

    const rawNormalized = await processCandidateCv(file, {
      candidateId: userId || null,
      verboseLogs: true,
      logTag: engineTag,
    });
    const { cleaned, cvParseMeta } = stripCvParseMeta(rawNormalized);
    const parsed = cleaned && typeof cleaned === 'object' ? cleaned : {};

    const firstName = String(parsed.firstName || '').trim() || 'Unknown';
    const lastName = String(parsed.lastName || '').trim() || 'Candidate';
    const repairedEmail = repairParsedEmail(parsed.email);
    const email =
      normalizeCandidateEmailForDuplicate(repairedEmail) ||
      normalizeCandidateEmailForDuplicate(parsed.email) ||
      null;
    const resumeUrl = String(parsed.resumeUrl || parsed.resume || '').trim() || null;
    const location =
      String(parsed.location || '').trim() ||
      [parsed.city, parsed.country].filter(Boolean).join(', ') ||
      null;
    const expectedSalary = parseMoney(parsed.expectedSalary);
    const currentSalary = parseMoney(parsed.currentSalary);

    let dup = email ? await findExistingCandidateDuplicate({ email }) : null;
    if (!dup?.candidate) {
      const unrepaired = normalizeCandidateEmailForDuplicate(parsed.email);
      if (unrepaired && unrepaired !== email) {
        dup = await findExistingCandidateDuplicate({ email: unrepaired });
      }
    }
    const existing = dup?.candidate || null;
    const parsedExtra = parsedExtraData(parsed);
    const educationEntries = normalizeEducationEntriesForProfile(parsed.educationEntries);
    parsed.educationEntries = educationEntries;
    const snapshot = buildInboxPhase1Snapshot(parsed, parsedExtra, {
      fileName: originalName,
      resumeUrl,
    });
    const extraData = mergeInboxExtraData(null, parsedExtra, snapshot);
    const educationLabel = primaryEducationLabel(parsed);
    const workEntries = Array.isArray(parsed.workExperienceEntries)
      ? parsed.workExperienceEntries
      : undefined;
    const portfolioLinks = Array.isArray(parsed.portfolioLinks) ? parsed.portfolioLinks : undefined;
    const birthDate = parseBirthDate(parsed.birthDate || extraData?.pipeline?.personal?.birthDate);
    const rawAddress = String(parsed.currentAddress || '').trim();
    const cityValue = String(snapshot?.personalInfo?.city || parsed.city || '').trim();
    const address =
      rawAddress && rawAddress.toLowerCase() !== cityValue.toLowerCase() ? rawAddress : null;
    const gender =
      String(parsed.gender || parsedExtra?.pipeline?.personal?.gender || snapshot?.personalInfo?.gender || '').trim() ||
      null;

    if (existing) {
      const current = await prisma.candidate.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          resume: true,
          resumeUrl: true,
          extraData: true,
          education: true,
          cvEducationEntries: true,
          cvWorkExperienceEntries: true,
          cvPortfolioLinks: true,
          address: true,
          gender: true,
          currentCompany: true,
          currentTitle: true,
          noticePeriod: true,
          location: true,
          city: true,
          country: true,
        },
      });
      try {
        await attachResumeFile({
          candidateId: existing.id,
          fileName: originalName,
          fileUrl: resumeUrl,
          uploadedById: userId,
          setPrimary: !current?.resume && !current?.resumeUrl,
        });
      } catch (fileError) {
        console.error('Inbox resume attach on duplicate failed:', fileError?.message || fileError);
      }

      const patch = {};
      patch.extraData = mergeInboxExtraData(current?.extraData, parsedExtra, snapshot);
      if (educationEntries.length) patch.cvEducationEntries = educationEntries;
      if (workEntries?.length) patch.cvWorkExperienceEntries = workEntries;
      if (portfolioLinks?.length) patch.cvPortfolioLinks = portfolioLinks;
      if (address) {
        if (!current?.address) patch.address = address;
      } else if (
        current?.address &&
        cityValue &&
        String(current.address).trim().toLowerCase() === cityValue.toLowerCase()
      ) {
        patch.address = null;
      }
      if (!current?.gender && gender) patch.gender = gender;
      if (!current?.currentCompany && (parsed.currentCompany || parsed.currentEmployer)) {
        patch.currentCompany = String(parsed.currentCompany || parsed.currentEmployer).trim();
      }
      if (!current?.currentTitle && (parsed.currentDesignation || parsed.designation)) {
        patch.currentTitle = String(parsed.currentDesignation || parsed.designation).trim();
        patch.designation = patch.currentTitle;
      }
      if (!current?.noticePeriod && parsed.noticePeriod) {
        patch.noticePeriod = String(parsed.noticePeriod).trim();
      }
      if (!current?.location && location) patch.location = location;
      if (!current?.city && (snapshot?.personalInfo?.city || parsed.city)) {
        patch.city = String(snapshot?.personalInfo?.city || parsed.city).trim();
      }
      if (!current?.country && (snapshot?.personalInfo?.country || parsed.country)) {
        patch.country = String(snapshot?.personalInfo?.country || parsed.country).trim();
      }
      if (email && /gmailcom/i.test(String(current?.email || ''))) patch.email = email;
      if (
        educationLabel &&
        (!current?.education || String(current.education).includes('|'))
      ) {
        patch.education = educationLabel;
      }
      if (Object.keys(patch).length) {
        try {
          await prisma.candidate.update({ where: { id: existing.id }, data: patch });
        } catch (patchError) {
          console.error('Inbox duplicate field backfill failed:', patchError?.message || patchError);
        }
      }

      logInboxEngineBlock(`${engineTag} — Candidate save`, [
        `Result: duplicate backfill (existing candidate matched by email)`,
        `Candidate: ${[current?.firstName || existing.firstName, current?.lastName || existing.lastName].filter(Boolean).join(' ') || 'N/A'}`,
        `Email: ${email || current?.email || existing.email || 'N/A'}`,
        `Education entries: ${educationEntries.length}`,
        `Work entries: ${Array.isArray(workEntries) ? workEntries.length : 0}`,
        `Languages: ${languagesFromParsed(parsed).join(', ') || 'N/A'}`,
        `Phase 1 snapshot: ${extraData?.phase1ProfileSnapshot ? 'saved' : 'missing'}`,
        cvParseMeta?.parseChain ? `Parse chain: ${cvParseMeta.parseChain}` : '',
        cvParseMeta?.apiUsedLabel ? `API key used: ${cvParseMeta.apiUsedLabel}` : '',
      ].filter(Boolean));

      return {
        created: false,
        isDuplicate: true,
        candidate: candidateSummary(current || existing),
        attachment: { id: String(attachmentId || ''), filename: originalName },
      };
    }

    const nameNormalized = `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        nameNormalized: nameNormalized || null,
        email,
        phone: parsed.phone ? String(parsed.phone).trim() : null,
        avatar: parsed.profilePhotoUrl || null,
        linkedIn: parsed.linkedinUrl ? String(parsed.linkedinUrl).trim() : null,
        skills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean).slice(0, 20).map(String) : [],
        experience: parseExperienceYears(parsed.experience),
        currentTitle: parsed.currentDesignation || parsed.designation || null,
        designation: parsed.currentDesignation || parsed.designation || null,
        currentCompany: parsed.currentCompany || null,
        location,
        status: 'NEW',
        source: String(source || 'Inbox'),
        lastActivity: new Date(),
        city: snapshot?.personalInfo?.city || parsed.city || null,
        country: snapshot?.personalInfo?.country || parsed.country || null,
        address,
        gender,
        dateOfBirth: birthDate,
        noticePeriod: parsed.noticePeriod ? String(parsed.noticePeriod).trim() : null,
        expectedSalary,
        currentSalary,
        salary:
          expectedSalary != null
            ? { min: null, max: expectedSalary, currency: parsed.currency || 'INR' }
            : parsed.currency
              ? { min: null, max: null, currency: parsed.currency }
              : undefined,
        education: educationLabel,
        certifications: toStringList(parsed.certifications),
        languages: languagesFromParsed(parsed),
        portfolio: parsed.portfolioUrl || null,
        website: parsed.website || parsed.portfolioUrl || null,
        notes: parsed.summary || null,
        cvSummary: parsed.summary || null,
        cvEducationEntries: educationEntries,
        cvWorkExperienceEntries: workEntries,
        cvPortfolioLinks: portfolioLinks,
        extraData,
        preferredLocation: location,
        resume: resumeUrl,
        resumeUrl,
        assignedTo: userId ? { connect: { id: userId } } : undefined,
        createdBy: userId ? { connect: { id: userId } } : undefined,
      },
    });

    try {
      await attachResumeFile({
        candidateId: candidate.id,
        fileName: originalName,
        fileUrl: resumeUrl,
        uploadedById: userId,
        setPrimary: false,
      });
    } catch (fileError) {
      console.error('Inbox resume file seed failed:', fileError?.message || fileError);
    }

    try {
      await prisma.activity.create({
        data: {
          action: 'Candidate added',
          description: `Added from ${source} resume attachment "${originalName}"`,
          performedById: userId,
          entityType: 'CANDIDATE',
          entityId: candidate.id,
          category: 'Candidates',
          relatedType: 'candidate',
          relatedLabel: `${firstName} ${lastName}`.trim(),
          relatedId: candidate.id,
          metadata: {
            kind: 'created',
            source,
            attachmentFilename: originalName,
          },
        },
      });
    } catch (activityError) {
      console.error('Inbox candidate activity log failed:', activityError?.message || activityError);
    }

    logInboxEngineBlock(`${engineTag} — Candidate save`, [
      'Result: created new candidate',
      `Candidate: ${[firstName, lastName].filter(Boolean).join(' ') || 'N/A'}`,
      `Email: ${email || 'N/A'}`,
      `Education entries: ${educationEntries.length}`,
      `Work entries: ${Array.isArray(workEntries) ? workEntries.length : 0}`,
      `Languages: ${languagesFromParsed(parsed).join(', ') || 'N/A'}`,
      `Phase 1 snapshot: ${extraData?.phase1ProfileSnapshot ? 'saved' : 'missing'}`,
      cvParseMeta?.parseChain ? `Parse chain: ${cvParseMeta.parseChain}` : '',
      cvParseMeta?.apiUsedLabel ? `API key used: ${cvParseMeta.apiUsedLabel}` : '',
    ].filter(Boolean));

    return {
      created: true,
      isDuplicate: false,
      candidate: candidateSummary(candidate),
      attachment: { id: String(attachmentId || ''), filename: originalName },
    };
  } finally {
    try {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      /* ignore temp cleanup */
    }
  }
}
