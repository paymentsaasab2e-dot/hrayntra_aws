const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  portalFrontendBase,
  publicJobDetailUrl,
  assertPublicJobUrl,
  xmlContainsForbiddenHosts,
  PRODUCTION_PORTAL_ORIGIN,
} = require('./publicPortalUrl');

describe('public portal job URLs', () => {
  it('prefers a hryantra.com host from FRONTEND_URLS over a Vercel preview host', () => {
    const prevUrl = process.env.FRONTEND_URL;
    const prevList = process.env.FRONTEND_URLS;
    const prevPortal = process.env.JOB_PORTAL_FRONTEND_URL;
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.JOB_PORTAL_FRONTEND_URL = '';
    process.env.FRONTEND_URLS =
      'http://localhost:3000,https://jobportal-himanshu.vercel.app,https://www.hryantra.com';
    try {
      assert.equal(portalFrontendBase(), 'https://www.hryantra.com');
    } finally {
      process.env.FRONTEND_URL = prevUrl;
      process.env.FRONTEND_URLS = prevList;
      process.env.JOB_PORTAL_FRONTEND_URL = prevPortal;
    }
  });

  it('never falls back to localhost', () => {
    const previous = process.env.FRONTEND_URL;
    const portal = process.env.JOB_PORTAL_FRONTEND_URL;
    const prevList = process.env.FRONTEND_URLS;
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.JOB_PORTAL_FRONTEND_URL = '';
    process.env.FRONTEND_URLS = 'http://localhost:3000';
    try {
      const origin = portalFrontendBase();
      assert.equal(origin, PRODUCTION_PORTAL_ORIGIN);
      assert.doesNotMatch(origin, /localhost/);
    } finally {
      process.env.FRONTEND_URL = previous;
      process.env.JOB_PORTAL_FRONTEND_URL = portal;
      process.env.FRONTEND_URLS = prevList;
    }
  });

  it('uses JOB_PORTAL_FRONTEND_URL when it is public HTTPS', () => {
    const previous = process.env.JOB_PORTAL_FRONTEND_URL;
    process.env.JOB_PORTAL_FRONTEND_URL = 'https://www.hryantra.com/';
    try {
      assert.equal(portalFrontendBase(), 'https://www.hryantra.com');
    } finally {
      process.env.JOB_PORTAL_FRONTEND_URL = previous;
    }
  });

  it('builds an absolute HTTPS explore-jobs URL with the job id', () => {
    const url = publicJobDetailUrl('abc123', {
      portalBase: 'https://www.hryantra.com',
      utmSource: 'adzuna',
    });
    assert.equal(url, 'https://www.hryantra.com/explore-jobs?job=abc123&utm_source=adzuna');
    assert.equal(assertPublicJobUrl(url).ok, true);
  });

  it('rejects localhost, private IPs, and backend paths', () => {
    assert.equal(assertPublicJobUrl('http://localhost:3000/explore-jobs?job=1').ok, false);
    assert.equal(assertPublicJobUrl('https://127.0.0.1/explore-jobs?job=1').ok, false);
    assert.equal(assertPublicJobUrl('https://192.168.1.9/explore-jobs?job=1').ok, false);
    assert.equal(assertPublicJobUrl('https://api1.hryantra.com/api/jobs/1').ok, false);
  });

  it('only inspects URL tags for forbidden hosts', () => {
    const xml = `<jobs><job><url>https://www.hryantra.com/explore-jobs?job=1</url><description><![CDATA[Talked about localhost in the JD]]></description></job></jobs>`;
    assert.equal(xmlContainsForbiddenHosts(xml), false);
    const bad = `<jobs><job><url>http://localhost:3000/explore-jobs?job=1</url></job></jobs>`;
    assert.equal(xmlContainsForbiddenHosts(bad), true);
  });
});
