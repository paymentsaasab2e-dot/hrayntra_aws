const crypto = require('crypto');
const { mapAdzunaCategory } = require('./categories');
const { jobToXml, wrapJobsXml } = require('./xml');
const {
  envFlag,
  wantsAdzunaPublish,
  resolveCountry,
  evaluateEligibility,
  toIsoDateString,
} = require('./eligibility');

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isFeedTokenValid(req) {
  const expected = String(process.env.ADZUNA_FEED_TOKEN || '').trim();
  if (!expected) return true;
  const got = String(req.query?.token || req.headers?.['x-adzuna-feed-token'] || '').trim();
  return timingSafeEqual(got, expected);
}

function portalFrontendBase() {
  const raw =
    process.env.JOB_PORTAL_FRONTEND_URL ||
    process.env.PHASE1_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000';
  return String(raw).trim().replace(/\/+$/, '');
}

function publicJobUrl(jobId, portalBase = portalFrontendBase()) {
  return `${portalBase}/explore-jobs?job=${encodeURIComponent(jobId)}&utm_source=adzuna`;
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlEscapeLite(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDescriptionHtml(job) {
  const chunks = [];
  const description = String(job.description || '').trim();
  const overview = String(job.overview || job.aboutRole || '').trim();
  if (description) chunks.push(description);
  else if (overview) chunks.push(`<p>${xmlEscapeLite(overview)}</p>`);

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
      .map((item) => `<li>${xmlEscapeLite(item)}</li>`)
      .join('');
    if (lis) chunks.push(`<h3>${heading}</h3><ul>${lis}</ul>`);
  }
  return chunks.join('\n').trim();
}

function shouldShowCompany(job) {
  if (job?.showClientNamePublicly === false) return false;
  if (job?.hqHideClientName === true) return false;
  const visibility = job?.publicFieldVisibility;
  if (visibility && typeof visibility === 'object' && visibility.client === false) return false;
  return true;
}

function companyName(job) {
  if (!shouldShowCompany(job)) return '';
  return (
    String(job.client?.companyName || '').trim() ||
    String(job.company?.name || '').trim()
  );
}

function locationLine(job) {
  const parts = [job.city, job.location, job.state]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  return unique[0] || '';
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

function salaryFields(job) {
  const salary = job.salary && typeof job.salary === 'object' ? job.salary : {};
  const min = Number(salary.min ?? job.salaryMin);
  const max = Number(salary.max ?? job.salaryMax);
  const currency = String(salary.currency || job.salaryCurrency || '').trim();
  const freqRaw = String(salary.frequency || job.salaryType || '').toLowerCase();
  const frequency = /hour/.test(freqRaw)
    ? 'hour'
    : /day/.test(freqRaw)
      ? 'day'
      : /month/.test(freqRaw)
        ? 'month'
        : freqRaw
          ? 'year'
          : '';
  const out = {};
  if (Number.isFinite(min) && min > 0) out.salary_min = String(Math.round(min));
  if (Number.isFinite(max) && max > 0) out.salary_max = String(Math.round(max));
  if (currency) out.salary_currency = currency;
  if (frequency) out.salary_frequency = frequency;
  return out;
}

function mongoId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.$oid) return String(value.$oid);
  return String(value);
}

function normalizeRawJob(doc, clientById = new Map()) {
  const id = mongoId(doc._id) || mongoId(doc.id);
  const clientId = mongoId(doc.clientId);
  return {
    ...doc,
    id,
    clientId: clientId || null,
    client: clientById.get(clientId) || doc.client || null,
    company: doc.company || null,
  };
}

async function findRawJobs(prismaClient) {
  if (typeof prismaClient?.$runCommandRaw !== 'function') {
    return prismaClient.job.findMany({
      take: 2000,
      include: {
        client: { select: { companyName: true } },
        company: { select: { name: true } },
      },
    });
  }
  const result = await prismaClient.$runCommandRaw({
    find: 'jobs',
    filter: {},
    sort: { postedDate: -1 },
    limit: 2000,
  });
  const docs = result?.cursor?.firstBatch || result?.documents || [];
  const clientIds = [
    ...new Set(docs.map((doc) => mongoId(doc.clientId)).filter((id) => /^[a-fA-F0-9]{24}$/.test(id))),
  ];
  const clientById = new Map();
  if (clientIds.length) {
    const clients = await prismaClient.$runCommandRaw({
      find: 'clients',
      filter: { _id: { $in: clientIds.map((id) => ({ $oid: id })) } },
      projection: { companyName: 1 },
    });
    for (const row of clients?.cursor?.firstBatch || clients?.documents || []) {
      clientById.set(mongoId(row._id), { companyName: row.companyName || '' });
    }
  }
  return docs.map((doc) => normalizeRawJob(doc, clientById));
}

function validateExportableJob(job, portalBase) {
  const id = String(job?.id || '').trim();
  if (!id) return { ok: false, reason: 'missing_id' };
  if (!String(job.title || '').trim()) return { ok: false, reason: 'missing_title' };
  const description = buildDescriptionHtml(job);
  if (!stripTags(description)) return { ok: false, reason: 'missing_description' };
  const url = publicJobUrl(id, portalBase);
  if (!url) return { ok: false, reason: 'missing_url' };
  if (!locationLine(job)) return { ok: false, reason: 'missing_location' };
  if (!resolveCountry(job)) return { ok: false, reason: 'missing_country' };
  return { ok: true, description, url };
}

function mapJobToXmlFields(job, { description, url }) {
  const salary = salaryFields(job);
  const category = mapAdzunaCategory(job);
  const date = toIsoDateString(job.postedAt || job.postedDate || job.createdAt || job.updatedAt);
  const company = companyName(job);
  const fields = [
    ['title', String(job.title).trim()],
    ['id', String(job.id)],
    ['description', description, { raw: true }],
    ['url', url],
    ['location', locationLine(job)],
    ['country', resolveCountry(job)],
    ['remote', isRemote(job)],
    ['contract_type', mapContractType(job.type || job.employmentType)],
    ['contract_time', mapContractTime(job.type, job.employmentType)],
  ];
  if (company) fields.push(['company', company]);
  if (category.mapped) fields.push(['category', category.id]);
  if (date) fields.push(['date', date]);
  if (salary.salary_min) fields.push(['salary_min', salary.salary_min]);
  if (salary.salary_max) fields.push(['salary_max', salary.salary_max]);
  if (salary.salary_frequency) fields.push(['salary_frequency', salary.salary_frequency]);
  if (salary.salary_currency) fields.push(['salary_currency', salary.salary_currency]);
  if (job.geo_lat || job.geoLat) fields.push(['geo_lat', job.geo_lat || job.geoLat]);
  if (job.geo_lng || job.geoLng) fields.push(['geo_lng', job.geo_lng || job.geoLng]);
  if (job.postcode || job.postalCode) fields.push(['postcode', job.postcode || job.postalCode]);
  return { fields, category };
}

function buildFeedFromJobs(jobs, { portalBase = portalFrontendBase() } = {}) {
  const stats = {
    totalEligible: 0,
    exported: 0,
    skipped: 0,
    validationFailures: 0,
    skipReasons: {},
  };
  const xmlNodes = [];
  const seenIds = new Set();

  for (const job of jobs) {
    const eligibility = evaluateEligibility(job);
    if (!eligibility.ok) {
      stats.skipped += 1;
      stats.skipReasons[eligibility.reason] = (stats.skipReasons[eligibility.reason] || 0) + 1;
      continue;
    }
    stats.totalEligible += 1;

    const validated = validateExportableJob(job, portalBase);
    if (!validated.ok) {
      stats.skipped += 1;
      stats.validationFailures += 1;
      stats.skipReasons[validated.reason] = (stats.skipReasons[validated.reason] || 0) + 1;
      console.info(`[adzuna-feed] skipped job ${job.id || '(no-id)'}: ${validated.reason}`);
      continue;
    }

    if (seenIds.has(String(job.id))) {
      stats.skipped += 1;
      stats.skipReasons.duplicate_id = (stats.skipReasons.duplicate_id || 0) + 1;
      continue;
    }
    seenIds.add(String(job.id));

    try {
      const mapped = mapJobToXmlFields(job, validated);
      if (!mapped.category.mapped && mapped.category.reason === 'unmapped_category') {
        console.info(
          `[adzuna-feed] category unmapped for job ${job.id}: ${mapped.category.source || '(empty)'}`,
        );
      }
      xmlNodes.push(jobToXml(mapped.fields));
      stats.exported += 1;
    } catch (error) {
      stats.skipped += 1;
      stats.skipReasons.xml_error = (stats.skipReasons.xml_error || 0) + 1;
      console.info(
        `[adzuna-feed] skipped job ${job.id || '(no-id)'}: xml_error ${error?.message || error}`,
      );
    }
  }

  return {
    xml: wrapJobsXml(xmlNodes),
    stats,
  };
}

async function generateAdzunaFeed(prismaClient) {
  const started = Date.now();
  try {
    const jobs = await findRawJobs(prismaClient);
    const result = buildFeedFromJobs(jobs);
    console.info(
      `[adzuna-feed] scanned=${jobs.length} eligible=${result.stats.totalEligible} exported=${result.stats.exported} skipped=${result.stats.skipped} validationFailures=${result.stats.validationFailures} ms=${Date.now() - started}`,
      result.stats.skipReasons,
    );
    return result;
  } catch (error) {
    console.error('[adzuna-feed] XML generation error:', error?.message || error);
    throw error;
  }
}

module.exports = {
  isFeedTokenValid,
  portalFrontendBase,
  publicJobUrl,
  wantsAdzunaPublish,
  envFlag,
  buildDescriptionHtml,
  validateExportableJob,
  buildFeedFromJobs,
  generateAdzunaFeed,
  findRawJobs,
};
