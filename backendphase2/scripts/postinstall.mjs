import fs from 'fs';
import { execSync } from 'child_process';

const schemaPath = 'prisma/schema.prisma';

if (!fs.existsSync(schemaPath)) {
  console.log(
    '[postinstall] Skipping prisma generate — prisma/schema.prisma not present yet (Docker layer install).',
  );
  process.exit(0);
}

console.log('[postinstall] Running prisma generate...');
execSync('npx prisma generate', { stdio: 'inherit' });
