const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const {
  getS3Bucket,
  getS3Client,
  getS3ObjectBodyBuffer,
  parseOurS3Url,
} = require('./s3');

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

function basenameFromKey(key) {
  const parts = String(key || '').split('/');
  return parts[parts.length - 1] || '';
}

function directoryPrefixFromKey(key) {
  const base = String(key || '').trim();
  const idx = base.lastIndexOf('/');
  return idx >= 0 ? base.slice(0, idx + 1) : '';
}

/** Strip `{candidateId}_{timestamp}_` storage prefix from object basename. */
function extractOriginalFilenameFromStorageKey(key) {
  const base = basenameFromKey(key);
  const m = base.match(/^[a-f0-9]{24}_\d+_(.+)$/i);
  return m ? m[1] : base;
}

function fileExtension(name) {
  const m = String(name || '').match(/(\.[a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

/** Extract candidate id from stored profile document URLs. */
function extractCandidateIdFromStorageUrl(urlString) {
  const s = String(urlString || '');
  const patterns = [
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

function buildAlternateS3ObjectKeys(key) {
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

  const phase1 = String(key).match(/^uploads\/phase1\/candidates\/([a-f0-9]{24})\/(.+)$/i);
  if (phase1) {
    const [, candidateId, rest] = phase1;
    const filename = basenameFromKey(rest) || rest;
    for (const tenant of TENANT_SEGMENTS_TO_TRY) {
      add(
        `uploads/phase2/tenants/${tenant}/jobportal/candidates/${candidateId}/resumes/${filename}`
      );
    }
    add(`uploads/jobportal/candidates/${candidateId}/resumes/${filename}`);
  }

  return [...keys];
}

async function tryFetchPublicUrl(url) {
  const upstream = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: '*/*' },
  });
  if (!upstream.ok) return null;
  return Buffer.from(await upstream.arrayBuffer());
}

async function readS3ObjectByKey(key) {
  return getS3ObjectBodyBuffer(key);
}

/** When the exact key is missing, find the newest object with the same logical filename. */
async function discoverDocumentKeyByPrefix(parsedKey, decodedUrl) {
  const prefix = directoryPrefixFromKey(parsedKey);
  if (!prefix) return null;

  const wantedName = extractOriginalFilenameFromStorageKey(parsedKey);
  const wantedExt = fileExtension(wantedName);
  const candidateId = extractCandidateIdFromStorageUrl(decodedUrl);

  const prefixes = new Set([prefix]);
  if (candidateId) {
    prefixes.add(`uploads/phase1/candidates/${candidateId}/jobportal/cv-files/`);
    for (const tenant of TENANT_SEGMENTS_TO_TRY) {
      prefixes.add(
        `uploads/phase2/tenants/${tenant}/jobportal/candidates/${candidateId}/resumes/`
      );
    }
    prefixes.add(`uploads/phase1/candidates/${candidateId}/`);
  }

  const client = getS3Client();
  const bucket = getS3Bucket();
  let best = null;

  for (const listPrefix of prefixes) {
    try {
      const out = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: listPrefix,
          MaxKeys: 100,
        })
      );

      for (const obj of out.Contents || []) {
        if (!obj.Key) continue;
        const logical = extractOriginalFilenameFromStorageKey(obj.Key);
        const ext = fileExtension(logical);
        const nameMatches =
          logical === wantedName ||
          logical.endsWith(wantedName) ||
          wantedName.endsWith(logical) ||
          basenameFromKey(obj.Key) === basenameFromKey(parsedKey);

        if (!nameMatches) continue;
        if (wantedExt && ext && wantedExt !== ext) continue;

        const ts = obj.LastModified?.getTime() || 0;
        if (!best || ts > best.ts) {
          best = { key: obj.Key, ts };
        }
      }
    } catch {
      /* try next prefix */
    }
  }

  return best?.key || null;
}

/**
 * Load document bytes for an allowed S3 URL, with key variants + prefix discovery fallback.
 */
async function fetchS3DocumentBuffer(decodedUrl, options = {}) {
  const retried = Boolean(options._retried);
  const parsed = parseOurS3Url(decodedUrl);
  if (!parsed?.key) {
    throw new Error('Invalid S3 URL');
  }

  try {
    const publicBuf = await tryFetchPublicUrl(decodedUrl);
    if (publicBuf?.length) return publicBuf;
  } catch {
    /* fall through to signed S3 */
  }

  let lastErr = null;
  for (const key of buildAlternateS3ObjectKeys(parsed.key)) {
    try {
      return await readS3ObjectByKey(key);
    } catch (err) {
      lastErr = err;
      if (!isNoSuchKeyError(err)) throw err;
    }
  }

  if (!retried) {
    const discoveredKey = await discoverDocumentKeyByPrefix(parsed.key, decodedUrl);
    if (discoveredKey && discoveredKey !== parsed.key) {
      try {
        return await readS3ObjectByKey(discoveredKey);
      } catch (err) {
        lastErr = err;
        if (!isNoSuchKeyError(err)) throw err;
      }
    }
  }

  throw lastErr || new Error('The specified key does not exist.');
}

module.exports = {
  fetchS3DocumentBuffer,
  buildAlternateS3ObjectKeys,
  extractCandidateIdFromStorageUrl,
};
