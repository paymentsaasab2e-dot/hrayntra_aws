/**
 * Seeds the HQ platform operator in the Headquarters MongoDB (CompanyWorkspaceUser).
 * Credentials: admin@gmail.com / Admin@123
 *
 * Usage: node scripts/seed-hq-platform-admin.js
 * Requires: HEADQUARTERS_DATABASE_URL (falls back to DATABASE_URL host with HQ db name)
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const WORKSPACE_USERS_COLLECTION = 'CompanyWorkspaceUser';

const HQ_EMAIL = 'admin@gmail.com';
const HQ_PASSWORD = 'Admin@123';
const HQ_NAME = 'HQ Platform Admin';
const HQ_LOGIN_ID = 'hq_admin';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveHeadquartersUrl() {
  const hq = process.env.HEADQUARTERS_DATABASE_URL?.trim();
  if (hq) return hq;
  const base = process.env.DATABASE_URL?.trim();
  if (!base) {
    throw new Error('Set HEADQUARTERS_DATABASE_URL or DATABASE_URL before seeding HQ admin.');
  }
  const parsed = new URL(base);
  parsed.pathname = '/headquarters';
  return parsed.toString();
}

function buildTenantPrefixFromEmail(email) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const lettersOnly = localPart.replace(/[^a-z]/g, '');
  const cleaned = (lettersOnly || localPart.replace(/[^a-z0-9]/g, '')).slice(0, 3);
  return cleaned.padEnd(3, 'x');
}

async function getNextTenantDatabaseName(collection, email) {
  const prefix = buildTenantPrefixFromEmail(email);
  const pattern = new RegExp(`^${prefix}\\d{2,}$`);
  const existing = await collection
    .find({ tenantDbName: { $regex: pattern } })
    .project({ tenantDbName: 1 })
    .toArray();

  let highestSuffix = 0;
  for (const row of existing) {
    const dbName = String(row?.tenantDbName || '');
    if (!dbName.startsWith(prefix)) continue;
    const suffix = Number.parseInt(dbName.slice(prefix.length), 10);
    if (Number.isFinite(suffix)) {
      highestSuffix = Math.max(highestSuffix, suffix);
    }
  }
  return `${prefix}${String(highestSuffix + 1).padStart(2, '0')}`;
}

function buildTenantDatabaseUrl(headquartersUrl, tenantDbName) {
  const parsed = new URL(headquartersUrl);
  parsed.pathname = `/${tenantDbName}`;
  return parsed.toString();
}

async function seedHqPlatformAdmin() {
  const headquartersUrl = resolveHeadquartersUrl();
  const client = new MongoClient(headquartersUrl);

  try {
    await client.connect();
    const collection = client.db().collection(WORKSPACE_USERS_COLLECTION);
    const normalizedEmail = normalizeEmail(HQ_EMAIL);
    const now = new Date();

    const existing = await collection.findOne({ email: normalizedEmail });
    let tenantDbName = String(existing?.tenantDbName || '').trim();
    if (!tenantDbName) {
      tenantDbName = await getNextTenantDatabaseName(collection, normalizedEmail);
    }
    const tenantDatabaseUrl = buildTenantDatabaseUrl(headquartersUrl, tenantDbName);

    const document = {
      name: HQ_NAME,
      email: normalizedEmail,
      loginId: HQ_LOGIN_ID,
      password: HQ_PASSWORD,
      organizationType: 'agency',
      subscriptionPlan: { name: 'Enterprise' },
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      companyId: tenantDbName,
      tenantDbName,
      tenantDatabaseUrl,
      tenantProvisioningMode: existing?.tenantProvisioningMode || 'DEDICATED',
      updatedAt: now,
    };

    if (existing) {
      await collection.updateOne({ _id: existing._id }, { $set: document });
      console.log('HQ platform admin updated.');
    } else {
      await collection.insertOne({ ...document, createdAt: now });
      console.log('HQ platform admin created.');
    }

    console.log('\nHeadquarters login (HQ console only):');
    console.log(`  Email:    ${HQ_EMAIL}`);
    console.log(`  Password: ${HQ_PASSWORD}`);
    console.log(`  Login ID: ${HQ_LOGIN_ID}`);
    console.log(`  Tenant:   ${tenantDbName}`);
    console.log('\nOpen: /hq/login on the employers app, then manage tenants at /hq\n');
  } finally {
    await client.close();
  }
}

seedHqPlatformAdmin().catch((error) => {
  console.error('Failed to seed HQ platform admin:', error?.message || error);
  process.exit(1);
});
