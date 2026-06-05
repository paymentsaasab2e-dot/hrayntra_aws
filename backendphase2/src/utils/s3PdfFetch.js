import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getLatestCandidateResumeFileUrl } from '../modules/candidate/candidate-file.service.js';
import {
  getS3AppFolder,
  getS3Bucket,
  getS3Client,
  getS3ObjectBodyBuffer,
  isOurS3PdfUrl,
  parseOurS3Url,
  uploadContentTypeForFile,
} from './s3.js';

const PDF_MAGIC = Buffer.from('%PDF', 'ascii');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RESUME_FILE_PATTERN = /\.(pdf|png|jpe?g|gif|webp|txt)$/i;

const TENANT_SEGMENTS_TO_TRY = ['gho01', 'default'];

function isNoSuchKeyError(err) {
  const code = err?.name || err?.Code || err?.code || '';
  const msg = String(err?.message || '');
  return (
    code === 'NoSuchKey' ||
    /not found/i.test(msg) ||
    /specified key does not exist/i.test(msg)
  );
}

/** Extract CRM candidate id from stored resume S3 / proxy URLs. */
export function extractCandidateIdFromResumeStorageUrl(urlString) {
  const s = String(urlString || '');
  const patterns = [
    /\/candidates\/([a-f0-9]{24})\/resumes\//i,
    /\/candidates\/([a-f0-9]{24})\/jobportal\/cv-files\//i,
    /uploads\/phase1\/candidates\/([a-f0-9]{24})\//i,
    /uploads\/phase2\/tenants\/[^/]+\/jobportal\/candidates\/([a-f0-9]{24})\//i,
    /\/candidates\/([a-f0-9]{24})\//i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function basenameFromKey(key) {
  const parts = String(key || '').split('/');
  return parts[parts.length - 1] || '';
}

/** Try legacy + encoding + phase1→phase2 migration when the exact key from the URL is missing. */
export function buildAlternateS3ObjectKeys(key) {
  const keys = new Set();
  const add = (k) => {
    const trimmed = String(k || '').trim();
    if (trimmed) keys.add(trimmed);
  };

  add(key);
  try {
    add(decodeURIComponent(key));
  } catch {
    /* ignore */
  }
  add(String(key).replace(/\+/g, ' '));

  const phase2 = String(key).match(/^uploads\/phase2\/tenants\/[^/]+\/(.+)$/);
  if (phase2) add(`uploads/${phase2[1]}`);

  const legacy = String(key).match(/^uploads\/jobportal\/(.+)$/);
  if (legacy) {
    for (const tenant of TENANT_SEGMENTS_TO_TRY) {
      add(`uploads/phase2/tenants/${tenant}/jobportal/${legacy[1]}`);
    }
  }

  const phase1Cv = String(key).match(
    /^uploads\/phase1\/candidates\/([a-f0-9]{24})\/jobportal\/cv-files\/(.+)$/i
  );
  if (phase1Cv) {
    const [, candidateId, filename] = phase1Cv;
    for (const tenant of TENANT_SEGMENTS_TO_TRY) {
      add(
        `uploads/phase2/tenants/${tenant}/jobportal/candidates/${candidateId}/resumes/${filename}`
      );
    }
    add(`uploads/jobportal/candidates/${candidateId}/resumes/${filename}`);
  }

  const phase1Candidate = String(key).match(/^uploads\/phase1\/candidates\/([a-f0-9]{24})\/(.+)$/i);
  if (phase1Candidate) {
    const [, candidateId, rest] = phase1Candidate;
    const filename = basenameFromKey(rest) || rest;
    for (const tenant of TENANT_SEGMENTS_TO_TRY) {
      add(
        `uploads/phase2/tenants/${tenant}/jobportal/candidates/${candidateId}/resumes/${filename}`
      );
    }
  }

  return [...keys];
}

export function detectResumeContentType(buf, key = '') {
  if (buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC)) {
    return 'application/pdf';
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buf.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const fromKey = uploadContentTypeForFile('', basenameFromKey(key));
  if (fromKey === 'text/plain') return fromKey;
  if (looksLikePlainText(buf)) return 'text/plain';
  return fromKey;
}

function looksLikePlainText(buf) {
  if (!buf?.length) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  let nonText = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const b = sample[i];
    if (b === 9 || b === 10 || b === 13) continue;
    if (b >= 32 && b <= 126) continue;
    if (b >= 128) continue;
    nonText += 1;
  }
  return nonText / sample.length < 0.05;
}

async function readS3ObjectByKey(key) {
  return getS3ObjectBodyBuffer(key);
}

async function tryFetchPublicDocumentUrl(url) {
  const upstream = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: '*/*' },
  });
  if (!upstream.ok) return null;
  return Buffer.from(await upstream.arrayBuffer());
}

/** Discover a resume file in S3 when the stored URL points at a removed phase1 key. */
async function discoverResumeFileKeyForCandidate(candidateId) {
  const id = String(candidateId || '').trim();
  if (!id) return null;

  const bucket = getS3Bucket();
  const client = getS3Client();
  const appFolder = getS3AppFolder();

  const prefixes = [
    ...TENANT_SEGMENTS_TO_TRY.map(
      (tenant) => `uploads/${appFolder}/tenants/${tenant}/jobportal/candidates/${id}/resumes/`
    ),
    `uploads/phase1/candidates/${id}/jobportal/cv-files/`,
    `uploads/phase1/candidates/${id}/`,
    `uploads/jobportal/candidates/${id}/resumes/`,
  ];

  for (const prefix of prefixes) {
    try {
      const out = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 25,
        })
      );
      const objects = (out.Contents || [])
        .filter((o) => o.Key && RESUME_FILE_PATTERN.test(o.Key))
        .sort((a, b) => {
          const ta = b.LastModified?.getTime() || 0;
          const tb = a.LastModified?.getTime() || 0;
          return ta - tb;
        });
      if (objects[0]?.Key) return objects[0].Key;
    } catch {
      /* try next prefix */
    }
  }

  return null;
}

/**
 * Load resume document bytes for an allowed S3 resume URL, with key variants + DB/S3 discovery fallback.
 */
export async function fetchS3ResumeDocumentBuffer(decodedUrl, options = {}) {
  const retried = Boolean(options._retried);
  const parsed = parseOurS3Url(decodedUrl);
  if (!parsed?.key) {
    throw new Error('Invalid S3 URL');
  }

  try {
    const publicBuf = await tryFetchPublicDocumentUrl(decodedUrl);
    if (publicBuf) return { buffer: publicBuf, key: parsed.key };
  } catch {
    /* fall through to signed S3 */
  }

  let lastErr = null;
  for (const key of buildAlternateS3ObjectKeys(parsed.key)) {
    try {
      const buffer = await readS3ObjectByKey(key);
      return { buffer, key };
    } catch (err) {
      lastErr = err;
      if (!isNoSuchKeyError(err)) throw err;
    }
  }

  if (!retried) {
    const candidateId = extractCandidateIdFromResumeStorageUrl(decodedUrl);
    if (candidateId) {
      const discoveredKey = await discoverResumeFileKeyForCandidate(candidateId);
      if (discoveredKey && discoveredKey !== parsed.key) {
        try {
          const buffer = await readS3ObjectByKey(discoveredKey);
          return { buffer, key: discoveredKey };
        } catch (err) {
          lastErr = err;
          if (!isNoSuchKeyError(err)) throw err;
        }
      }

      const altUrl = await getLatestCandidateResumeFileUrl(candidateId, { skipUrl: decodedUrl });
      if (altUrl && altUrl !== decodedUrl && isOurS3PdfUrl(altUrl)) {
        return fetchS3ResumeDocumentBuffer(altUrl, { _retried: true });
      }
    }
  }

  throw lastErr || new Error('The specified key does not exist.');
}

/** @deprecated use fetchS3ResumeDocumentBuffer */
export async function fetchS3ResumePdfBuffer(decodedUrl, options = {}) {
  const { buffer } = await fetchS3ResumeDocumentBuffer(decodedUrl, options);
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error('Not a valid PDF');
  }
  return buffer;
}
