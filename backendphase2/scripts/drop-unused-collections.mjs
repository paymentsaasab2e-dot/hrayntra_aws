import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

/** Empty legacy PascalCase collections from old job-seeker schemas — safe to drop. */
const DROP = [
  'AcademicAchievement',
  'Accomplishment',
  'ApplicationCommunication',
  'ApplicationTimeline',
  'CVVersion',
];

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL missing');
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = uri.split('/').pop()?.split('?')[0] || 'jobportal';
  const db = client.db(dbName);
  console.log('DB', dbName);
  for (const name of DROP) {
    const col = db.collection(name);
    const count = await col.estimatedDocumentCount();
    if (count > 0) {
      console.log(`SKIP ${name} (has ${count} docs)`);
      continue;
    }
    try {
      await col.drop();
      console.log(`DROPPED ${name}`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }
  // Ensure user_permission_overrides exists after freeing slots.
  try {
    await db.createCollection('user_permission_overrides');
    console.log('CREATED user_permission_overrides');
  } catch (e) {
    console.log(`user_permission_overrides: ${e.message}`);
  }
  const result = await db.listCollections({}, { nameOnly: true }).toArray();
  console.log('COUNT_AFTER', result.length);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
