/**
 * Ensure candidate search indexes + backfill nameNormalized / nameSearchGrams
 * on DATABASE_URL and optional tenant DBs.
 *
 * Usage:
 *   node scripts/ensure-candidate-search-indexes.mjs
 *   node scripts/ensure-candidate-search-indexes.mjs --tenants=rus01,sof01
 *   node scripts/ensure-candidate-search-indexes.mjs --discover
 *   node scripts/ensure-candidate-search-indexes.mjs --bench
 *
 * Env:
 *   DATABASE_URL (required)
 *   CANDIDATE_INDEX_TENANTS=rus01,sof01  (optional default tenant list)
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const INDEXES = [
  { name: 'candidates_email_idx', key: { email: 1 } },
  { name: 'candidates_phone_idx', key: { phone: 1 } },
  { name: 'candidates_stage_idx', key: { stage: 1 } },
  { name: 'candidates_source_idx', key: { source: 1 } },
  { name: 'candidates_nameNormalized_idx', key: { nameNormalized: 1 } },
  { name: 'candidates_nameSearchGrams_idx', key: { nameSearchGrams: 1 } },
  { name: 'candidates_firstName_lastName_idx', key: { firstName: 1, lastName: 1 } },
  { name: 'candidates_isDeleted_idx', key: { isDeleted: 1 } },
  { name: 'candidates_isDeleted_updatedAt_idx', key: { isDeleted: 1, updatedAt: -1 } },
  { name: 'candidates_isDeleted_createdAt_idx', key: { isDeleted: 1, createdAt: -1 } },
  { name: 'candidates_status_idx', key: { status: 1 } },
  { name: 'candidates_assignedToId_idx', key: { assignedToId: 1 } },
  { name: 'candidates_createdById_idx', key: { createdById: 1 } },
  { name: 'candidates_orgUnitId_idx', key: { orgUnitId: 1 } },
];

function parseArgs(argv) {
  const out = { tenants: [], discover: false, bench: false };
  for (const arg of argv) {
    if (arg === '--discover') out.discover = true;
    else if (arg === '--bench') out.bench = true;
    else if (arg.startsWith('--tenants=')) {
      out.tenants = arg
        .slice('--tenants='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  const envTenants = String(process.env.CANDIDATE_INDEX_TENANTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!out.tenants.length && envTenants.length) out.tenants = envTenants;
  return out;
}

function withDbName(url, dbName) {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

function dbNameFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/^\//, '').split('/')[0] || '(default)';
  } catch {
    return '(invalid)';
  }
}

function buildNameNormalized(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNameSearchGrams(nameNormalized) {
  const normalized = String(nameNormalized || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  const grams = new Set();
  for (const token of normalized.split(' ')) {
    if (!token) continue;
    for (const n of [2, 3]) {
      if (token.length < n) continue;
      for (let i = 0; i <= token.length - n; i += 1) {
        grams.add(token.slice(i, i + n));
      }
    }
  }
  return Array.from(grams);
}

function walkStages(plan, stages = []) {
  if (!plan) return stages;
  if (plan.stage) stages.push(plan.stage);
  if (plan.inputStage) walkStages(plan.inputStage, stages);
  if (Array.isArray(plan.inputStages)) {
    for (const s of plan.inputStages) walkStages(s, stages);
  }
  return stages;
}

async function collectionExists(prisma, name) {
  try {
    const res = await prisma.$runCommandRaw({
      listCollections: 1,
      filter: { name },
      nameOnly: true,
    });
    const batch = res?.cursor?.firstBatch || res?.cursor?.firstBatch || [];
    return Array.isArray(batch) && batch.some((c) => String(c.name || c) === name);
  } catch {
    // Fallback: try a cheap count
    try {
      await prisma.candidate.count();
      return true;
    } catch {
      return false;
    }
  }
}

async function ensureIndexes(prisma, label) {
  const exists = await collectionExists(prisma, 'candidates');
  if (!exists) {
    console.log(`  [${label}] skip indexes — candidates collection not present`);
    return { created: [], skipped: [], missingCollection: true };
  }
  const created = [];
  const skipped = [];
  for (const idx of INDEXES) {
    try {
      await prisma.$runCommandRaw({
        createIndexes: 'candidates',
        indexes: [{ key: idx.key, name: idx.name }],
      });
      created.push(idx.name);
    } catch (err) {
      const msg = String(err?.message || err);
      if (/already exists|IndexOptionsConflict|IndexKeySpecsConflict/i.test(msg)) {
        skipped.push(idx.name);
      } else if (/500 collections of 500/i.test(msg)) {
        console.warn(
          `  [${label}] Atlas collection limit hit — cannot create indexes on missing collections. Run on DBs that already have candidates.`,
        );
        return { created, skipped, atlasLimit: true };
      } else {
        console.warn(`  [${label}] index ${idx.name}: ${msg.split('\n')[0]}`);
      }
    }
  }
  return { created, skipped };
}

async function backfillNames(prisma, label) {
  const batchSize = 500;
  let updated = 0;
  let scanned = 0;
  let cursor = null;
  for (;;) {
    const rows = await prisma.candidate.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nameNormalized: true,
        nameSearchGrams: true,
      },
    });
    if (!rows.length) break;
    scanned += rows.length;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const nameNormalized = buildNameNormalized(row.firstName, row.lastName) || null;
      const nameSearchGrams = nameNormalized ? buildNameSearchGrams(nameNormalized) : [];
      const sameNorm = (row.nameNormalized || null) === nameNormalized;
      const sameGrams =
        Array.isArray(row.nameSearchGrams) &&
        row.nameSearchGrams.length === nameSearchGrams.length &&
        nameSearchGrams.every((g) => row.nameSearchGrams.includes(g));
      if (sameNorm && sameGrams) continue;
      try {
        await prisma.candidate.update({
          where: { id: row.id },
          data: { nameNormalized, nameSearchGrams },
        });
        updated += 1;
      } catch (err) {
        // Portal-shaped rows may reject unknown fields until schema generate — skip.
        if (/Unknown arg|nameNormalized|nameSearchGrams/i.test(String(err?.message || ''))) {
          console.warn(`  [${label}] skip row ${row.id}: schema field missing on client`);
          return { scanned, updated, aborted: true };
        }
        throw err;
      }
    }
    if (rows.length < batchSize) break;
  }
  return { scanned, updated, aborted: false };
}

async function explainPlans(prisma, label) {
  const probes = [
    ['list-isDeleted-sort', { isDeleted: { $ne: true } }],
    ['email-contains', { email: { $regex: 'a', $options: 'i' } }],
    ['phone-contains', { phone: { $regex: '9', $options: 'i' } }],
    ['nameNormalized-prefix', { nameNormalized: { $regex: '^a', $options: 'i' } }],
    ['nameSearchGrams-has', { nameSearchGrams: 'man' }],
    ['firstName-prefix', { firstName: { $regex: '^A', $options: 'i' } }],
  ];
  const results = [];
  for (const [name, filter] of probes) {
    try {
      const res = await prisma.$runCommandRaw({
        explain: {
          find: 'candidates',
          filter,
          sort: { updatedAt: -1 },
          limit: 50,
        },
        verbosity: 'queryPlanner',
      });
      const stages = walkStages(res?.queryPlanner?.winningPlan).join(' > ') || 'unknown';
      results.push({ name, stages });
      console.log(`  [${label}] explain ${name}: ${stages}`);
    } catch (err) {
      results.push({ name, stages: `ERROR ${err?.message || err}` });
    }
  }
  return results;
}

async function microBench(prisma, label) {
  const mem0 = process.memoryUsage().heapUsed;
  const ops = [];

  async function time(name, fn) {
    const t0 = performance.now();
    const value = await fn();
    const ms = Math.round(performance.now() - t0);
    ops.push({ name, ms, meta: value });
    console.log(`  [${label}] bench ${name}: ${ms}ms ${value || ''}`);
  }

  await time('first-page', async () => {
    const rows = await prisma.candidate.findMany({
      where: { isDeleted: { not: true } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, firstName: true, lastName: true, email: true, updatedAt: true },
    });
    return `n=${rows.length}`;
  });

  await time('name-prefix-Himanshu', async () => {
    const rows = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        OR: [
          { nameNormalized: { startsWith: 'himanshu', mode: 'insensitive' } },
          { firstName: { startsWith: 'Himanshu', mode: 'insensitive' } },
          { nameSearchGrams: { has: 'him' } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 50,
      select: { id: true },
    });
    return `n=${rows.length}`;
  });

  await time('name-mid-man-grams', async () => {
    const rows = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        nameSearchGrams: { has: 'man' },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 50,
      select: { id: true },
    });
    return `n=${rows.length}`;
  });

  await time('email-contains', async () => {
    const rows = await prisma.candidate.findMany({
      where: {
        isDeleted: { not: true },
        email: { contains: '@', mode: 'insensitive' },
      },
      take: 50,
      select: { id: true },
    });
    return `n=${rows.length}`;
  });

  await time('page-20-window', async () => {
    const rows = await prisma.candidate.findMany({
      where: { isDeleted: { not: true } },
      orderBy: [{ updatedAt: 'desc' }],
      take: 1000,
      select: { id: true, updatedAt: true },
    });
    return `n=${rows.length}`;
  });

  const memDeltaKb = Math.round((process.memoryUsage().heapUsed - mem0) / 1024);
  return { ops, memDeltaKb };
}

async function processUrl(url, { bench }) {
  const label = dbNameFromUrl(url);
  console.log(`\n=== ${label} ===`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$connect();
  } catch (err) {
    console.warn(`  skip connect: ${err?.message || err}`);
    await prisma.$disconnect().catch(() => {});
    return null;
  }

  try {
    // Touch model — skip DBs without candidates collection compatible with schema
    await prisma.candidate.count({ take: 1 }).catch(async () => {
      // Prisma count doesn't take take — use findMany
    });
    const count = await prisma.candidate.count();
    console.log(`  candidates: ${count}`);

    const indexes = await ensureIndexes(prisma, label);
    console.log(
      `  indexes created=${indexes.created.length} skipped-existing=${indexes.skipped.length}`,
    );

    const backfill = await backfillNames(prisma, label);
    console.log(
      `  backfill scanned=${backfill.scanned} updated=${backfill.updated}${
        backfill.aborted ? ' (aborted)' : ''
      }`,
    );

    const explains = await explainPlans(prisma, label);
    let benchResult = null;
    if (bench) {
      benchResult = await microBench(prisma, label);
      console.log(`  memoryDeltaKb≈${benchResult.memDeltaKb}`);
    }

    return { label, count, indexes, backfill, explains, bench: benchResult };
  } catch (err) {
    console.warn(`  ERROR: ${err?.message || err}`);
    return { label, error: String(err?.message || err) };
  } finally {
    await prisma.$disconnect();
  }
}

async function discoverTenantDbNames(baseUrl) {
  const prisma = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  try {
    const res = await prisma.$runCommandRaw({ listDatabases: 1 });
    const names = (res?.databases || [])
      .map((d) => String(d.name || ''))
      .filter((n) => n && !['admin', 'local', 'config'].includes(n));
    return names;
  } catch (err) {
    console.warn(`discover failed: ${err?.message || err}`);
    return [];
  } finally {
    await prisma.$disconnect();
  }
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const urls = [baseUrl];
if (args.discover) {
  const names = await discoverTenantDbNames(baseUrl);
  console.log(`discovered DBs: ${names.join(', ') || '(none)'}`);
  for (const name of names) {
    const u = withDbName(baseUrl, name);
    if (u !== baseUrl) urls.push(u);
  }
} else {
  for (const tenant of args.tenants) {
    urls.push(withDbName(baseUrl, tenant));
  }
}

// Always try HQ if distinct
if (process.env.HEADQUARTERS_DATABASE_URL && process.env.HEADQUARTERS_DATABASE_URL !== baseUrl) {
  urls.push(process.env.HEADQUARTERS_DATABASE_URL);
}

const uniqueUrls = [...new Set(urls)];
const summary = [];
for (const url of uniqueUrls) {
  // eslint-disable-next-line no-await-in-loop
  summary.push(await processUrl(url, { bench: args.bench || true }));
}

console.log('\n=== SUMMARY JSON ===');
console.log(JSON.stringify(summary.filter(Boolean), null, 2));
