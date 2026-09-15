/**
 * Auto-fix candidate names that look like CV filenames / job titles / locations.
 * Re-reads stored resume files and updates firstName/lastName (no AI).
 *
 * Usage (from backendphase2):
 *   node scripts/repair-bad-candidate-names.js --tenant gho01
 *   node scripts/repair-bad-candidate-names.js --tenant gho01 --execute
 *   node scripts/repair-bad-candidate-names.js --tenant gho01 --execute --limit 200
 */
import 'dotenv/config';
import { prisma, runWithTenantContext } from '../src/config/prisma.js';
import { repairBadCandidateNames } from '../src/services/repairCandidateNames.service.js';

function parseArgs(argv) {
  const args = {
    execute: false,
    tenant: String(process.env.TENANT_DB_NAME || '').trim(),
    limit: 500,
    orgUnitId: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--execute') args.execute = true;
    else if (a === '--dry-run') args.execute = false;
    else if (a === '--tenant' && argv[i + 1]) args.tenant = String(argv[++i]).trim();
    else if (a === '--limit' && argv[i + 1]) args.limit = Number(argv[++i]) || 500;
    else if (a === '--org-unit' && argv[i + 1]) args.orgUnitId = String(argv[++i]).trim();
  }
  return args;
}

async function main() {
  const { execute, tenant, limit, orgUnitId } = parseArgs(process.argv);
  if (!tenant) {
    console.error('Missing tenant. Pass --tenant <dbName> (e.g. gho01).');
    process.exit(1);
  }

  console.log(`Tenant: ${tenant} (${execute ? 'EXECUTE' : 'dry-run'}, limit=${limit})\n`);

  const result = await runWithTenantContext(tenant, () =>
    repairBadCandidateNames({
      execute,
      dryRun: !execute,
      limit,
      orgUnitId: orgUnitId || null,
    })
  );

  console.log(JSON.stringify(result, null, 2));
  if (!execute) {
    console.log('\nDry-run only. Re-run with --execute to apply updates.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
