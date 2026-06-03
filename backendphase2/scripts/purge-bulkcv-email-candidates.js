/**
 * Find and permanently remove candidates created with legacy bulk "create anyway"
 * (+bulkcv / +bulkcvN email variants).
 *
 * Dry-run (default): lists matches only.
 * Execute: hard-deletes each match (same as Recycle Bin permanent delete).
 *
 * Usage (from backendphase2):
 *   node scripts/purge-bulkcv-email-candidates.js --tenant gho01
 *   node scripts/purge-bulkcv-email-candidates.js --tenant gho01 --execute
 *
 * Or: pnpm purge:bulkcv-emails -- --tenant gho01
 *     pnpm purge:bulkcv-emails:execute -- --tenant gho01
 */
import 'dotenv/config';
import { prisma, runWithTenantContext } from '../src/config/prisma.js';
import { permanentDeleteCandidateById } from '../src/services/candidatePermanentDelete.service.js';

const BULKCV_EMAIL_RE = /\+bulkcv/i;

function parseArgs(argv) {
  const args = {
    execute: false,
    includeDeleted: false,
    tenant: String(process.env.TENANT_DB_NAME || '').trim(),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--execute') args.execute = true;
    else if (a === '--dry-run') args.execute = false;
    else if (a === '--include-deleted') args.includeDeleted = true;
    else if (a === '--tenant' && argv[i + 1]) {
      args.tenant = String(argv[++i]).trim();
    }
  }
  return args;
}

function isBulkCvVariantEmail(email) {
  const e = String(email || '').trim();
  if (!e) return false;
  return BULKCV_EMAIL_RE.test(e);
}

function baseEmailWithoutBulkCv(email) {
  const e = String(email || '').trim().toLowerCase();
  const m = e.match(/^([^+@]+)\+bulkcv[^@]*@(.+)$/i);
  if (!m) return null;
  return `${m[1]}@${m[2]}`;
}

async function runForTenant({ execute, tenant, includeDeleted }) {
  const where = {
    email: { not: null },
    NOT: { email: '' },
  };
  if (!includeDeleted) {
    where.isDeleted = { not: true };
  }

  const rows = await prisma.candidate.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      source: true,
      createdAt: true,
      status: true,
      isDeleted: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const matches = rows.filter((r) => isBulkCvVariantEmail(r.email));

  if (!matches.length) {
    console.log(
      includeDeleted
        ? 'No candidates (active or recycle bin) with +bulkcv in email.'
        : 'No active candidates with +bulkcv in email. Try --include-deleted if they are in Recycle Bin.'
    );
    return;
  }

  console.log(`Found ${matches.length} candidate(s) with +bulkcv email:\n`);
  for (const row of matches) {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || '(no name)';
    const base = baseEmailWithoutBulkCv(row.email);
    console.log(`  ${row.id}`);
    console.log(`    name:   ${name}`);
    console.log(`    email:  ${row.email}`);
    if (base) console.log(`    base:   ${base} (original mailbox before +bulkcv)`);
    console.log(
      `    source: ${row.source || '—'} | status: ${row.status || '—'} | deleted: ${row.isDeleted === true ? 'yes' : 'no'}`
    );
    console.log(`    created: ${row.createdAt?.toISOString?.() || row.createdAt}`);
    console.log('');
  }

  if (!execute) {
    console.log('Dry-run only. To permanently delete these profiles, run:');
    console.log(`  node scripts/purge-bulkcv-email-candidates.js --tenant ${tenant} --execute`);
    return;
  }

  console.log('Permanently deleting…\n');
  let ok = 0;
  let fail = 0;
  for (const row of matches) {
    try {
      await permanentDeleteCandidateById(row.id);
      ok += 1;
      console.log(`  deleted ${row.id} (${row.email})`);
    } catch (err) {
      fail += 1;
      console.error(`  FAILED ${row.id}:`, err?.message || err);
    }
  }
  console.log(`\nDone. Removed ${ok}, failed ${fail}.`);
}

async function main() {
  const { execute, tenant, includeDeleted } = parseArgs(process.argv);
  if (!tenant) {
    console.error('Missing tenant. Pass --tenant <dbName> (e.g. gho01 for your workspace).');
    process.exit(1);
  }

  const mode = execute ? 'EXECUTE — permanent delete' : 'dry-run';
  const scope = includeDeleted ? 'active + recycle bin' : 'active only';
  console.log(`Tenant: ${tenant} (${mode}, ${scope})\n`);

  await runWithTenantContext(tenant, () => runForTenant({ execute, tenant, includeDeleted }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
