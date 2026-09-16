import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma.js';
import { activeCandidateClause } from './bulkCvDuplicate.service.js';
import {
  candidateNameNeedsRepair,
  extractResumeName,
  looksLikePersonName,
  sanitizeExtractedPersonName,
} from './cvParsing.service.js';
import {
  extractDocText,
  extractDocxText,
  extractPdfTextWithOcrFallback,
} from '../utils/documentTextExtract.js';
import { env } from '../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const DEFAULT_LIMIT = 500;
const CONCURRENCY = 2;
const AI_RESUME_CHARS = 14000;
const AI_RETRY_DELAY_MS = 800;

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseNameJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  const fenced = text.match(/\{[\s\S]*\}/);
  return safeJsonParse(fenced ? fenced[0] : text) || {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asPersonName(firstName = '', lastName = '') {
  return sanitizeExtractedPersonName(firstName, lastName);
}

/** Keep an OpenAI name even when the strict resume-heuristic checker is too tight. */
function sanitizeLlmPersonName(firstName = '', lastName = '', fullName = '') {
  const strict = asPersonName(firstName, lastName);
  if (strict.firstName) return strict;

  const combined = (`${firstName || ''} ${lastName || ''}`.trim() || String(fullName || '').trim())
    .replace(/\bcopy\s*\d+\b/gi, ' ')
    .replace(/\b(?:curriculum|vitae|ecv|resume|r[eé]sum[eé]|cv|pdf|docx?|email|e-?mail|tel|t[eé]l[eé]phone|title|age)\b/gi, ' ')
    .replace(/[.]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = combined
    .split(' ')
    .map((part) => String(part || '').trim().replace(/^\(+|\)+$/g, ''))
    .filter(Boolean)
    .filter((part) => /^[A-Za-zÀ-ÿ]\.$/.test(part) || /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]{0,40}$/.test(part));

  if (parts.length < 2 || parts.length > 8) return { firstName: '', lastName: '' };

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const last = parts
    .slice(1)
    .map((part) => {
      if (/^[A-Za-zÀ-ÿ]\.$/.test(part)) return part.toUpperCase();
      if (part.length <= 3 && part === part.toLowerCase()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
  return { firstName: first, lastName: last };
}

function buildNamePrompt({ capped, fileName, currentLabel, retry }) {
  const retryNote = retry
    ? `

The previous attempt returned no usable person name. Look again more carefully near phone, email, and the top heading. Return the real human name if it is present.`
    : '';
  return `Extract the candidate's given name and family name from this CV.

Return only JSON:
{"firstName":"","lastName":"","fullName":""}

The person name is usually next to phone/email, not the document title, city, job, or file name.

Use:
- "Chetan R. Patel" even if the file or first line is "Ahmedabad Gujarat India"
- "Ogbonna Chidinma Gloria" not qualifications like B.Sc ACA
- "Kamto Kamdem Cédric" not "Tel" or "Email"

Never return:
- Curriculum Vitae, CV, Bio Data, Personal Details
- Job titles (Engineer, Superintendent, Leader, Assistant, Accountant)
- Locations (Lagos, Tamil Nadu, Kampala, Douala, Gujarat)
- Skills, slogans, objectives, section headers
- null, Unknown Candidate, or the file name

If the name is unclear, return empty strings.
${retryNote}

Current stored label (often wrong — do not copy unless it is clearly the person name): ${currentLabel || '—'}
File name (do not use as the person name): ${fileName || 'resume'}

Resume text:
${capped}`;
}

async function callOpenAiForName({ capped, fileName, currentLabel, retry = false }) {
  const completion = await chatCompletionWithFallback(
    {
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract only the candidate’s real person name from a CV. Return JSON only. Never invent a name. Never use a job title, city, country, address, section header, or file name as the name.',
        },
        {
          role: 'user',
          content: buildNamePrompt({ capped, fileName, currentLabel, retry }),
        },
      ],
    },
    'repair-names',
    { preferredProvider: 'openai', quiet: false },
  );
  const content = completion?.choices?.[0]?.message?.content || '{}';
  const parsed = parseNameJson(content);
  let firstName = String(parsed.firstName || '').trim();
  let lastName = String(parsed.lastName || '').trim();
  const fullName = String(parsed.fullName || parsed.name || '').trim();
  if (fullName && (!firstName || !lastName)) {
    const bits = fullName.split(/\s+/).filter(Boolean);
    if (bits.length >= 2) {
      firstName = firstName || bits[0];
      lastName = lastName || bits.slice(1).join(' ');
    }
  }
  return sanitizeLlmPersonName(firstName, lastName, fullName);
}

async function extractCandidateNameWithOpenAi(resumeText = '', fileName = '', currentLabel = '') {
  const text = String(resumeText || '').trim();
  if (!text || !hasLlmProvider()) return { firstName: '', lastName: '' };

  const capped = text.length > AI_RESUME_CHARS ? `${text.slice(0, AI_RESUME_CHARS)}\n…` : text;
  try {
    const firstTry = await callOpenAiForName({ capped, fileName, currentLabel, retry: false });
    if (firstTry.firstName) return firstTry;
  } catch (error) {
    console.warn('[repair-names] OpenAI name parse failed:', error?.message || error);
  }

  await sleep(AI_RETRY_DELAY_MS);
  try {
    const secondTry = await callOpenAiForName({ capped, fileName, currentLabel, retry: true });
    if (secondTry.firstName) return secondTry;
  } catch (error) {
    console.warn('[repair-names] OpenAI name parse retry failed:', error?.message || error);
  }

  return { firstName: '', lastName: '' };
}

function stripCopySuffix(value = '') {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*?)\s+(copy\s*\d+)\s*$/i);
  if (!match) return { base: raw, copyLabel: '' };
  return { base: String(match[1] || '').trim(), copyLabel: String(match[2] || '').trim() };
}

function withCopyLabel(lastName = '', copyLabel = '') {
  const base = String(lastName || '').trim();
  const label = String(copyLabel || '').trim();
  if (!label) return base;
  if (!base) return label;
  if (new RegExp(`\\b${label.replace(/\s+/g, '\\s+')}\\b`, 'i').test(base)) return base;
  return `${base} ${label}`.trim();
}

function guessFileNameFromUrl(url = '') {
  try {
    const pathname = new URL(String(url)).pathname;
    const base = path.basename(pathname || '');
    return decodeURIComponent(base || 'resume.pdf');
  } catch {
    return 'resume.pdf';
  }
}

async function downloadResumeBuffer(url = '') {
  const raw = String(url || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(raw, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: '*/*' },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (!ab?.byteLength) return null;
    return Buffer.from(ab);
  } catch (error) {
    console.warn('[repair-names] download failed:', error?.message || error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function extractTextFromResumeBuffer(buffer, fileName = '') {
  if (!buffer?.length) return '';
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();

  if (ext === '.pdf' || lowerName.includes('.pdf')) {
    return extractPdfTextWithOcrFallback(buffer);
  }
  if (ext === '.docx' || lowerName.includes('.docx')) {
    return extractDocxText(buffer);
  }
  if (ext === '.doc' || lowerName.includes('.doc')) {
    const tmpPath = path.join(os.tmpdir(), `repair-name-${randomUUID()}.doc`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      return await extractDocText(tmpPath);
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
  }
  if (ext === '.txt' || lowerName.includes('.txt')) {
    return buffer.toString('utf8');
  }

  // Most stored resumes are PDFs even when the URL has no extension.
  try {
    return await extractPdfTextWithOcrFallback(buffer);
  } catch {
    try {
      return await extractDocxText(buffer);
    } catch {
      return '';
    }
  }
}

function nameFromEmail(email = '') {
  const local = String(email || '')
    .split('@')[0]
    .replace(/\+.*$/, '')
    .replace(/\d+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!local) return { firstName: '', lastName: '' };
  const parts = local.split(' ').filter(Boolean);
  if (parts.length < 2) return { firstName: '', lastName: '' };
  const candidate = {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
  const full = `${candidate.firstName} ${candidate.lastName}`.trim();
  if (!looksLikePersonName(full)) return { firstName: '', lastName: '' };
  return candidate;
}

async function resolveResumeSource(candidate) {
  const primary = String(candidate.resume || candidate.resumeUrl || '').trim();
  if (primary) {
    return { url: primary, fileName: guessFileNameFromUrl(primary) };
  }

  const files = Array.isArray(candidate.files) ? candidate.files : [];
  const preferred =
    files.find((f) => /resume/i.test(String(f?.fileType || ''))) ||
    files.find((f) => /\.(pdf|docx?)$/i.test(String(f?.fileName || ''))) ||
    files.find((f) => String(f?.fileUrl || '').trim()) ||
    null;
  const fileUrl = String(preferred?.fileUrl || '').trim();
  if (fileUrl) {
    return {
      url: fileUrl,
      fileName: String(preferred?.fileName || guessFileNameFromUrl(fileUrl)).trim() || 'resume.pdf',
    };
  }
  return { url: '', fileName: '' };
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Find candidates with garbage names and fix them from stored CVs.
 *
 * Algorithm:
 * 1. Find stored names that fail the person-name check.
 * 2. Download the CV and extract text.
 * 3. Ask OpenAI for the real person name (retry once if empty/error).
 * 4. Do not use resume-text heuristics while an LLM is configured —
 *    those pick job titles, cities, and section headers.
 * 5. Last resort only: email local-part. Skip if still unparseable.
 * 6. Keep bulk "copy N" suffixes.
 *
 * Tenant-scoped via prisma ALS.
 */
export async function repairBadCandidateNames(options = {}) {
  const dryRun = options.dryRun !== false && options.execute !== true;
  const limit = Math.min(
    Math.max(Number(options.limit) || DEFAULT_LIMIT, 1),
    2000
  );
  const orgUnitId = String(options.orgUnitId || '').trim() || null;

  const where = {
    ...activeCandidateClause,
    ...(orgUnitId ? { orgUnitId } : {}),
  };

  const rows = await prisma.candidate.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      resume: true,
      resumeUrl: true,
      extraData: true,
      files: {
        orderBy: { uploadDate: 'desc' },
        take: 3,
        select: { fileUrl: true, fileName: true, fileType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit * 4, 5000),
  });

  const badRows = rows
    .filter((row) => candidateNameNeedsRepair(row.firstName, row.lastName))
    .slice(0, limit);

  const summary = {
    scanned: rows.length,
    badNames: badRows.length,
    updated: 0,
    wouldUpdate: 0,
    skippedNoResume: 0,
    skippedUnparseable: 0,
    unchanged: 0,
    dryRun,
    /** Full list of name changes (preview + execute). */
    changes: [],
    /** First 25 changes — kept for older clients. */
    samples: [],
  };

  if (!badRows.length) {
    return summary;
  }

  const outcomes = await mapPool(badRows, CONCURRENCY, async (row) => {
    const priorFirst = String(row.firstName || '').trim();
    const priorLast = String(row.lastName || '').trim();
    const { copyLabel: copyFromLast } = stripCopySuffix(priorLast);
    const { copyLabel: copyFromFull } = stripCopySuffix(`${priorFirst} ${priorLast}`.trim());
    const copyLabel = copyFromLast || copyFromFull;

    const source = await resolveResumeSource(row);
    let extracted = { firstName: '', lastName: '' };
    let sourceUsed = 'none';
    let skipReason = '';

    if (source.url) {
      const buffer = await downloadResumeBuffer(source.url);
      if (buffer?.length) {
        const text = await extractTextFromResumeBuffer(buffer, source.fileName);
        const resumeText = String(text || '').trim();
        if (hasLlmProvider() && resumeText) {
          extracted = await extractCandidateNameWithOpenAi(
            resumeText,
            source.fileName,
            `${priorFirst} ${priorLast}`.trim(),
          );
          if (extracted.firstName) {
            sourceUsed = 'openai';
          } else {
            skipReason = 'unparseable';
          }
        } else if (!hasLlmProvider() && resumeText) {
          const heuristic = extractResumeName(text, source.fileName);
          extracted = asPersonName(heuristic.firstName, heuristic.lastName);
          if (extracted.firstName && !candidateNameNeedsRepair(extracted.firstName, extracted.lastName)) {
            sourceUsed = 'resume';
          } else {
            extracted = { firstName: '', lastName: '' };
            skipReason = 'unparseable';
          }
        } else {
          skipReason = 'unparseable';
        }
      } else {
        skipReason = 'noResume';
      }
    } else {
      skipReason = 'noResume';
    }

    if (!extracted.firstName && !extracted.lastName) {
      const fromEmail = nameFromEmail(row.email);
      extracted = asPersonName(fromEmail.firstName, fromEmail.lastName);
      if (extracted.firstName) {
        sourceUsed = 'email';
        skipReason = '';
      }
    }

    let nextFirst = String(extracted.firstName || '').trim();
    let nextLast = String(extracted.lastName || '').trim();
    const extractedFull = `${nextFirst} ${nextLast}`.trim();
    const fromLlm = sourceUsed === 'openai';
    const nameOk = fromLlm
      ? Boolean(nextFirst && (nextLast || looksLikePersonName(extractedFull)))
      : looksLikePersonName(extractedFull);

    if (!nameOk) {
      return {
        id: row.id,
        status: skipReason === 'noResume' ? 'skippedNoResume' : 'skippedUnparseable',
        from: `${priorFirst} ${priorLast}`.trim(),
        to: null,
        sourceUsed: skipReason || 'invalid',
      };
    }

    nextLast = withCopyLabel(nextLast, copyLabel);

    const fromFull = `${priorFirst} ${priorLast}`.trim();
    const toFull = `${nextFirst} ${nextLast}`.trim();
    if (fromFull.toLowerCase() === toFull.toLowerCase()) {
      return {
        id: row.id,
        status: 'unchanged',
        from: fromFull,
        to: toFull,
        sourceUsed,
      };
    }

    if (!dryRun) {
      const priorExtra =
        row.extraData && typeof row.extraData === 'object' && !Array.isArray(row.extraData)
          ? row.extraData
          : {};
      await prisma.candidate.update({
        where: { id: row.id },
        data: {
          firstName: nextFirst,
          lastName: nextLast,
          extraData: {
            ...priorExtra,
            nameRepairedAt: new Date().toISOString(),
            nameRepairedFrom: fromFull,
            nameRepairSource: sourceUsed,
          },
          updatedAt: new Date(),
        },
      });
    }

    return {
      id: row.id,
      status: dryRun ? 'wouldUpdate' : 'updated',
      from: fromFull,
      to: toFull,
      sourceUsed,
    };
  });

  for (const outcome of outcomes) {
    if (!outcome) continue;
    if (outcome.status === 'updated') summary.updated += 1;
    else if (outcome.status === 'wouldUpdate') summary.wouldUpdate += 1;
    else if (outcome.status === 'skippedNoResume') summary.skippedNoResume += 1;
    else if (outcome.status === 'skippedUnparseable') summary.skippedUnparseable += 1;
    else if (outcome.status === 'unchanged') summary.unchanged += 1;

    const entry = {
      id: outcome.id,
      status: outcome.status,
      from: outcome.from,
      to: outcome.to,
      source: outcome.sourceUsed || outcome.reason || null,
    };
    if (outcome.status === 'updated' || outcome.status === 'wouldUpdate') {
      summary.changes.push(entry);
    }
    if (summary.samples.length < 25) {
      summary.samples.push(entry);
    }
  }

  return summary;
}
