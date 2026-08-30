const { mapContractType, mapWorkingHours } = require('./employment');
const { resolveCountryName } = require('./countries');
const { jobToXml, wrapJobsXml, locationXml } = require('./xml');
const {
  envFlag,
  wantsCareerjetPublish,
  evaluateEligibility,
} = require('./eligibility');

function portalFrontendBase() {
  const raw =
    process.env.JOB_PORTAL_FRONTEND_URL ||
    process.env.PHASE1_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000';
  return String(raw).trim().replace(/\/+$/, '');
}

function publicJobUrl(jobId, portalBase = portalFrontendBase()) {
  return `${portalBase}/explore-jobs?job=${encodeURIComponent(jobId)}&utm_source=careerjet`;
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

function companyUrl(job) {
  if (!shouldShowCompany(job)) return '';
  const raw = String(job.client?.website || job.company?.website || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
}

function cityLine(job) {
  return String(job.city || '').trim() || String(job.location || '').trim();
}

function regionLine(job) {
  return String(job.state || '').trim();
}

function salaryFrequencySuffix(job) {
  const salary = job.salary && typeof job.salary === 'object' ? job.salary : {};
  const freqRaw = String(salary.frequency || salary.type || job.salaryType || '').toLowerCase();
  if (!freqRaw.trim()) return '';
  if (/hour/.test(freqRaw)) return ' per hour';
  if (/day/.test(freqRaw)) return ' per day';
  if (/week/.test(freqRaw)) return ' per week';
  if (/month/.test(freqRaw)) return ' per month';
  if (/year|annual/.test(freqRaw)) return ' per year';
  return '';
}

function salaryDisplay(job) {
  const salary = job.salary && typeof job.salary === 'object' ? job.salary : {};
  const min = Number(salary.min ?? job.salaryMin);
  const max = Number(salary.max ?? job.salaryMax);
  const currency = String(salary.currency || job.salaryCurrency || '').trim();
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  if (!hasMin && !hasMax) return '';
  const range =
    hasMin && hasMax ? `${Math.round(min)} - ${Math.round(max)}` : String(Math.round(hasMin ? min : max));
  const base = currency ? `${currency} ${range}` : range;
  return `${base}${salaryFrequencySuffix(job)}`;
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
        client: { select: { companyName: true, website: true } },
        company: { select: { name: true, website: true } },
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
      projection: { companyName: 1, website: 1 },
    });
    for (const row of clients?.cursor?.firstBatch || clients?.documents || []) {
      clientById.set(mongoId(row._id), {
        companyName: row.companyName || '',
        website: row.website || '',
      });
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
  if (!String(portalBase || '').trim()) return { ok: false, reason: 'missing_url' };
  const url = publicJobUrl(id, portalBase);
  if (!url || !url.includes('/explore-jobs?job=')) return { ok: false, reason: 'missing_url' };
  if (!cityLine(job) && !regionLine(job)) return { ok: false, reason: 'missing_location' };
  if (!resolveCountryName(job)) return { ok: false, reason: 'missing_country' };
  return { ok: true, description, url };
}

function mapJobToXmlFields(job, { description, url }) {
  const country = resolveCountryName(job);
  const company = companyName(job);
  const fields = [
    { tag: 'id', value: String(job.id) },
    { tag: 'title', value: String(job.title).trim() },
    { tag: 'url', value: url },
    {
      raw: locationXml({
        city: cityLine(job),
        region: regionLine(job),
        country,
      }),
    },
  ];
  if (company) fields.push({ tag: 'company', value: company });
  const site = companyUrl(job);
  if (site) fields.push({ tag: 'company_url', value: site });
  fields.push({ tag: 'description', value: description });
  fields.push({ tag: 'contract_type', value: mapContractType(job.type, job.employmentType) });
  fields.push({ tag: 'working_hours', value: mapWorkingHours(job.type, job.employmentType) });
  const salary = salaryDisplay(job);
  if (salary) fields.push({ tag: 'salary', value: salary });
  fields.push({ tag: 'apply_url', value: url });
  return fields;
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
      console.info(`[careerjet-feed] skipped job ${job.id || '(no-id)'}: ${validated.reason}`);
      continue;
    }

    if (seenIds.has(String(job.id))) {
      stats.skipped += 1;
      stats.skipReasons.duplicate_id = (stats.skipReasons.duplicate_id || 0) + 1;
      continue;
    }
    seenIds.add(String(job.id));

    try {
      xmlNodes.push(jobToXml(mapJobToXmlFields(job, validated)));
      stats.exported += 1;
    } catch (error) {
      stats.skipped += 1;
      stats.skipReasons.xml_error = (stats.skipReasons.xml_error || 0) + 1;
      console.info(
        `[careerjet-feed] skipped job ${job.id || '(no-id)'}: xml_error ${error?.message || error}`,
      );
    }
  }

  return { xml: wrapJobsXml(xmlNodes), stats };
}

async function generateCareerjetFeed(prismaClient) {
  const started = Date.now();
  try {
    const jobs = await findRawJobs(prismaClient);
    const result = buildFeedFromJobs(jobs);
    console.info(
      `[careerjet-feed] scanned=${jobs.length} eligible=${result.stats.totalEligible} exported=${result.stats.exported} skipped=${result.stats.skipped} validationFailures=${result.stats.validationFailures} ms=${Date.now() - started}`,
      result.stats.skipReasons,
    );
    return result;
  } catch (error) {
    console.error('[careerjet-feed] XML generation error:', error?.message || error);
    throw error;
  }
}

module.exports = {
  portalFrontendBase,
  publicJobUrl,
  wantsCareerjetPublish,
  envFlag,
  validateExportableJob,
  buildFeedFromJobs,
  generateCareerjetFeed,
  mapContractType,
  mapWorkingHours,
  resolveCountryName,
  salaryDisplay,
};
