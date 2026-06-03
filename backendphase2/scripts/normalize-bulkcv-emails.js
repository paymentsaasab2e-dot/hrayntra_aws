/**
 * Restore plain emails on legacy bulk "copy" candidates (+bulkcv suffix).
 * Does NOT delete candidates — only updates the email field on rows that contain +bulkcv.
 *
 * Usage (from backendphase2):
 *   node scripts/normalize-bulkcv-emails.js --tenant gho01
 *   node scripts/normalize-bulkcv-emails.js --tenant gho01 --execute
 *   node scripts/normalize-bulkcv-emails.js --tenant gho01 --include-deleted --execute
 */
import 'dotenv/config';
import { prisma, runWithTenantContext } from '../src/config/prisma.js';
import {
  stripBulkCvEmailSuffix,
  normalizeCandidateEmailForDuplicate,
} from '../src/services/bulkCvDuplicate.service.js';

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
  return /\+bulkcv/i.test(String(email || ''));
}

async function runForTenant({ execute, includeDeleted }) {
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
      extraData: true,
      isDeleted: true,
      source: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const matches = rows.filter((r) => isBulkCvVariantEmail(r.email));

  if (!matches.length) {
    console.log(
      includeDeleted
        ? 'No candidates with +bulkcv in email.'
        : 'No active candidates with +bulkcv in email. Try --include-deleted.'
    );
    return;
  }

  const plainById = new Map();
  for (const row of matches) {
    const plain = stripBulkCvEmailSuffix(row.email);
    if (plain) plainById.set(row.id, plain);
  }

  const otherWithPlain = new Map();
  for (const row of rows) {
    if (isBulkCvVariantEmail(row.email)) continue;
    const norm = normalizeCandidateEmailForDuplicate(row.email);
    if (norm) {
      if (!otherWithPlain.has(norm)) otherWithPlain.set(norm, []);
      otherWithPlain.get(norm).push(row.id);
    }
  }

  console.log(`Found ${matches.length} +bulkcv copy candidate(s) to normalize:\n`);

  let wouldUpdate = 0;
  let skipped = 0;

  for (const row of matches) {
    const plain = plainById.get(row.id);
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || '(no name)';
    const owners = plain ? otherWithPlain.get(plain) || [] : [];
    const alreadyPlain = plain && owners.length > 0;

    console.log(`  ${row.id} | ${name}`);
    console.log(`    from: ${row.email}`);
    console.log(`    to:   ${plain || '(could not parse)'}`);
    if (alreadyPlain) {
      console.log(
        `    note: another candidate already uses this email (${owners.join(', ')}) — copy will share the same address`
      );
    }
    console.log('');

    if (!plain || plain === normalizeCandidateEmailForDuplicate(row.email)) {
      skipped += 1;
      continue;
    }
    wouldUpdate += 1;

    if (!execute) continue;

    const priorExtra =
      row.extraData && typeof row.extraData === 'object' && !Array.isArray(row.extraData)
        ? row.extraData
        : {};

    await prisma.candidate.update({
      where: { id: row.id },
      data: {
        email: plain,
        extraData: {
          ...priorExtra,
          legacyBulkCvEmail: String(row.email).trim(),
          bulkCvEmailNormalizedAt: new Date().toISOString(),
        },
      },
    });
    console.log(`  updated ${row.id}`);
  }

  if (!execute) {
    console.log(`Dry-run: ${wouldUpdate} email(s) would be normalized, ${skipped} skipped.`);
    console.log(`Run with --execute to apply:`);
    console.log(`  node scripts/normalize-bulkcv-emails.js --tenant <db> --execute`);
  } else {
    console.log(`Done. Updated ${wouldUpdate} candidate email(s), skipped ${skipped}.`);
  }
}

async function main() {
  const { execute, tenant, includeDeleted } = parseArgs(process.argv);
  if (!tenant) {
    console.error('Missing tenant. Pass --tenant <dbName> (e.g. gho01).');
    process.exit(1);
  }

  const mode = execute ? 'EXECUTE' : 'dry-run';
  const scope = includeDeleted ? 'active + recycle bin' : 'active only';
  console.log(`Tenant: ${tenant} (${mode}, ${scope})\n`);

  await runWithTenantContext(tenant, () => runForTenant({ execute, includeDeleted }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
