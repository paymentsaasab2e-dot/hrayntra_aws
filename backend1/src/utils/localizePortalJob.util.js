const { translateBatch, translateCompanyName } = require('../services/contentTranslation.service');

function collectTranslatableStrings(job) {
  const entries = [];
  if (job?.title) entries.push({ field: 'title', text: String(job.title).trim() });
  if (job?.location) entries.push({ field: 'location', text: String(job.location).trim() });
  if (job?.company) entries.push({ field: 'company', text: String(job.company).trim() });
  return entries;
}

async function applyLocalizedFields(job, locale, translations, companyTranslations) {
  const localized = { ...job };
  const entries = collectTranslatableStrings(job);
  if (!entries.length) return localized;

  localized.sourceTitle = job.title ?? null;
  localized.sourceLocation = job.location ?? null;
  localized.sourceCompany = job.company ?? null;

  for (const entry of entries) {
    if (entry.field === 'company') {
      localized.company = companyTranslations.get(entry.text) || entry.text;
      continue;
    }
    localized[entry.field] = translations.get(entry.text) || entry.text;
  }

  return localized;
}

async function localizePortalJob(job, locale) {
  if (!job || locale === 'en') return job;

  const entries = collectTranslatableStrings(job);
  if (!entries.length) return job;

  const titleLocationTexts = entries
    .filter((entry) => entry.field !== 'company')
    .map((entry) => entry.text);
  const companyTexts = entries
    .filter((entry) => entry.field === 'company')
    .map((entry) => entry.text);

  const translations = await translateBatch(titleLocationTexts, locale, 'en');
  const companyTranslations = new Map();
  for (const text of [...new Set(companyTexts)]) {
    companyTranslations.set(text, await translateCompanyName(text, locale, 'en'));
  }

  return applyLocalizedFields(job, locale, translations, companyTranslations);
}

async function localizePortalJobs(jobs, locale) {
  if (!Array.isArray(jobs) || !jobs.length || locale === 'en') {
    return jobs;
  }

  const titleLocationTexts = [];
  const companyTexts = [];
  for (const job of jobs) {
    for (const entry of collectTranslatableStrings(job)) {
      if (entry.field === 'company') companyTexts.push(entry.text);
      else titleLocationTexts.push(entry.text);
    }
  }

  const translations = await translateBatch(titleLocationTexts, locale, 'en');
  const companyTranslations = new Map();
  for (const text of [...new Set(companyTexts)]) {
    companyTranslations.set(text, await translateCompanyName(text, locale, 'en'));
  }

  return Promise.all(
    jobs.map((job) => applyLocalizedFields(job, locale, translations, companyTranslations)),
  );
}

module.exports = {
  localizePortalJob,
  localizePortalJobs,
};
