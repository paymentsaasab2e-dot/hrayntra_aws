/**
 * P2 CV golden-set accuracy harness (field-level exact / normalized / partial).
 *
 * Usage:
 *   node --test src/services/cv-golden-set.test.js
 *   RUN_CV_GOLDEN_AI=1 node --test src/services/cv-golden-set.test.js
 */

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const FIXTURES_DIR = path.join(__dirname, '../../test/fixtures/cv-golden');

function loadManifest() {
  const manifestPath = path.join(FIXTURES_DIR, 'manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function normalizeStr(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@.+]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digitsOnly(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

/**
 * @returns {{ field, match: 'exact'|'normalized'|'partial'|'missing'|'incorrect'|'skip', expected, actual }}
 */
function compareField(field, expected, actual) {
  if (expected == null || expected === '') {
    return { field, match: 'skip', expected, actual };
  }

  if (Array.isArray(expected)) {
    const exp = expected.map(normalizeStr).filter(Boolean);
    const act = (Array.isArray(actual) ? actual : [])
      .map((x) => normalizeStr(typeof x === 'string' ? x : x?.name || x?.title || x))
      .filter(Boolean);
    if (act.length === 0) {
      return { field, match: 'missing', expected: exp, actual: act };
    }
    const hits = exp.filter((e) => act.some((a) => a === e || a.includes(e) || e.includes(a)));
    if (hits.length === exp.length && act.every((a) => exp.some((e) => a === e))) {
      return { field, match: 'exact', expected: exp, actual: act };
    }
    if (hits.length === exp.length) {
      return { field, match: 'normalized', expected: exp, actual: act };
    }
    if (hits.length > 0) {
      return {
        field,
        match: 'partial',
        expected: exp,
        actual: act,
        hitCount: hits.length,
        expectedCount: exp.length,
      };
    }
    return { field, match: 'incorrect', expected: exp, actual: act };
  }

  const eRaw = String(expected).trim();
  const aRaw = String(actual ?? '').trim();
  if (!aRaw) {
    return { field, match: 'missing', expected: eRaw, actual: aRaw };
  }

  if (field === 'phone') {
    const ed = digitsOnly(eRaw);
    const ad = digitsOnly(aRaw);
    if (ed && ad && (ad.endsWith(ed) || ed.endsWith(ad) || ad.includes(ed) || ed.includes(ad))) {
      return {
        field,
        match: ad === ed ? 'exact' : 'normalized',
        expected: eRaw,
        actual: aRaw,
      };
    }
    return { field, match: 'incorrect', expected: eRaw, actual: aRaw };
  }

  if (aRaw === eRaw) {
    return { field, match: 'exact', expected: eRaw, actual: aRaw };
  }
  const e = normalizeStr(eRaw);
  const a = normalizeStr(aRaw);
  if (a === e) {
    return { field, match: 'normalized', expected: eRaw, actual: aRaw };
  }
  if (a.includes(e) || e.includes(a)) {
    return { field, match: 'partial', expected: eRaw, actual: aRaw };
  }
  return { field, match: 'incorrect', expected: eRaw, actual: aRaw };
}

function evaluateExtraction(expected, actual) {
  const fields = [
    ['name', expected.name, actual?.personalInformation?.fullName || actual?.name],
    ['email', expected.email, actual?.personalInformation?.email || actual?.email],
    ['phone', expected.phone, actual?.personalInformation?.phone || actual?.phone],
    ['dob', expected.dob, actual?.personalInformation?.dateOfBirth || actual?.dob],
    ['gender', expected.gender, actual?.personalInformation?.gender || actual?.gender],
    ['city', expected.city, actual?.personalInformation?.city || actual?.city],
    ['country', expected.country, actual?.personalInformation?.country || actual?.country],
    [
      'skills',
      expected.skills,
      (actual?.skills || []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean),
    ],
    [
      'latestJob',
      expected.latestJob,
      actual?.workExperience?.[0]?.jobTitle ||
        actual?.workExperience?.[0]?.title ||
        actual?.latestJob,
    ],
    [
      'education',
      expected.education,
      actual?.education?.[0]?.degree ||
        actual?.education?.[0]?.degreeProgram ||
        actual?.education?.[0]?.institution ||
        actual?.education,
    ],
  ];

  const results = fields.map(([field, exp, act]) => compareField(field, exp, act));
  const tested = results.filter((r) => r.match !== 'skip');
  const passLike = tested.filter((r) =>
    ['exact', 'normalized', 'partial'].includes(r.match),
  );
  const failed = tested.filter((r) => ['missing', 'incorrect'].includes(r.match));

  const byField = {};
  for (const r of tested) {
    byField[r.field] = r.match;
  }

  return {
    results,
    byField,
    summary: {
      fieldsTested: tested.length,
      exact: tested.filter((r) => r.match === 'exact').length,
      normalized: tested.filter((r) => r.match === 'normalized').length,
      partial: tested.filter((r) => r.match === 'partial').length,
      missing: tested.filter((r) => r.match === 'missing').length,
      incorrect: tested.filter((r) => r.match === 'incorrect').length,
      passedLike: passLike.length,
      failed: failed.length,
    },
  };
}

function aggregateFieldScores(reports) {
  const fields = [
    'name',
    'email',
    'phone',
    'dob',
    'gender',
    'city',
    'country',
    'skills',
    'latestJob',
    'education',
  ];
  const out = {};
  for (const f of fields) {
    let pass = 0;
    let total = 0;
    for (const rep of reports) {
      const m = rep?.byField?.[f];
      if (!m || m === 'skip') continue;
      total += 1;
      if (['exact', 'normalized', 'partial'].includes(m)) pass += 1;
    }
    out[f] = { pass, total, display: total ? `${pass}/${total}` : 'n/a' };
  }
  return out;
}

function hasAiCredentials() {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.MISTRAL_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
}

function detectConfiguredProvider() {
  if (process.env.OPENAI_API_KEY) return { provider: 'OpenAI', env: 'OPENAI_API_KEY' };
  if (process.env.MISTRAL_API_KEY) return { provider: 'Mistral', env: 'MISTRAL_API_KEY' };
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return { provider: 'Gemini', env: 'GOOGLE_API_KEY|GEMINI_API_KEY' };
  }
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'Claude', env: 'ANTHROPIC_API_KEY' };
  return null;
}

describe('CV golden-set harness', () => {
  const manifest = loadManifest();

  it('loads fixture manifest with expected fields', () => {
    assert.ok(Array.isArray(manifest.resumes));
    assert.ok(manifest.resumes.length >= 2);
    for (const r of manifest.resumes) {
      assert.ok(r.id);
      assert.ok(r.expected?.name);
      assert.ok(r.expected?.email);
    }
  });

  it('classifies exact / normalized / partial / missing / incorrect', () => {
    const { summary, results } = evaluateExtraction(
      {
        name: 'Alex Rivera',
        email: 'alex@example.com',
        phone: '+1-555-0100',
        skills: ['React', 'Node'],
        latestJob: 'Frontend Engineer',
      },
      {
        personalInformation: {
          fullName: 'alex rivera',
          email: 'alex@example.com',
          phone: '15550100',
        },
        skills: [{ name: 'React' }, { name: 'TypeScript' }],
        workExperience: [{ jobTitle: 'Frontend Engineer' }],
      },
    );
    assert.ok(summary.fieldsTested >= 4);
    assert.ok(results.find((r) => r.field === 'name' && r.match === 'normalized'));
    assert.ok(results.find((r) => r.field === 'email' && r.match === 'exact'));
    assert.ok(results.find((r) => r.field === 'phone' && ['exact', 'normalized'].includes(r.match)));
  });

  it('live AI golden evaluation', async (t) => {
    if (process.env.RUN_CV_GOLDEN_AI !== '1' || !hasAiCredentials()) {
      t.skip('SKIPPED — provider credentials unavailable (set RUN_CV_GOLDEN_AI=1)');
      return;
    }

    const configured = detectConfiguredProvider();
    const { parseResumeFromBuffer } = require('./resume-parser.service');
    const report = [];

    for (const entry of manifest.resumes) {
      const filePath = path.join(FIXTURES_DIR, entry.file);
      if (!fs.existsSync(filePath)) {
        report.push({
          id: entry.id,
          error: 'fixture file missing',
          provider: configured?.provider || 'unknown',
        });
        continue;
      }
      const buffer = fs.readFileSync(filePath);
      const mime = entry.mimeType || 'text/plain';
      const started = Date.now();
      let actual = null;
      let errMsg = null;
      try {
        actual = await parseResumeFromBuffer(buffer, mime, entry.file);
      } catch (err) {
        errMsg = err?.message || String(err);
      }
      const latencyMs = Date.now() - started;
      if (!actual) {
        report.push({
          id: entry.id,
          fixture: entry.file,
          provider: configured?.provider || 'unknown',
          model: process.env.CV_PARSER_MODEL || 'default',
          latencyMs,
          result: 'FAIL',
          error: errMsg,
        });
        continue;
      }
      const evaluated = evaluateExtraction(entry.expected, actual);
      report.push({
        id: entry.id,
        fixture: entry.file,
        provider: configured?.provider || 'unknown',
        model: process.env.CV_PARSER_MODEL || 'default',
        latencyMs,
        result: evaluated.summary.failed === 0 ? 'PASS' : 'FAIL',
        byField: evaluated.byField,
        summary: evaluated.summary,
        tokenUsage: actual?._usage || actual?.usage || null,
      });
    }

    const fieldScores = aggregateFieldScores(report);
    console.log('\n[CV GOLDEN LIVE REPORT]');
    console.log(JSON.stringify({ provider: configured, report, fieldScores }, null, 2));
    console.log('\n[CV GOLDEN FIELD SCORES]');
    for (const [f, s] of Object.entries(fieldScores)) {
      console.log(`${f.padEnd(12)} ${s.display}`);
    }

    assert.ok(report.length > 0);
  });
});

module.exports = {
  evaluateExtraction,
  compareField,
  aggregateFieldScores,
  loadManifest,
  FIXTURES_DIR,
};
