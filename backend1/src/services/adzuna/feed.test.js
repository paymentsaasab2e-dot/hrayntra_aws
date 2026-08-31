const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeXml, cdata, wrapJobsXml, jobToXml } = require('./xml');
const { mapAdzunaCategory } = require('./categories');
const { evaluateEligibility, resolveCountry } = require('./eligibility');
const { buildFeedFromJobs, validateExportableJob, generateAdzunaFeed } = require('./feed.service');

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

  it('excludes closed, draft, deleted, expired, inactive, rejected, and unpublished jobs', () => {
    assert.equal(evaluateEligibility({ ...base, status: 'CLOSED' }).reason, 'closed');
    assert.equal(evaluateEligibility({ ...base, status: 'DRAFT' }).reason, 'draft');
    assert.equal(evaluateEligibility({ ...base, isDeleted: true }).reason, 'deleted');
    assert.equal(evaluateEligibility({ ...base, isActive: false }).reason, 'inactive');
    assert.equal(evaluateEligibility({ ...base, status: 'REJECTED' }).reason, 'rejected');
    assert.equal(evaluateEligibility({ ...base, status: 'UNPUBLISHED' }).reason, 'unpublished');
    assert.equal(
      evaluateEligibility({ ...base, expectedClosureDate: '2020-01-01T00:00:00.000Z' }).reason,
      'expired',
    );
  });

  it('includes all public portal jobs without requiring an Adzuna API key or per-job opt-in', () => {
    assert.equal(evaluateEligibility({ ...base, publishToAdzuna: false }).ok, true);
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
  const portalBase = 'https://www.hryantra.com';

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
    assert.match(xml, /https:\/\/www\.hryantra\.com\/explore-jobs\?job=64b000000000000000000001&amp;utm_source=adzuna/);
    assert.doesNotMatch(xml, /localhost|127\.0\.0\.1|app_id|app_key|ADZUNA_APP|<api_key>|<adzuna_key>/);
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

  it('includes every eligible job with unique ids and no pagination cap', () => {
    const jobs = Array.from({ length: 120 }, (_, i) => ({
      id: `64b00000000000000000${String(i).padStart(4, '0')}`,
      title: i === 0 ? 'C++ Developer' : `Role ${i}`,
      description: `<p>Build APIs with Node.js & MongoDB for role ${i}. Description must be long enough for a real job posting.</p>`,
      location: 'Mumbai',
      country: 'India',
      status: 'OPEN',
      isActive: true,
      client: { companyName: 'A & B Technologies' },
    }));
    jobs.push({
      ...jobs[0],
      id: 'dup-1',
      status: 'DRAFT',
      title: 'Draft Role',
    });
    const { xml, stats } = buildFeedFromJobs(jobs, { portalBase });
    assert.equal(stats.exported, 120);
    assert.equal((xml.match(/<job>/g) || []).length, 120);
    const ids = [...xml.matchAll(/<id>([^<]+)<\/id>/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.match(xml, /<title>C\+\+ Developer<\/title>/);
    assert.match(xml, /<company>A &amp; B Technologies<\/company>/);
    assert.doesNotMatch(xml, /Draft Role/);
  });

  it('drops duplicate ids after the first occurrence', () => {
    const job = {
      id: 'same-id',
      title: 'Software Engineer',
      description: '<p>Build and ship backend APIs for our hiring platform with Node.js and MongoDB.</p>',
      location: 'Pune',
      country: 'IN',
      status: 'OPEN',
      isActive: true,
    };
    const { stats } = buildFeedFromJobs([job, { ...job, title: 'Copy' }], { portalBase });
    assert.equal(stats.exported, 1);
    assert.equal(stats.skipReasons.duplicate_id, 1);
  });

  it('returns a server error when the database cannot list jobs', async () => {
    await assert.rejects(() => generateAdzunaFeed(null), /unavailable|cannot list/i);
  });
});
