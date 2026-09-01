import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';
import { DEFAULT_PERMISSIONS, DEFAULT_SYSTEM_ROLES } from '../role/default-permissions.js';
import { prisma, runWithTenantContext } from '../../config/prisma.js';

let cachedClient = null;
let cachedSchemaCollections = null;

const WORKSPACE_USERS_COLLECTION = 'CompanyWorkspaceUser';
const TENANT_PROVISIONING_COLLECTION = '_tenant_provisioning';
/**
 * HQ-level directory mapping every tenant user (email + loginId) → tenantDbName.
 * Lets the plain `/login` URL resolve which tenant DB the user lives in even
 * when the request carries no `x-tenant-db-name` header / JWT.
 */
const TENANT_USER_DIRECTORY_COLLECTION = '_tenant_user_directory';

function normalizeLookupValue(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeLookupValue(value).toLowerCase();
}

function normalizeRole(value) {
  return normalizeLookupValue(value).toUpperCase();
}

function normalizeStatus(value) {
  return normalizeLookupValue(value).toUpperCase();
}

function buildTenantPrefixFromEmail(email) {
  const localPart = normalizeEmail(email).split('@')[0] || '';
  const lettersOnly = localPart.replace(/[^a-z]/g, '');
  const cleaned = (lettersOnly || localPart.replace(/[^a-z0-9]/g, '')).slice(0, 3);
  return cleaned.padEnd(3, 'x');
}

function buildTenantDatabaseUrl(tenantDbName) {
  if (!env.HEADQUARTERS_DATABASE_URL) return '';

  const parsed = new URL(env.HEADQUARTERS_DATABASE_URL);
  parsed.pathname = `/${tenantDbName}`;
  return parsed.toString();
}

function isCollectionLimitError(error) {
  const message = String(error?.message || '').toLowerCase();
  // Atlas wording varies: "cannot create new collection" vs "cannot create a new collection"
  const createBlocked =
    message.includes('cannot create new collection') ||
    message.includes('cannot create a new collection') ||
    message.includes('too many collections');
  const atLimit =
    message.includes('500 collections') ||
    message.includes('500/500') ||
    message.includes('already using 500');
  return createBlocked && atLimit;
}

function getSharedTenantDbName() {
  const configured = normalizeLookupValue(process.env.SHARED_TENANT_DB_NAME);
  return configured || 'shared01';
}

async function findReusableTenantDbName(collection) {
  const row = await collection
    .find(
      { tenantDbName: { $exists: true, $ne: '' } },
      { projection: { tenantDbName: 1, updatedAt: 1, createdAt: 1 } }
    )
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .limit(1)
    .toArray();

  return normalizeLookupValue(row?.[0]?.tenantDbName);
}

async function resolveProvisioningTenant(collection, normalizedEmail) {
  try {
    const tenantDbName = await getNextTenantDatabaseName(collection, normalizedEmail);
    const tenantDatabaseUrl = buildTenantDatabaseUrl(tenantDbName);
    await ensureTenantSchema(tenantDbName);
    return {
      tenantDbName,
      tenantDatabaseUrl,
      provisioningMode: 'DEDICATED',
    };
  } catch (error) {
    if (!isCollectionLimitError(error)) {
      throw error;
    }

    const reusableTenantDbName = await findReusableTenantDbName(collection);
    if (reusableTenantDbName) {
      return {
        tenantDbName: reusableTenantDbName,
        tenantDatabaseUrl: buildTenantDatabaseUrl(reusableTenantDbName),
        provisioningMode: 'COLLECTION_LIMIT_REUSE',
      };
    }

    const sharedTenantDbName = getSharedTenantDbName();
    try {
      await ensureTenantSchema(sharedTenantDbName);
    } catch (sharedSchemaError) {
      if (isCollectionLimitError(sharedSchemaError)) {
        throw new Error(
          'MongoDB Atlas collection limit reached (500/500). No reusable tenant found for fallback provisioning.'
        );
      }
      throw sharedSchemaError;
    }
    return {
      tenantDbName: sharedTenantDbName,
      tenantDatabaseUrl: buildTenantDatabaseUrl(sharedTenantDbName),
      provisioningMode: 'SHARED_FALLBACK',
    };
  }
}

async function getSchemaCollectionNames() {
  if (cachedSchemaCollections) return cachedSchemaCollections;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
  const schemaFile = await fs.readFile(schemaPath, 'utf8');

  const mappedCollections = [...schemaFile.matchAll(/@@map\("([^"]+)"\)/g)].map((match) => match[1]);
  cachedSchemaCollections = [...new Set(mappedCollections)].filter(Boolean);
  return cachedSchemaCollections;
}

async function getHeadquartersClient() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }

  return cachedClient;
}

async function getCollection() {
  const client = await getHeadquartersClient();
  if (!client) return null;
  return client.db().collection(WORKSPACE_USERS_COLLECTION);
}

let directoryIndexesEnsured = false;
async function getTenantUserDirectoryCollection() {
  const client = await getHeadquartersClient();
  if (!client) return null;
  const collection = client.db().collection(TENANT_USER_DIRECTORY_COLLECTION);
  if (!directoryIndexesEnsured) {
    try {
      await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ loginId: 1 }, { sparse: true });
      directoryIndexesEnsured = true;
    } catch (error) {
      // Index creation can race with Atlas collection limit errors; ignore on best-effort.
    }
  }
  return collection;
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

async function ensureTenantSchema(tenantDbName) {
  const client = await getHeadquartersClient();
  if (!client) return;

  const tenantDb = client.db(tenantDbName);
  const existingCollections = await tenantDb.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existingCollections.map((row) => row.name));
  const schemaCollections = await getSchemaCollectionNames();

  for (const collectionName of schemaCollections) {
    if (!existingNames.has(collectionName)) {
      await tenantDb.createCollection(collectionName);
    }
  }

  await ensureTenantBootstrapData(tenantDb);
  await ensureTenantIndexes(tenantDb);

  await tenantDb.collection(TENANT_PROVISIONING_COLLECTION).updateOne(
    { key: 'schema' },
    {
      $set: {
        key: 'schema',
        tenantDbName,
        status: 'READY',
        schemaCollections,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function ensureTenantBootstrapData(tenantDb) {
  const provisioningDoc = await tenantDb
    .collection(TENANT_PROVISIONING_COLLECTION)
    .findOne({ key: 'seed' });

  if (provisioningDoc?.status === 'READY') {
    return;
  }

  const permissionCollection = tenantDb.collection('permissions');
  const roleCollection = tenantDb.collection('system_roles');
  const rolePermissionCollection = tenantDb.collection('role_permissions');

  const existingPermissions = await permissionCollection
    .find({}, { projection: { _id: 1, permissionName: 1 } })
    .toArray();
  const desiredPermissionNames = new Set(DEFAULT_PERMISSIONS.map((permission) => permission.permissionName));
  const stalePermissionIds = existingPermissions
    .filter((permission) => !desiredPermissionNames.has(String(permission.permissionName || '').trim()))
    .map((permission) => permission._id)
    .filter(Boolean);

  if (stalePermissionIds.length > 0) {
    await rolePermissionCollection.deleteMany({ permissionId: { $in: stalePermissionIds } });
    await permissionCollection.deleteMany({ _id: { $in: stalePermissionIds } });
  }

  const existingPermissionNames = new Set(
    existingPermissions.map((permission) => String(permission.permissionName || '').trim()).filter(Boolean)
  );

  const permissionsToInsert = DEFAULT_PERMISSIONS.filter(
    (permission) => !existingPermissionNames.has(permission.permissionName)
  );
  if (permissionsToInsert.length > 0) {
    await permissionCollection.insertMany(
      permissionsToInsert.map((permission) => ({
        ...permission,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }

  const allPermissions = await permissionCollection
    .find({}, { projection: { _id: 1, permissionName: 1 } })
    .toArray();
  const permissionIdByName = new Map(
    allPermissions.map((permission) => [String(permission.permissionName || '').trim(), permission._id])
  );

  const existingRoles = await roleCollection
    .find({}, { projection: { roleName: 1 } })
    .toArray();
  const existingRoleNames = new Set(
    existingRoles.map((role) => String(role.roleName || '').trim()).filter(Boolean)
  );

  const rolesToInsert = DEFAULT_SYSTEM_ROLES.filter((role) => !existingRoleNames.has(role.roleName));
  if (rolesToInsert.length > 0) {
    await roleCollection.insertMany(
      rolesToInsert.map((role) => ({
        ...role,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }

  const superAdminRole = await roleCollection.findOne({ roleName: 'Super Admin' }, { projection: { _id: 1 } });
  if (superAdminRole?._id) {
    const existingRolePermissions = await rolePermissionCollection
      .find({ roleId: superAdminRole._id }, { projection: { permissionId: 1 } })
      .toArray();
    const existingPermissionIds = new Set(
      existingRolePermissions.map((row) => String(row.permissionId || '').trim()).filter(Boolean)
    );

    const superAdminPermissionDocs = DEFAULT_PERMISSIONS
      .map((permission) => permissionIdByName.get(permission.permissionName))
      .filter(Boolean)
      .filter((permissionId) => !existingPermissionIds.has(String(permissionId)))
      .map((permissionId) => ({
        roleId: superAdminRole._id,
        permissionId,
        createdAt: new Date(),
      }));

    if (superAdminPermissionDocs.length > 0) {
      await rolePermissionCollection.insertMany(superAdminPermissionDocs);
    }
  }

  await tenantDb.collection(TENANT_PROVISIONING_COLLECTION).updateOne(
    { key: 'seed' },
    {
      $set: {
        key: 'seed',
        status: 'READY',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function ensureTenantIndexes(tenantDb) {
  await Promise.allSettled([
    tenantDb.collection('users').createIndex({ email: 1 }, { unique: true }),
    tenantDb.collection('users').createIndex({ roleId: 1 }),
    tenantDb.collection('user_credentials').createIndex({ createdBy: 1 }),
    tenantDb.collection('permissions').createIndex({ permissionName: 1 }, { unique: true }),
    tenantDb.collection('jobs').createIndex({ assignedToId: 1 }),
    tenantDb.collection('candidates').createIndex({ assignedToId: 1 }),
    tenantDb.collection('leads').createIndex({ assignedToId: 1 }),
    tenantDb.collection('clients').createIndex({ assignedToId: 1 }),
  ]);
}

function normalizeSubscriptionPlanForHq(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? { name: s } : null;
  }
  if (typeof value === 'object') {
    const name = String(value.name || '').trim();
    const id = String(value.id || '').trim();
    if (!name && !id) return null;
    const planStartDate = String(value.planStartDate || '').trim();
    const planEndDate = String(value.planEndDate || '').trim();
    const isTrial = value.isTrial === true || value.isTrial === 'true';
    const trialDays =
      value.trialDays === undefined || value.trialDays === null
        ? undefined
        : Number(value.trialDays) || undefined;
    return {
      ...(id ? { id } : {}),
      name: name || id,
      billingCycle:
        String(value.billingCycle || '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly',
      maxUsers: value.maxUsers === undefined ? null : value.maxUsers,
      maxJobs: value.maxJobs === undefined ? null : value.maxJobs,
      ...(planStartDate ? { planStartDate } : {}),
      ...(planEndDate ? { planEndDate } : {}),
      ...(isTrial ? { isTrial: true } : {}),
      ...(trialDays ? { trialDays } : {}),
      ...(value.upgradedAt ? { upgradedAt: String(value.upgradedAt) } : {}),
      ...(value.upgradedFrom ? { upgradedFrom: String(value.upgradedFrom) } : {}),
      ...(value.lastPaymentReference ? { lastPaymentReference: String(value.lastPaymentReference) } : {}),
      ...(value.purchasedAt ? { purchasedAt: String(value.purchasedAt) } : {}),
      ...(value.employerDemoRequestId ? { employerDemoRequestId: String(value.employerDemoRequestId) } : {}),
      ...(value.upgradedBy ? { upgradedBy: String(value.upgradedBy) } : {}),
      ...(value.coins !== undefined && value.coins !== null
        ? { coins: Math.max(0, Number(value.coins) || 0) }
        : {}),
      ...(value.price ? { price: String(value.price) } : {}),
    };
  }
  return null;
}

function normalizeProductLine(value) {
  return String(value || '').trim().toLowerCase() === 'recruitment' ? 'recruitment' : 'crm';
}

function normalizeEnabledModules(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((m) => String(m || '').trim()).filter(Boolean))];
}

/** Missing/legacy → true (Phase 1 All-candidates pool stays available). */
function normalizePhase1CommonPoolEnabled(value) {
  return value !== false;
}

function normalizeHeadquartersUser(document) {
  if (!document) return null;
  return {
    id: String(document._id),
    email: String(document.email || ''),
    password: String(document.password || ''),
    loginId: String(document.loginId || document.email || ''),
    organizationType: normalizeOrgType(document.organizationType),
    productLine: document.productLine ? normalizeProductLine(document.productLine) : '',
    enabledModules: normalizeEnabledModules(document.enabledModules),
    modulesRestricted:
      document.modulesRestricted === true ||
      normalizeEnabledModules(document.enabledModules).length > 0,
    phase1CommonPoolEnabled: normalizePhase1CommonPoolEnabled(document.phase1CommonPoolEnabled),
    subscriptionPlan: normalizeSubscriptionPlanForHq(document.subscriptionPlan),
    role: String(document.role || ''),
    status: String(document.status || 'ACTIVE'),
    pausedAt: document.pausedAt ? new Date(document.pausedAt).toISOString() : null,
    pausedBy: document.pausedBy ? String(document.pausedBy) : '',
    companyId: document.companyId ? String(document.companyId) : '',
    name: String(document.name || document.fullName || document.email || 'Super Admin'),
    organizationName: String(document.organizationName || '').trim(),
    signupSource: String(document.signupSource || '').trim(),
    tenantDbName: String(document.tenantDbName || ''),
    tenantDatabaseUrl: String(document.tenantDatabaseUrl || ''),
    tenantProvisioningMode: String(document.tenantProvisioningMode || 'DEDICATED'),
    jobsApiKey: String(document.jobsApiKey || '').trim(),
    jobsApiKeyIssuedAt: document.jobsApiKeyIssuedAt
      ? document.jobsApiKeyIssuedAt instanceof Date
        ? document.jobsApiKeyIssuedAt.toISOString()
        : String(document.jobsApiKeyIssuedAt)
      : null,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    isDeleted: Boolean(document.isDeleted),
    deletedAt: document.deletedAt
      ? document.deletedAt instanceof Date
        ? document.deletedAt.toISOString()
        : String(document.deletedAt)
      : null,
    deletedBy: String(document.deletedBy || ''),
  };
}

function normalizeOrgType(value) {
  const s = String(value || '').trim().toLowerCase();
  return s === 'standalone' ? 'standalone' : 'agency';
}

export const headquartersAuthService = {
  async registerWorkspaceUserAndProvisionTenant(data) {
    const collection = await getCollection();
    if (!collection) {
      throw new Error('Headquarters database is not configured');
    }

    const normalizedEmail = normalizeEmail(data?.email);
    const normalizedPassword = normalizeLookupValue(data?.password);
    const normalizedName = normalizeLookupValue(data?.name) || normalizedEmail;
    const normalizedLoginId = normalizeLookupValue(data?.loginId) || normalizedEmail;
    const organizationType = normalizeOrgType(data?.organizationType);
    const subscriptionPlan = normalizeSubscriptionPlanForHq(data?.subscriptionPlan);
    const productLine = data?.productLine ? normalizeProductLine(data.productLine) : '';
    const enabledModules = normalizeEnabledModules(data?.enabledModules);
    const phase1CommonPoolEnabled = normalizePhase1CommonPoolEnabled(
      data?.phase1CommonPoolEnabled === undefined ? true : data.phase1CommonPoolEnabled,
    );

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required');
    }

    const existingUser = await collection.findOne({
      email: normalizedEmail,
    });
    if (existingUser) {
      if (existingUser.isDeleted) {
        throw new Error(
          'This user is in Recycle Bin. Restore it from HQ Recycle Bin, or delete it forever first.',
        );
      }
      throw new Error('User already exists');
    }

    const existingLogin = await collection.findOne({
      loginId: normalizedLoginId,
    });
    if (existingLogin) {
      if (existingLogin.isDeleted) {
        throw new Error(
          'This login ID is in Recycle Bin. Restore it from HQ Recycle Bin, or delete it forever first.',
        );
      }
      throw new Error('Login ID already in use');
    }

    const provisioning = await resolveProvisioningTenant(collection, normalizedEmail);
    const tenantDbName = provisioning.tenantDbName;
    const tenantDatabaseUrl = provisioning.tenantDatabaseUrl;

    const now = new Date();
    const organizationName = normalizeLookupValue(data?.organizationName);
    const signupSource = normalizeLookupValue(data?.signupSource);
    const newDocument = {
      name: normalizedName,
      email: normalizedEmail,
      loginId: normalizedLoginId,
      password: normalizedPassword,
      organizationType,
      subscriptionPlan,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      companyId: tenantDbName,
      tenantDbName,
      tenantDatabaseUrl,
      tenantProvisioningMode: provisioning.provisioningMode,
      ...(organizationName ? { organizationName } : {}),
      ...(signupSource ? { signupSource } : {}),
      ...(productLine ? { productLine } : {}),
      ...(enabledModules.length ? { enabledModules } : {}),
      phase1CommonPoolEnabled,
      createdAt: now,
      updatedAt: now,
    };

    const { insertedId } = await collection.insertOne(newDocument);
    return normalizeHeadquartersUser({
      ...newDocument,
      _id: insertedId,
    });
  },

  async ensureTenantProvisioning(userOrEmail) {
    const collection = await getCollection();
    if (!collection) return null;

    const email = normalizeEmail(userOrEmail);
    if (!email) return null;

    const user = await collection.findOne({ email, isDeleted: { $ne: true } });
    if (!user) return null;

    let tenantDbName = normalizeLookupValue(user.tenantDbName);
    let wasCreated = false;

    if (!tenantDbName) {
      tenantDbName = await getNextTenantDatabaseName(collection, email);
      wasCreated = true;
    }

    try {
      await ensureTenantSchema(tenantDbName);
    } catch (error) {
      if (!isCollectionLimitError(error)) {
        throw error;
      }

      const reusableTenantDbName = await findReusableTenantDbName(collection);
      if (reusableTenantDbName) {
        tenantDbName = reusableTenantDbName;
      } else {
        const sharedTenantDbName = getSharedTenantDbName();
        try {
          await ensureTenantSchema(sharedTenantDbName);
          tenantDbName = sharedTenantDbName;
        } catch (sharedSchemaError) {
          if (isCollectionLimitError(sharedSchemaError)) {
            throw new Error(
              'MongoDB Atlas collection limit reached (500/500). No reusable tenant found for fallback provisioning.'
            );
          }
          throw sharedSchemaError;
        }
      }
    }

    const tenantDatabaseUrl = buildTenantDatabaseUrl(tenantDbName);
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          role: normalizeRole(user.role || 'SUPER_ADMIN') || 'SUPER_ADMIN',
          status: normalizeStatus(user.status || 'ACTIVE') || 'ACTIVE',
          companyId: tenantDbName,
          tenantDbName,
          tenantDatabaseUrl,
          updatedAt: new Date(),
        },
      }
    );

    return {
      tenantDbName,
      tenantDatabaseUrl,
      wasCreated,
    };
  },

  async findActiveSuperAdminByCredentials(loginIdOrEmail, password) {
    const collection = await getCollection();
    if (!collection) return null;

    const normalizedIdentifier = normalizeLookupValue(loginIdOrEmail);
    const normalizedEmail = normalizeEmail(loginIdOrEmail);
    const normalizedPassword = normalizeLookupValue(password);

    const document = await collection.findOne({
      $or: [
        { email: normalizedEmail },
        { email: normalizeEmail(normalizedIdentifier) },
        { loginId: normalizedIdentifier },
      ],
      password: normalizedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });

    return normalizeHeadquartersUser(document);
  },

  async findActiveSuperAdminById(id) {
    const collection = await getCollection();
    if (!collection || !id || !ObjectId.isValid(id)) return null;

    const document = await collection.findOne({
      _id: new ObjectId(id),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });

    return normalizeHeadquartersUser(document);
  },

  async listTenants() {
    const collection = await getCollection();
    if (!collection) return [];
    const docs = await collection
      .find(
        { isDeleted: { $ne: true } },
        {
          projection: {
            password: 0,
          },
        }
      )
      .sort({ createdAt: -1, _id: -1 })
      .toArray();
    return docs.map((doc) => normalizeHeadquartersUser(doc)).filter(Boolean);
  },

  async findTenantByDbName(tenantDbName) {
    const collection = await getCollection();
    const dbName = String(tenantDbName || '').trim();
    if (!collection || !dbName) return null;
    // Prefer the most recently updated HQ workspace for this DB so tab changes
    // (enabledModules) win over stale sibling / shared-DB records.
    const docs = await collection
      .find({ tenantDbName: dbName, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(1)
      .toArray();
    return normalizeHeadquartersUser(docs[0] || null);
  },

  /**
   * Resolve HQ tab entitlements for a live Phase 2 session.
   * Prefer the logged-in HQ owner email when present; else latest row for tenantDbName.
   */
  async findTenantModulesForSession({ email, tenantDbName } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
      const byEmail = await this.findWorkspaceUserByEmail(normalizedEmail);
      if (byEmail) {
        const emailDb = String(byEmail.tenantDbName || '').trim();
        const sessionDb = String(tenantDbName || '').trim();
        if (!sessionDb || !emailDb || emailDb === sessionDb) {
          return byEmail;
        }
      }
    }
    return this.findTenantByDbName(tenantDbName);
  },

  async findWorkspaceUserByJobsApiKey(apiKey) {
    const collection = await getCollection();
    const key = String(apiKey || '').trim();
    if (!collection || !key) return null;
    const doc = await collection.findOne({
      jobsApiKey: key,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(doc);
  },

  async issueJobsApiKeyForEmail(email) {
    const collection = await getCollection();
    const normalizedEmail = normalizeEmail(email);
    if (!collection || !normalizedEmail) {
      throw new Error('Tenant email is required');
    }
    let jobsApiKey = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `hryj_${crypto.randomBytes(24).toString('base64url')}`;
      const clash = await collection.findOne({ jobsApiKey: candidate });
      if (!clash) {
        jobsApiKey = candidate;
        break;
      }
    }
    if (!jobsApiKey) throw new Error('Could not generate a unique jobs API key');
    const issuedAt = new Date();
    const result = await collection.updateOne(
      { email: normalizedEmail, isDeleted: { $ne: true } },
      { $set: { jobsApiKey, jobsApiKeyIssuedAt: issuedAt, updatedAt: issuedAt } },
    );
    if (!result.matchedCount) throw new Error('Tenant not found');
    const doc = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(doc);
  },

  async revokeJobsApiKeyForEmail(email) {
    const collection = await getCollection();
    const normalizedEmail = normalizeEmail(email);
    if (!collection || !normalizedEmail) {
      throw new Error('Tenant email is required');
    }
    const result = await collection.updateOne(
      { email: normalizedEmail, isDeleted: { $ne: true } },
      {
        $unset: { jobsApiKey: '', jobsApiKeyIssuedAt: '' },
        $set: { updatedAt: new Date() },
      },
    );
    if (!result.matchedCount) throw new Error('Tenant not found');
    const doc = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(doc);
  },

  async findWorkspaceUserByEmail(email) {
    const collection = await getCollection();
    const normalizedEmail = normalizeEmail(email);
    if (!collection || !normalizedEmail) return null;
    const doc = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(doc);
  },

  async updateWorkspacePasswordForEmail(email, password) {
    const collection = await getCollection();
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = normalizeLookupValue(password);
    if (!collection || !normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required');
    }
    await collection.updateOne(
      { email: normalizedEmail },
      { $set: { password: normalizedPassword, updatedAt: new Date() } },
    );
    const doc = await collection.findOne({ email: normalizedEmail });
    return normalizeHeadquartersUser(doc);
  },

  async setTenantPauseForEmail(email, paused, pausedBy) {
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    const status = paused ? 'PAUSED' : 'ACTIVE';
    const update = paused
      ? {
          $set: {
            status,
            pausedAt: new Date(),
            pausedBy: String(pausedBy || '').trim(),
            updatedAt: new Date(),
          },
        }
      : {
          $set: { status, updatedAt: new Date() },
          $unset: { pausedAt: '', pausedBy: '' },
        };

    await collection.updateOne(
      { email: normalizedEmail, isDeleted: { $ne: true } },
      update,
    );
    const updated = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(updated);
  },

  isTenantPaused(tenant) {
    return String(tenant?.status || 'ACTIVE').toUpperCase() === 'PAUSED';
  },

  async setSubscriptionPlanForEmail(email, plan) {
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPlan = normalizeSubscriptionPlanForHq(plan);
    if (!normalizedEmail) return null;
    await collection.updateOne(
      { email: normalizedEmail },
      { $set: { subscriptionPlan: normalizedPlan, updatedAt: new Date() } }
    );
    const updated = await collection.findOne({ email: normalizedEmail });
    return normalizeHeadquartersUser(updated);
  },

  /**
   * Update CRM/Recruitment product line + enabled Phase 2 tabs for an existing tenant.
   */
  async setEnabledModulesForEmail(
    email,
    { productLine, enabledModules, phase1CommonPoolEnabled } = {},
  ) {
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const modules = normalizeEnabledModules(enabledModules);
    const line = productLine ? normalizeProductLine(productLine) : '';
    const $set = {
      enabledModules: modules,
      modulesRestricted: true,
      updatedAt: new Date(),
    };
    if (line) $set.productLine = line;
    if (phase1CommonPoolEnabled !== undefined) {
      $set.phase1CommonPoolEnabled = phase1CommonPoolEnabled !== false;
    }
    await collection.updateOne({ email: normalizedEmail }, { $set });
    const updated = await collection.findOne({ email: normalizedEmail });
    return normalizeHeadquartersUser(updated);
  },

  async setOrganizationNameForEmail(email, organizationName) {
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    const name = String(organizationName || '').trim();
    if (!normalizedEmail) return null;
    if (name.length < 2) {
      throw new Error('Company name must be at least 2 characters');
    }
    const existing = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    if (!existing) return null;
    const tenantDbName = String(existing.tenantDbName || '').trim();
    const filter = tenantDbName
      ? {
          isDeleted: { $ne: true },
          $or: [{ email: normalizedEmail }, { tenantDbName }],
        }
      : { email: normalizedEmail, isDeleted: { $ne: true } };
    await collection.updateMany(filter, {
      $set: { organizationName: name, updatedAt: new Date() },
    });
    const updated = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    return normalizeHeadquartersUser(updated);
  },

  async setCoinsForEmail(email, coins) {
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const next = Math.max(0, Math.floor(Number(coins) || 0));
    const existing = await collection.findOne({ email: normalizedEmail });
    if (!existing) return null;
    const plan = normalizeSubscriptionPlanForHq(existing.subscriptionPlan) || { name: 'Custom' };
    plan.coins = next;
    await collection.updateOne(
      { email: normalizedEmail },
      { $set: { subscriptionPlan: plan, updatedAt: new Date() } }
    );
    const updated = await collection.findOne({ email: normalizedEmail });
    return normalizeHeadquartersUser(updated);
  },

  async incrementCoinsForEmail(email, amount) {
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return null;
    const collection = await getCollection();
    if (!collection) return null;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const existing = await collection.findOne({ email: normalizedEmail });
    if (!existing) return null;
    const plan = normalizeSubscriptionPlanForHq(existing.subscriptionPlan) || { name: 'Custom' };
    const current = Math.max(0, Number(plan.coins) || 0);
    plan.coins = current + add;
    await collection.updateOne(
      { email: normalizedEmail },
      { $set: { subscriptionPlan: plan, updatedAt: new Date() } }
    );
    const updated = await collection.findOne({ email: normalizedEmail });
    return normalizeHeadquartersUser(updated);
  },

  async setCoinsForTenantDb(tenantDbName, coins) {
    const collection = await getCollection();
    if (!collection) return null;
    const dbName = String(tenantDbName || '').trim();
    if (!dbName) return null;
    const next = Math.max(0, Math.floor(Number(coins) || 0));
    const existing = await collection.findOne({ tenantDbName: dbName });
    if (!existing) return null;
    const plan = normalizeSubscriptionPlanForHq(existing.subscriptionPlan) || { name: 'Custom' };
    plan.coins = next;
    await collection.updateOne(
      { _id: existing._id },
      { $set: { subscriptionPlan: plan, updatedAt: new Date() } }
    );
    const updated = await collection.findOne({ _id: existing._id });
    return normalizeHeadquartersUser(updated);
  },

  /**
   * Delete a provisioned tenant: removes the HQ workspace user, the directory
   * mapping(s), and (when `dropDatabase` is true) the tenant's MongoDB
   * database. Returns metadata describing what was removed.
   *
   * Designed to be safe when the tenant or its database was already manually
   * cleaned up — every step is independently best-effort.
   */
  async deleteTenantByEmail(email, { dropDatabase = true } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error('email is required');
    }

    const workspaceCollection = await getCollection();
    if (!workspaceCollection) {
      throw new Error('Headquarters database is not configured');
    }

    const existing = await workspaceCollection.findOne({ email: normalizedEmail });
    if (!existing) {
      return { deleted: false, email: normalizedEmail };
    }

    const tenantDbName = String(existing.tenantDbName || '').trim();

    // 1) Drop tenant database if requested. The HQ database itself is left
    //    alone — only the tenant's data store is wiped.
    let databaseDropped = false;
    if (dropDatabase && tenantDbName) {
      try {
        const client = await getHeadquartersClient();
        if (client) {
          const tenantDb = client.db(tenantDbName);
          await tenantDb.dropDatabase();
          databaseDropped = true;
        }
      } catch (err) {
        console.warn(
          `[headquarters] failed to drop tenant database ${tenantDbName}:`,
          err?.message || err
        );
      }
    }

    // 2) Remove the directory mapping(s) for this tenant so plain-login can
    //    no longer route to a now-defunct tenant.
    try {
      const directory = await getTenantUserDirectoryCollection();
      if (directory) {
        const filter = tenantDbName
          ? { $or: [{ email: normalizedEmail }, { tenantDbName }] }
          : { email: normalizedEmail };
        await directory.deleteMany(filter);
      }
    } catch (err) {
      console.warn('[headquarters] failed to clear directory mapping:', err?.message || err);
    }

    // 3) Remove the HQ workspace-user record itself.
    await workspaceCollection.deleteOne({ _id: existing._id });

    return {
      deleted: true,
      email: normalizedEmail,
      tenantDbName: tenantDbName || null,
      databaseDropped,
    };
  },

  async listDeletedTenants() {
    const collection = await getCollection();
    if (!collection) return [];
    const docs = await collection
      .find({ isDeleted: true }, { projection: { password: 0 } })
      .sort({ deletedAt: -1, _id: -1 })
      .toArray();
    return docs.map((doc) => normalizeHeadquartersUser(doc)).filter(Boolean);
  },

  async softDeleteTenantByEmail(email, actor = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('email is required');
    const collection = await getCollection();
    if (!collection) throw new Error('Headquarters database is not configured');

    const existing = await collection.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    if (!existing) {
      return { deleted: false, email: normalizedEmail };
    }

    const now = new Date();
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: String(actor?.email || actor?.name || '').trim(),
          status: 'DELETED',
          updatedAt: now,
        },
      },
    );

    try {
      const directory = await getTenantUserDirectoryCollection();
      if (directory) {
        const tenantDbName = String(existing.tenantDbName || '').trim();
        const filter = tenantDbName
          ? { $or: [{ email: normalizedEmail }, { tenantDbName }] }
          : { email: normalizedEmail };
        await directory.updateMany(filter, {
          $set: { isDeleted: true, deletedAt: now, updatedAt: now },
        });
      }
    } catch (err) {
      console.warn('[headquarters] failed to mark directory deleted:', err?.message || err);
    }

    return {
      deleted: true,
      softDeleted: true,
      email: normalizedEmail,
      tenantDbName: String(existing.tenantDbName || '').trim() || null,
      databaseDropped: false,
    };
  },

  async restoreTenantByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('email is required');
    const collection = await getCollection();
    if (!collection) throw new Error('Headquarters database is not configured');

    const existing = await collection.findOne({ email: normalizedEmail, isDeleted: true });
    if (!existing) {
      return { restored: false, email: normalizedEmail };
    }

    const now = new Date();
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: { status: 'ACTIVE', updatedAt: now },
        $unset: { isDeleted: '', deletedAt: '', deletedBy: '' },
      },
    );

    const tenantDbName = String(existing.tenantDbName || '').trim();
    if (tenantDbName) {
      await this.upsertTenantUserDirectoryEntry({
        email: existing.email,
        loginId: existing.loginId,
        tenantDbName,
      });
    }

    return {
      restored: true,
      email: normalizedEmail,
      tenantDbName: tenantDbName || null,
    };
  },

  /**
   * Persist the email/loginId → tenantDbName mapping in the HQ directory so
   * future plain-`/login` attempts (no `x-tenant-db-name` header) can route
   * the user to the correct tenant database.
   *
   * Best-effort — failures here must never break user-facing flows.
   */
  async upsertTenantUserDirectoryEntry({ email, loginId, tenantDbName }) {
    try {
      const collection = await getTenantUserDirectoryCollection();
      if (!collection) return;
      const normalizedEmail = normalizeEmail(email);
      const normalizedLoginId = normalizeLookupValue(loginId);
      const normalizedTenant = normalizeLookupValue(tenantDbName);
      if (!normalizedTenant) return;
      if (!normalizedEmail && !normalizedLoginId) return;

      const now = new Date();
      const setDoc = {
        tenantDbName: normalizedTenant,
        updatedAt: now,
      };
      if (normalizedEmail) setDoc.email = normalizedEmail;
      if (normalizedLoginId) setDoc.loginId = normalizedLoginId;

      const filter = normalizedEmail
        ? { email: normalizedEmail }
        : { loginId: normalizedLoginId };

      await collection.updateOne(
        filter,
        {
          $set: setDoc,
          $unset: { isDeleted: '', deletedAt: '' },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    } catch (error) {
      // Swallow — directory is a convenience; auth flows must keep working.
    }
  },

  /**
   * Resolve the tenantDbName for a given email or loginId by consulting the
   * HQ directory. Returns an empty string when the user is unknown so callers
   * can fall through to existing logic.
   */
  async findTenantDbNameForUser(identifier) {
    try {
      const collection = await getTenantUserDirectoryCollection();
      if (!collection) return '';
      const normalized = normalizeLookupValue(identifier);
      if (!normalized) return '';
      const normalizedEmail = normalizeEmail(identifier);

      const filters = [];
      if (normalizedEmail) filters.push({ email: normalizedEmail });
      filters.push({ loginId: normalized });

      const document = await collection.findOne({
        $or: filters,
        isDeleted: { $ne: true },
      });
      return normalizeLookupValue(document?.tenantDbName);
    } catch (error) {
      return '';
    }
  },

  /**
   * Distinct tenant DB names registered in HQ (workspace users).
   */
  async listDistinctTenantDbNames() {
    try {
      const collection = await getCollection();
      if (!collection) return [];
      const names = await collection.distinct('tenantDbName', {
        tenantDbName: { $exists: true, $nin: [null, ''] },
        isDeleted: { $ne: true },
      });
      return [...new Set(names.map((n) => normalizeLookupValue(n)).filter(Boolean))];
    } catch (error) {
      return [];
    }
  },

  /**
   * When `_tenant_user_directory` has no row yet (users created before that
   * feature), scan each known tenant for a matching `UserCredential` so plain
   * `/login` can still route to the correct workspace.
   */
  async findTenantDbNameForUserByCredentialScan(identifier) {
    try {
      const normalizedLogin = normalizeLookupValue(identifier);
      const normalizedEmail = normalizeEmail(identifier);
      if (!normalizedLogin && !normalizedEmail) return '';

      const tenants = await this.listDistinctTenantDbNames();
      for (const tenantDbName of tenants) {
        const found = await runWithTenantContext(tenantDbName, async () => {
          const or = [];
          if (normalizedLogin) {
            or.push({ loginId: normalizedLogin });
            or.push({ loginId: normalizedLogin.toLowerCase() });
          }
          if (normalizedEmail) {
            or.push({ user: { email: normalizedEmail } });
          }
          if (!or.length) return false;
          const cred = await prisma.userCredential.findFirst({
            where: { OR: or },
            select: { id: true },
          });
          return Boolean(cred);
        });
        if (found) {
          await this.upsertTenantUserDirectoryEntry({
            email: normalizedEmail || undefined,
            loginId: normalizedLogin || undefined,
            tenantDbName,
          });
          return tenantDbName;
        }
      }
      return '';
    } catch (error) {
      return '';
    }
  },
};
