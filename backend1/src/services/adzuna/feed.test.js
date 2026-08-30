const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeXml, cdata, wrapJobsXml, jobToXml } = require('./xml');
const { mapAdzunaCategory } = require('./categories');
const { evaluateEligibility, resolveCountry } = require('./eligibility');
const { buildFeedFromJobs, validateExportableJob } = require('./feed.service');

describe('Adzuna XML helpers', () => {
  it('escapes special characters', () => {
    assert.equal(escapeXml(`A & B <C> "D" 'E'`), 'A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
  });

  it('splits CDATA when the payload contains ]]>', () => {
    assert.equal(cdata('foo]]>bar'), '<![CDATA[foo]]]]><![CDATA[>bar]]>');
  });

  it('wraps an empty feed', () => {
    const xml = wrapJobsXml([]);
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<jobs>/);
    assert.match(xml, /<\/jobs>/);
  });
});

describe('Adzuna eligibility', () => {
  const base = {
    id: '64b000000000000000000001',
    title: 'Software Engineer',
    description: '<p>Build and ship backend APIs for our hiring platform with Node.js and MongoDB.</p>',
    location: 'Mumbai',
    country: 'India',
    status: 'OPEN',
    isActive: true,
    publishToAdzuna: true,
  };

  it('excludes closed, draft, deleted, expired, and inactive jobs', () => {
    assert.equal(evaluateEligibility({ ...base, status: 'CLOSED' }).reason, 'closed');
    assert.equal(evaluateEligibility({ ...base, status: 'DRAFT' }).reason, 'draft');
    assert.equal(evaluateEligibility({ ...base, isDeleted: true }).reason, 'deleted');
    assert.equal(evaluateEligibility({ ...base, isActive: false }).reason, 'inactive');
    assert.equal(
      evaluateEligibility({ ...base, expectedClosureDate: '2020-01-01T00:00:00.000Z' }).reason,
      'expired',
    );
  });

  it('requires Adzuna opt-in unless includeAll is set', () => {
    assert.equal(evaluateEligibility({ ...base, publishToAdzuna: false }).reason, 'adzuna_not_enabled');
    assert.equal(evaluateEligibility({ ...base, publishToAdzuna: false }, { includeAll: true }).ok, true);
    assert.equal(
      evaluateEligibility({ ...base, publishToAdzuna: false, distributionPlatforms: { adzuna: true } }).ok,
      true,
    );
  });

  it('maps India to IN and does not invent a country', () => {
    assert.equal(resolveCountry({ country: 'India' }), 'IN');
    assert.equal(resolveCountry({ country: 'IN' }), 'IN');
    assert.equal(resolveCountry({ location: 'London, United Kingdom' }), 'UK');
    assert.equal(resolveCountry({}), null);
  });
});

describe('Adzuna category mapping', () => {
  it('maps software titles to IT Jobs without changing stored categories', () => {
    const mapped = mapAdzunaCategory({ jobCategory: 'Software', title: 'Backend Developer' });
    assert.equal(mapped.mapped, true);
    assert.equal(mapped.id, '2');
  });

  it('logs unmapped categories by returning mapped=false', () => {
    const mapped = mapAdzunaCategory({ jobCategory: 'Unicorn wrangling' });
    assert.equal(mapped.mapped, false);
    assert.equal(mapped.reason, 'unmapped_category');
  });
});

describe('Adzuna feed builder', () => {
  const portalBase = 'http://localhost:3000';

  it('exports a valid open opted-in job and skips invalid ones', () => {
    const jobs = [
      {
        id: '64b000000000000000000001',
        title: 'Software Engineer',
        description: '<p>Build and ship backend APIs for our hiring platform with Node.js and MongoDB. This role needs more than one hundred characters of description text.</p>',
        location: 'Mumbai',
        country: 'India',
        status: 'OPEN',
        isActive: true,
        publishToAdzuna: true,
        client: { companyName: 'Acme & Co' },
        salary: { min: 800000, max: 1200000, currency: 'INR' },
        type: 'FULL_TIME',
        workMode: 'Remote',
      },
      {
        id: '64b000000000000000000002',
        title: 'Closed Role',
        description: '<p>Should not appear because the job is closed.</p>',
        location: 'Delhi',
        country: 'IN',
        status: 'CLOSED',
        publishToAdzuna: true,
      },
      {
        id: '64b000000000000000000003',
        title: 'Missing location',
        description: '<p>This job is missing a location so validation should skip it safely.</p>',
        country: 'IN',
        status: 'OPEN',
        publishToAdzuna: true,
      },
    ];

    const { xml, stats } = buildFeedFromJobs(jobs, { portalBase });
    assert.equal(stats.exported, 1);
    assert.ok(stats.skipped >= 2);
    assert.match(xml, /<title>Software Engineer<\/title>/);
    assert.match(xml, /<country>IN<\/country>/);
    assert.match(xml, /<company>Acme &amp; Co<\/company>/);
    assert.match(xml, /<remote>1<\/remote>/);
    assert.doesNotMatch(xml, /Closed Role/);
    assert.doesNotMatch(xml, /app_id|app_key|ADZUNA_APP/);
    assert.match(xml, /explore-jobs\?job=64b000000000000000000001&amp;utm_source=adzuna/);
  });

  it('exports jobs whose dates come back as Mongo $date objects', () => {
    const jobs = [
      {
        id: '64b000000000000000000009',
        title: 'Mongo Date Job',
        description: '<p>This job uses Mongo extended JSON dates and must still export in the Adzuna XML feed.</p>',
        location: 'Pune',
        country: 'IN',
        status: 'OPEN',
        isActive: true,
        publishToAdzuna: true,
        postedDate: { $date: '2026-08-29T10:00:00.000Z' },
        createdAt: { $date: { $numberLong: '1756461600000' } },
      },
    ];
    const { xml, stats } = buildFeedFromJobs(jobs, { portalBase });
    assert.equal(stats.exported, 1);
    assert.match(xml, /<date>2026-08-29T10:00:00.000Z<\/date>/);
  });

  it('rejects jobs missing required fields', () => {
    const result = validateExportableJob(
      { id: '1', title: 'X', description: 'short', country: 'IN' },
      portalBase,
    );
    assert.equal(result.ok, false);
  });

  it('builds a well-formed job node', () => {
    const xml = jobToXml([
      ['title', 'A & B'],
      ['id', '1'],
    ]);
    assert.match(xml, /<title>A &amp; B<\/title>/);
  });
});
