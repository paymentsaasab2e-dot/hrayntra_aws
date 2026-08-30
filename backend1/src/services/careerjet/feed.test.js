const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { wrapJobsXml, cdataEl } = require('./xml');
const { evaluateEligibility } = require('./eligibility');
const { resolveCountryName } = require('./countries');
const { mapContractType, mapWorkingHours } = require('./employment');
const { careerjetCategoryText } = require('./categories');
const { buildFeedFromJobs, validateExportableJob, salaryDisplay } = require('./feed.service');

const portalBase = 'http://localhost:3000';

function validJob(overrides = {}) {
  return {
    id: '64b000000000000000000011',
    title: 'Software Engineer',
    description: '<p>Build and ship backend APIs for our hiring platform with Node.js and MongoDB.</p>',
    location: 'Bengaluru',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    status: 'OPEN',
    isActive: true,
    publishToCareerjet: true,
    client: { companyName: 'Acme & Co', website: 'acme.example' },
    salary: { min: 800000, max: 1200000, currency: 'INR', frequency: 'year' },
    type: 'FULL_TIME',
    ...overrides,
  };
}

function assertValidXml(xml) {
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<jobs>/);
  assert.match(xml, /<\/jobs>\s*$/);
  const opens = (xml.match(/<job>/g) || []).length;
  const closes = (xml.match(/<\/job>/g) || []).length;
  assert.equal(opens, closes);
}

describe('Careerjet XML helpers', () => {
  it('XML is valid for an empty feed', () => {
    const xml = wrapJobsXml([]);
    assertValidXml(xml);
    assert.doesNotMatch(xml, /<job>/);
  });

  it('escapes special XML characters via CDATA split for ]]>', () => {
    const node = cdataEl('company', 'Acme ]]> Ltd & Co <Inc>');
    assert.match(node, /<!\[CDATA\[Acme ]]]]><!\[CDATA\[> Ltd & Co <Inc>]]>/);
  });
});

describe('Careerjet eligibility', () => {
  it('excludes draft, closed, filled, deleted, expired, inactive, and on-hold jobs', () => {
    const base = validJob();
    assert.equal(evaluateEligibility({ ...base, status: 'DRAFT' }).reason, 'draft');
    assert.equal(evaluateEligibility({ ...base, status: 'CLOSED' }).reason, 'closed');
    assert.equal(evaluateEligibility({ ...base, status: 'FILLED' }).reason, 'filled');
    assert.equal(evaluateEligibility({ ...base, status: 'ON_HOLD' }).reason, 'on_hold');
    assert.equal(evaluateEligibility({ ...base, isDeleted: true }).reason, 'deleted');
    assert.equal(evaluateEligibility({ ...base, isActive: false }).reason, 'inactive');
    assert.equal(
      evaluateEligibility({ ...base, expectedClosureDate: '2020-01-01T00:00:00.000Z' }).reason,
      'expired',
    );
  });

  it('requires Careerjet opt-in unless includeAll is set', () => {
    const base = validJob({ publishToCareerjet: false });
    assert.equal(evaluateEligibility(base).reason, 'careerjet_not_enabled');
    assert.equal(evaluateEligibility(base, { includeAll: true }).ok, true);
    assert.equal(
      evaluateEligibility({ ...base, distributionPlatforms: { careerjet: true } }).ok,
      true,
    );
  });
});

describe('Careerjet country and employment mapping', () => {
  it('maps India to India and does not invent a country', () => {
    assert.equal(resolveCountryName({ country: 'IN' }), 'India');
    assert.equal(resolveCountryName({ country: 'India' }), 'India');
    assert.equal(resolveCountryName({ location: 'London, United Kingdom' }), 'United Kingdom');
    assert.equal(resolveCountryName({}), null);
  });

  it('maps employment types to Careerjet XML words', () => {
    assert.equal(mapContractType('FULL_TIME'), 'permanent');
    assert.equal(mapWorkingHours('FULL_TIME'), 'full-time');
    assert.equal(mapWorkingHours('PART_TIME'), 'part-time');
    assert.equal(mapContractType('CONTRACT'), 'contract');
    assert.equal(mapContractType('INTERNSHIP'), 'internship');
    assert.equal(mapContractType('TEMPORARY'), 'temporary');
    assert.equal(mapContractType('FREELANCE'), 'contract');
  });
});

describe('Careerjet category helper', () => {
  it('returns internal category text and does not invent Adzuna numeric IDs', () => {
    assert.equal(careerjetCategoryText({ jobCategory: 'Software' }), 'Software');
    assert.equal(careerjetCategoryText({}), null);
  });
});

describe('Careerjet feed builder', () => {
  it('exports one valid opted-in job', () => {
    const { xml, stats } = buildFeedFromJobs([validJob()], { portalBase });
    assert.equal(stats.exported, 1);
    assertValidXml(xml);
    assert.match(xml, /<title><!\[CDATA\[Software Engineer]]><\/title>/);
    assert.match(xml, /<country><!\[CDATA\[India]]><\/country>/);
    assert.match(xml, /<company><!\[CDATA\[Acme & Co]]><\/company>/);
    assert.match(xml, /<contract_type><!\[CDATA\[permanent]]><\/contract_type>/);
    assert.match(xml, /<working_hours><!\[CDATA\[full-time]]><\/working_hours>/);
    assert.match(xml, /<salary><!\[CDATA\[INR 800000 - 1200000 per year]]><\/salary>/);
    assert.match(xml, /explore-jobs\?job=64b000000000000000000011/);
    assert.doesNotMatch(xml, /<category>/);
    assert.doesNotMatch(xml, /careerjet-apply-data/);
    assert.doesNotMatch(xml, /CAREERJET_API|apply_key|password|app_id|app_key/);
  });

  it('exports multiple valid jobs with unique ids', () => {
    const jobs = [
      validJob({ id: 'a1', title: 'Role A' }),
      validJob({ id: 'a2', title: 'Role B' }),
    ];
    const { xml, stats } = buildFeedFromJobs(jobs, { portalBase });
    assert.equal(stats.exported, 2);
    assert.match(xml, /<id><!\[CDATA\[a1]]><\/id>/);
    assert.match(xml, /<id><!\[CDATA\[a2]]><\/id>/);
  });

  it('excludes draft, closed, filled, deleted, expired, and Careerjet-disabled jobs', () => {
    const jobs = [
      validJob(),
      validJob({ id: '2', status: 'CLOSED', title: 'Closed Role' }),
      validJob({ id: '3', status: 'FILLED', title: 'Filled Role' }),
      validJob({ id: '4', status: 'DRAFT', title: 'Draft Role' }),
      validJob({ id: '5', isDeleted: true, title: 'Deleted Role' }),
      validJob({
        id: '6',
        expectedClosureDate: '2020-01-01T00:00:00.000Z',
        title: 'Expired Role',
      }),
      validJob({ id: '7', publishToCareerjet: false, title: 'Disabled Role' }),
    ];
    const { xml, stats } = buildFeedFromJobs(jobs, { portalBase });
    assert.equal(stats.exported, 1);
    assert.doesNotMatch(xml, /Closed Role|Filled Role|Draft Role|Deleted Role|Expired Role|Disabled Role/);
  });

  it('skips jobs missing title, description, url, location, or country', () => {
    assert.equal(
      validateExportableJob(validJob({ title: '' }), portalBase).reason,
      'missing_title',
    );
    assert.equal(
      validateExportableJob(validJob({ description: '' }), portalBase).reason,
      'missing_description',
    );
    assert.equal(
      validateExportableJob(validJob(), '').reason,
      'missing_url',
    );
    assert.equal(
      validateExportableJob(validJob({ city: '', location: '', state: '' }), portalBase).reason,
      'missing_location',
    );
    assert.equal(
      validateExportableJob(validJob({ country: '', location: 'Bengaluru' }), portalBase).reason,
      'missing_country',
    );

    const { stats } = buildFeedFromJobs(
      [
        validJob({ id: '8', title: '' }),
        validJob({ id: '9', description: '' }),
        validJob({ id: '10', city: '', location: '', state: '' }),
        validJob({ id: '11', country: '', location: 'Somewhere', city: 'Somewhere' }),
      ],
      { portalBase },
    );
    assert.equal(stats.exported, 0);
    assert.ok(stats.skipReasons.missing_title >= 1);
    assert.ok(stats.skipReasons.missing_description >= 1);
    assert.ok(stats.skipReasons.missing_location >= 1);
    assert.ok(stats.skipReasons.missing_country >= 1);
  });

  it('HTML description does not break XML and special characters stay inside CDATA', () => {
    const { xml, stats } = buildFeedFromJobs(
      [
        validJob({
          id: 'html1',
          title: 'Engineer & Architect <Senior>',
          description: '<p>Build APIs with Node.js & MongoDB.<br><strong>HTML formatting</strong> is preserved.</p>',
        }),
      ],
      { portalBase },
    );
    assert.equal(stats.exported, 1);
    assertValidXml(xml);
    assert.match(xml, /<!\[CDATA\[Engineer & Architect <Senior>]]>/);
    assert.match(xml, /<!\[CDATA\[<p>Build APIs with Node.js & MongoDB\.<br><strong>HTML formatting<\/strong> is preserved\.<\/p>]]>/);
  });

  it('maps salary from JSON without fabricating values', () => {
    assert.equal(
      salaryDisplay({ salary: { min: 10, max: 20, currency: 'USD', frequency: 'month' } }),
      'USD 10 - 20 per month',
    );
    assert.equal(salaryDisplay({}), '');
  });
});
