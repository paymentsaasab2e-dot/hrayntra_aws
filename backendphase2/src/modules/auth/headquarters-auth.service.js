import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

let cachedClient = null;

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
  return client.db().collection('CompanyWorkspaceUser');
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
  };
}

export const headquartersAuthService = {
  async findActiveSuperAdminByCredentials(loginIdOrEmail, password) {
    const collection = await getCollection();
    if (!collection) return null;

    const document = await collection.findOne({
      email: String(loginIdOrEmail || ''),
      password: String(password || ''),
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
