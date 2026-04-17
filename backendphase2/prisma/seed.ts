import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import { DEFAULT_PERMISSIONS, DEFAULT_SYSTEM_ROLES } from '../src/modules/role/default-permissions.js';

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for seeding');
  }
  return url;
}

async function seedAccessControl(client: MongoClient) {
  const parsed = new URL(getDatabaseUrl());
  const dbName = parsed.pathname.replace('/', '');
  const db = client.db(dbName);

  const permissionsCollection = db.collection('permissions');
  const rolesCollection = db.collection('system_roles');
  const rolePermissionsCollection = db.collection('role_permissions');

  const existingPermissions = await permissionsCollection
    .find({}, { projection: { permissionName: 1 } })
    .toArray();
  const existingPermissionNames = new Set(
    existingPermissions.map((permission) => String(permission.permissionName || '').trim()).filter(Boolean)
  );

  const permissionsToInsert = DEFAULT_PERMISSIONS.filter(
    (permission) => !existingPermissionNames.has(permission.permissionName)
  );
  if (permissionsToInsert.length > 0) {
    await permissionsCollection.insertMany(
      permissionsToInsert.map((permission) => ({
        ...permission,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }

  const existingRoles = await rolesCollection
    .find({}, { projection: { roleName: 1 } })
    .toArray();
  const existingRoleNames = new Set(
    existingRoles.map((role) => String(role.roleName || '').trim()).filter(Boolean)
  );

  const rolesToInsert = DEFAULT_SYSTEM_ROLES.filter((role) => !existingRoleNames.has(role.roleName));
  if (rolesToInsert.length > 0) {
    await rolesCollection.insertMany(
      rolesToInsert.map((role) => ({
        ...role,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
  }

  const allPermissions = await permissionsCollection
    .find({}, { projection: { _id: 1, permissionName: 1 } })
    .toArray();
  const permissionIdByName = new Map(
    allPermissions.map((permission) => [String(permission.permissionName || '').trim(), permission._id as ObjectId])
  );

  const superAdminRole = await rolesCollection.findOne({ roleName: 'Super Admin' }, { projection: { _id: 1 } });
  if (superAdminRole?._id) {
    const existingRolePermissionRows = await rolePermissionsCollection
      .find({ roleId: superAdminRole._id }, { projection: { permissionId: 1 } })
      .toArray();
    const existingPermissionIds = new Set(
      existingRolePermissionRows.map((row) => String(row.permissionId || '').trim()).filter(Boolean)
    );

    const missingRows = DEFAULT_PERMISSIONS
      .map((permission) => permissionIdByName.get(permission.permissionName))
      .filter(Boolean)
      .filter((permissionId) => !existingPermissionIds.has(String(permissionId)))
      .map((permissionId) => ({
        roleId: superAdminRole._id as ObjectId,
        permissionId: permissionId as ObjectId,
        createdAt: new Date(),
      }));

    if (missingRows.length > 0) {
      await rolePermissionsCollection.insertMany(missingRows);
    }
  }

  await Promise.all([
    // Create indexes but ignore "index already exists" errors (code 85)
    (async () => {
      try {
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('users').createIndex({ roleId: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('permissions').createIndex({ permissionName: 1 }, { unique: true });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('user_credentials').createIndex({ createdBy: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('jobs').createIndex({ assignedToId: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('candidates').createIndex({ assignedToId: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('leads').createIndex({ assignedToId: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
    (async () => {
      try {
        await db.collection('clients').createIndex({ assignedToId: 1 });
      } catch (e: any) {
        if (e.code !== 85) throw e;
      }
    })(),
  ]);
}

async function main() {
  const client = new MongoClient(getDatabaseUrl());
  await client.connect();

  try {
    await seedAccessControl(client);
    console.log('Seed complete: roles, permissions, and indexes are ready.');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
