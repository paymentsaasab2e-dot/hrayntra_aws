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
} from './cvParsing.service.js';
import {
  extractDocText,
  extractDocxText,
  extractPdfTextWithOcrFallback,
} from '../utils/documentTextExtract.js';
import { env } from '../config/env.js';
import { chatCompletionWithFallback, hasLlmProvider } from './llmChatFallback.service.js';

const DEFAULT_LIMIT = 500;
const CONCURRENCY = 3;
const AI_RESUME_CHARS = 9000;

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function titleCaseNameToken(word = '') {
  const w = String(word || '').trim();
  if (!w) return '';
  if (w.length <= 2 && /^[A-Z.]+$/i.test(w)) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function asPersonName(firstName = '', lastName = '') {
  const parts = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(titleCaseNameToken);
  if (parts.length < 2) return { firstName: '', lastName: '' };
  const next = {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
  const full = `${next.firstName} ${next.lastName}`.trim();
  if (!looksLikePersonName(full)) return { firstName: '', lastName: '' };
  return next;
}

async function extractCandidateNameWithOpenAi(resumeText = '', fileName = '') {
  const text = String(resumeText || '').trim();
  if (!text || !hasLlmProvider()) return { firstName: '', lastName: '' };

  const capped = text.length > AI_RESUME_CHARS ? `${text.slice(0, AI_RESUME_CHARS)}\n…` : text;
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
              'You extract a candidate person name from a resume. Return JSON only. Never invent a name.',
          },
          {
            role: 'user',
            content: `Extract the candidate's real person name from this CV.

Return only JSON: {"firstName":"","lastName":""}

Rules:
- Use the person's given and family name as written on the CV (usually the header).
- Keep particles such as de, van, el, bin.
- Never use the file name, Curriculum Vitae, job titles, companies, cities, countries, section headers, or Unknown Candidate.
- If the name is unclear, return empty strings.

File name (do not use as the person name): ${fileName || 'resume'}

Resume text:
${capped}`,
          },
        ],
      },
      'repair-names',
      { quiet: true },
    );
    const content = completion?.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(content) || {};
    return asPersonName(parsed.firstName, parsed.lastName);
  } catch (error) {
    console.warn('[repair-names] OpenAI name parse failed:', error?.message || error);
    return { firstName: '', lastName: '' };
  }
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
 * Find candidates with garbage names and fix them from stored resume text (no AI).
 * Tenant-scoped via prisma ALS. Preserves bulk "Copy N" suffixes when present.
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
        const heuristic = extractResumeName(text, source.fileName);
        extracted = asPersonName(heuristic.firstName, heuristic.lastName);
        if (extracted.firstName) {
          sourceUsed = 'resume';
        } else {
          // Heuristic name was insufficient — re-parse the CV with OpenAI.
          extracted = await extractCandidateNameWithOpenAi(text, source.fileName);
          if (extracted.firstName) {
            sourceUsed = 'openai';
          } else {
            skipReason = 'unparseable';
          }
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

    if (!looksLikePersonName(extractedFull)) {
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
