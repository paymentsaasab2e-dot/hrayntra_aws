import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../../config/env.js';
import { DEFAULT_PERMISSIONS, DEFAULT_SYSTEM_ROLES } from '../role/default-permissions.js';

let cachedClient = null;
let cachedSchemaCollections = null;

const WORKSPACE_USERS_COLLECTION = 'CompanyWorkspaceUser';
const TENANT_PROVISIONING_COLLECTION = '_tenant_provisioning';

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
  return (
    message.includes('cannot create new collection') &&
    (message.includes('500 collections of 500') || message.includes('already using 500 collections'))
  );
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

function normalizeHeadquartersUser(document) {
  if (!document) return null;
  return {
    id: String(document._id),
    email: String(document.email || ''),
    password: String(document.password || ''),
    role: String(document.role || ''),
    status: String(document.status || ''),
    companyId: document.companyId ? String(document.companyId) : '',
    name: String(document.name || document.fullName || document.email || 'Super Admin'),
    tenantDbName: String(document.tenantDbName || ''),
    tenantDatabaseUrl: String(document.tenantDatabaseUrl || ''),
    tenantProvisioningMode: String(document.tenantProvisioningMode || 'DEDICATED'),
  };
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

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required');
    }

    const existingUser = await collection.findOne({
      email: normalizedEmail,
    });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const provisioning = await resolveProvisioningTenant(collection, normalizedEmail);
    const tenantDbName = provisioning.tenantDbName;
    const tenantDatabaseUrl = provisioning.tenantDatabaseUrl;

    const now = new Date();
    const newDocument = {
      name: normalizedName,
      email: normalizedEmail,
      password: normalizedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      companyId: tenantDbName,
      tenantDbName,
      tenantDatabaseUrl,
      tenantProvisioningMode: provisioning.provisioningMode,
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

    const user = await collection.findOne({ email });
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
};
