/**
 * Adzuna integration (Phase 2).
 *
 * app_id + app_key are Search API credentials — they cannot post jobs.
 * Organic listings: XML feed Adzuna crawls after they accept our public URL.
 */

import crypto from 'crypto';
import { env } from '../../config/env.js';
import { getJobPortalPrismaClient } from '../../config/prisma.js';

const ADZUNA_COUNTRIES = new Set([
  'AU', 'AT', 'BE', 'BR', 'CA', 'CH', 'FR', 'DE', 'ES', 'IN', 'IT', 'MX', 'NL', 'NZ', 'PL', 'SG', 'ZA', 'UK', 'US',
]);

export function wantsAdzunaPublish(platforms) {
  if (!platforms || typeof platforms !== 'object') return false;
  return platforms.adzuna === true;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isAdzunaFeedTokenValid(req) {
  const expected = String(env.ADZUNA_FEED_TOKEN || '').trim();
  if (!expected) return true;
  const got = String(req.query?.token || req.headers?.['x-adzuna-feed-token'] || '').trim();
  return timingSafeEqual(got, expected);
}

function portalFrontendBase() {
  const raw =
    process.env.JOB_PORTAL_FRONTEND_URL ||
    process.env.PHASE1_FRONTEND_URL ||
    'http://localhost:3000';
  return String(raw).trim().replace(/\/+$/, '');
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cdata(value) {
  return String(value ?? '').replace(/]]>/g, ']]&gt;');
}

function mapCountry(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'IN';
  const upper = v.toUpperCase();
  if (upper === 'GB' || upper === 'UNITED KINGDOM' || upper === 'GREAT BRITAIN') return 'UK';
  if (ADZUNA_COUNTRIES.has(upper)) return upper;
  const names = {
    INDIA: 'IN',
    'UNITED STATES': 'US',
    USA: 'US',
    AUSTRALIA: 'AU',
    CANADA: 'CA',
    SINGAPORE: 'SG',
    GERMANY: 'DE',
    FRANCE: 'FR',
    SPAIN: 'ES',
    ITALY: 'IT',
    NETHERLANDS: 'NL',
    'NEW ZEALAND': 'NZ',
    'SOUTH AFRICA': 'ZA',
    BRAZIL: 'BR',
    MEXICO: 'MX',
    POLAND: 'PL',
    AUSTRIA: 'AT',
    BELGIUM: 'BE',
    SWITZERLAND: 'CH',
  };
  return names[upper] || 'IN';
}

function mapContractType(type) {
  const v = String(type || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (v.includes('CONTRACT') || v.includes('FREELANCE') || v.includes('TEMP') || v.includes('INTERN')) {
    return 'contract';
  }
  return 'permanent';
}

function mapContractTime(type, employmentType) {
  const v = `${type || ''} ${employmentType || ''}`.toUpperCase();
  if (v.includes('PART')) return 'part_time';
  return 'full_time';
}

function isRemote(job) {
  const v = `${job.workMode || ''} ${job.jobLocationType || ''} ${job.location || ''}`.toLowerCase();
  return /\bremote\b/.test(v) ? '1' : '0';
}

function shouldShowCompany(job) {
  if (job?.showClientNamePublicly === false) return false;
  const visibility = job?.publicFieldVisibility;
  if (visibility && typeof visibility === 'object' && visibility.client === false) return false;
  return true;
}

function companyName(job) {
  if (!shouldShowCompany(job)) return '';
  return String(job.client?.companyName || '').trim();
}

function locationLine(job) {
  const parts = [job.city, job.location, job.state, job.country]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  return unique[0] || job.country || 'India';
}

function salaryFields(job) {
  const salary = job.salary && typeof job.salary === 'object' ? job.salary : {};
  const min = Number(salary.min);
  const max = Number(salary.max);
  const currency = String(salary.currency || 'INR').trim() || 'INR';
  const freqRaw = String(salary.frequency || 'year').toLowerCase();
  const frequency = /hour/.test(freqRaw)
    ? 'hour'
    : /day/.test(freqRaw)
      ? 'day'
      : /month/.test(freqRaw)
        ? 'month'
        : 'year';
  const parts = {};
  if (Number.isFinite(min) && min > 0) parts.salary_min = String(Math.round(min));
  if (Number.isFinite(max) && max > 0) parts.salary_max = String(Math.round(max));
  parts.salary_currency = currency;
  parts.salary_frequency = frequency;
  if (parts.salary_min || parts.salary_max) {
    const range =
      parts.salary_min && parts.salary_max
        ? `${currency} ${parts.salary_min} – ${parts.salary_max}`
        : `${currency} ${parts.salary_min || parts.salary_max}`;
    parts.salary = `${range} per ${frequency === 'year' ? 'annum' : frequency}`;
  }
  return parts;
}

function buildDescriptionHtml(job) {
  const chunks = [];
  const description = String(job.description || '').trim();
  const overview = String(job.overview || '').trim();
  if (description) chunks.push(description);
  else if (overview) chunks.push(`<p>${xmlEscape(overview)}</p>`);

  const lists = [
    ['Key responsibilities', job.keyResponsibilities],
    ['Requirements', job.requirements],
    ['Candidate requirements', job.candidateRequirements],
    ['Preferred skills', job.preferredSkills],
    ['Skills', job.skills],
    ['Benefits', job.benefits],
  ];
  for (const [heading, items] of lists) {
    if (!Array.isArray(items) || items.length === 0) continue;
    const lis = items
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => `<li>${xmlEscape(item)}</li>`)
      .join('');
    if (lis) chunks.push(`<h3>${heading}</h3><ul>${lis}</ul>`);
  }
  let html = chunks.join('\n').trim();
  if (stripTags(html).length < 100) {
    const extra = [
      job.title && `We are hiring for ${job.title}.`,
      job.experienceRequired && `Experience: ${job.experienceRequired}.`,
      job.education && `Education: ${job.education}.`,
      'Apply online through the HRyantra job posting.',
    ]
      .filter(Boolean)
      .join(' ');
    html = `${html}<p>${xmlEscape(extra)}</p>`;
  }
  return html;
}

function isOpenJob(job) {
  if (job.isDeleted === true) return false;
  const status = String(job.status || '').toUpperCase();
  if (['CLOSED', 'FILLED', 'DRAFT', 'ON_HOLD'].includes(status)) return false;
  if (job.isActive === false) return false;
  if (job.expectedClosureDate) {
    const date = new Date(job.expectedClosureDate);
    if (!Number.isNaN(date.getTime()) && date.getTime() < Date.now()) return false;
  }
  return true;
}

function jobQualifiesForFeed(job, includeAll) {
  if (!isOpenJob(job)) return false;
  if (!String(job.title || '').trim()) return false;
  if (includeAll) return true;
  if (job.publishToAdzuna === true) return true;
  return wantsAdzunaPublish(job.distributionPlatforms);
}

function jobToXml(job, portalBase) {
  const title = String(job.title || '').trim();
  const description = buildDescriptionHtml(job);
  if (stripTags(description).length < 100) return '';
  const url = `${portalBase}/explore-jobs?job=${encodeURIComponent(job.id)}&utm_source=adzuna`;
  const country = mapCountry(job.country);
  const salary = salaryFields(job);
  const company = companyName(job);
  const date = job.postedDate || job.createdAt;
  const fields = [
    ['title', title],
    ['id', String(job.id)],
    ['url', url],
    ['location', locationLine(job)],
    ['country', country],
    ['remote', isRemote(job)],
    ['contract_type', mapContractType(job.type)],
    ['contract_time', mapContractTime(job.type, job.employmentType)],
  ];
  if (company) fields.push(['company', company]);
  if (job.jobCategory) fields.push(['category', String(job.jobCategory)]);
  if (date) fields.push(['date', new Date(date).toISOString()]);
  for (const [key, value] of Object.entries(salary)) {
    if (value) fields.push([key, value]);
  }
  const inner = [
    `    <description><![CDATA[${cdata(description)}]]></description>`,
    ...fields.map(([tag, value]) => `    <${tag}>${xmlEscape(value)}</${tag}>`),
  ].join('\n');
  return `  <job>\n${inner}\n  </job>`;
}

function buildJobsXml(jobs, portalBase) {
  const body = jobs
    .map((job) => jobToXml(job, portalBase))
    .filter(Boolean)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<jobs>\n${body}\n</jobs>\n`;
}

export async function verifyAdzunaSearchApi() {
  const appId = env.ADZUNA_APP_ID;
  const appKey = env.ADZUNA_APP_KEY;
  const country = env.ADZUNA_COUNTRY || 'in';
  if (!appId || !appKey) {
    return { ok: false, configured: false, message: 'ADZUNA_APP_ID / ADZUNA_APP_KEY not set' };
  }
  const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&results_per_page=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        configured: true,
        message: `Adzuna search API HTTP ${res.status}`,
        detail: text.slice(0, 240),
      };
    }
    const data = await res.json();
    return {
      ok: true,
      configured: true,
      country,
      count: Number(data?.count) || 0,
      message: 'Search API credentials are valid',
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message: error?.message || 'Adzuna search API request failed',
    };
  }
}

export async function listAdzunaFeedJobs() {
  const portalPrisma = getJobPortalPrismaClient();
  const includeAll = env.ADZUNA_FEED_INCLUDE_ALL;
  if (typeof portalPrisma?.$runCommandRaw !== 'function') {
    const jobs = await portalPrisma.job.findMany({
      take: 2000,
      include: {
        client: { select: { companyName: true } },
      },
      orderBy: [{ postedDate: 'desc' }, { createdAt: 'desc' }],
    });
    return jobs.filter((job) => jobQualifiesForFeed(job, includeAll));
  }

  const result = await portalPrisma.$runCommandRaw({
    find: 'jobs',
    filter: {},
    sort: { postedDate: -1 },
    limit: 2000,
  });
  const docs = result?.cursor?.firstBatch || result?.documents || [];
  const mongoId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value.$oid) return String(value.$oid);
    return String(value);
  };
  const clientIds = [
    ...new Set(docs.map((doc) => mongoId(doc.clientId)).filter((id) => /^[a-fA-F0-9]{24}$/.test(id))),
  ];
  const clientById = new Map();
  if (clientIds.length) {
    const clients = await portalPrisma.$runCommandRaw({
      find: 'clients',
      filter: { _id: { $in: clientIds.map((id) => ({ $oid: id })) } },
      projection: { companyName: 1 },
    });
    for (const row of clients?.cursor?.firstBatch || clients?.documents || []) {
      clientById.set(mongoId(row._id), { companyName: row.companyName || '' });
    }
  }
  return docs
    .map((doc) => ({
      ...doc,
      id: mongoId(doc._id) || mongoId(doc.id),
      clientId: mongoId(doc.clientId) || null,
      client: clientById.get(mongoId(doc.clientId)) || null,
    }))
    .filter((job) => jobQualifiesForFeed(job, includeAll));
}

export async function buildAdzunaXmlFeed() {
  const jobs = await listAdzunaFeedJobs();
  return buildJobsXml(jobs, portalFrontendBase());
}

export function adzunaFeedPublicUrl() {
  const backend = String(env.BACKEND_PUBLIC_URL || 'http://localhost:5001').replace(/\/+$/, '');
  const path = `${backend}/api/v1/adzuna/jobs.xml`;
  return path;
}

export async function getAdzunaStatus() {
  const search = await verifyAdzunaSearchApi();
  let feedJobCount = 0;
  try {
    const jobs = await listAdzunaFeedJobs();
    feedJobCount = jobs.length;
  } catch (error) {
    return {
      ...search,
      feedUrl: adzunaFeedPublicUrl(),
      feedJobCount: 0,
      feedError: error?.message || 'Could not load feed jobs',
    };
  }
  return {
    ...search,
    feedUrl: adzunaFeedPublicUrl(),
    feedJobCount,
    includeAllOpenJobs: env.ADZUNA_FEED_INCLUDE_ALL,
  };
}
