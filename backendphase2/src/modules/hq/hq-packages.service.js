import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import {
  DEFAULT_HQ_PACKAGES,
  enrichPackageDoc,
  resolveBillingCycle,
  toAssignablePlan,
} from './hq-packages.config.js';

const HQ_PACKAGES_COLLECTION = 'hq_subscription_packages';

let cachedClient = null;
let indexesEnsured = false;

async function getCollection() {
  if (!env.HEADQUARTERS_DATABASE_URL) {
    throw new Error('HEADQUARTERS_DATABASE_URL is not configured');
  }
  if (!cachedClient) {
    cachedClient = new MongoClient(env.HEADQUARTERS_DATABASE_URL);
    await cachedClient.connect();
  }
  const db = cachedClient.db();
  const collection = db.collection(HQ_PACKAGES_COLLECTION);
  if (!indexesEnsured) {
    await collection.createIndex({ slug: 1 }, { unique: true, sparse: true });
    await collection.createIndex({ name: 1 });
    indexesEnsured = true;
  }
  return collection;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPackageRow(doc) {
  const enriched = enrichPackageDoc(doc);
  return {
    id: doc._id.toString(),
    slug: doc.slug || '',
    name: enriched.name || doc.name || '',
    displayName: enriched.displayName,
    description: enriched.description,
    price: enriched.price,
    yearlyPrice: enriched.yearlyPrice,
    pricePeriod: enriched.pricePeriod,
    features: enriched.features,
    isPopular: enriched.isPopular,
    maxUsers: doc.maxUsers ?? null,
    maxJobs: doc.maxJobs ?? null,
    annualMaxUsers: doc.annualMaxUsers ?? null,
    annualMaxJobs: doc.annualMaxJobs ?? null,
    isSystem: Boolean(doc.isSystem),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt || null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt || null,
  };
}

async function seedDefaultPackagesIfEmpty(collection) {
  const count = await collection.countDocuments({});
  if (count > 0) return;
  const now = new Date();
  await collection.insertMany(
    DEFAULT_HQ_PACKAGES.map((pkg) => ({
      ...pkg,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

function parseFeatures(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('Features must be an array of bullet points');
  }
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function parsePackageInput(data, { partial = false } = {}) {
  const name = data?.name !== undefined ? String(data.name || '').trim() : undefined;
  if (!partial && !name) {
    throw new Error('Package name is required');
  }

  const description =
    data?.description !== undefined ? String(data.description || '').trim() : undefined;
  const displayName =
    data?.displayName !== undefined ? String(data.displayName || '').trim() : undefined;
  const price = data?.price !== undefined ? String(data.price || '').trim() : undefined;
  const yearlyPrice =
    data?.yearlyPrice !== undefined ? String(data.yearlyPrice || '').trim() : undefined;
  const pricePeriod =
    data?.pricePeriod !== undefined ? String(data.pricePeriod || '').trim() : undefined;
  const features = data?.features !== undefined ? parseFeatures(data.features) : undefined;
  const isPopular = data?.isPopular !== undefined ? Boolean(data.isPopular) : undefined;

  const parseLimit = (value) => {
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('User and job limits must be positive numbers or empty for unlimited');
    }
    return Math.floor(n);
  };

  const maxUsers = data?.maxUsers !== undefined ? parseLimit(data.maxUsers) : undefined;
  const maxJobs = data?.maxJobs !== undefined ? parseLimit(data.maxJobs) : undefined;
  const annualMaxUsers =
    data?.annualMaxUsers !== undefined ? parseLimit(data.annualMaxUsers) : undefined;
  const annualMaxJobs =
    data?.annualMaxJobs !== undefined ? parseLimit(data.annualMaxJobs) : undefined;

  const out = {};
  if (name !== undefined) out.name = name;
  if (displayName !== undefined) out.displayName = displayName;
  if (description !== undefined) out.description = description;
  if (price !== undefined) out.price = price;
  if (yearlyPrice !== undefined) out.yearlyPrice = yearlyPrice;
  if (pricePeriod !== undefined) out.pricePeriod = pricePeriod;
  if (features !== undefined) out.features = features;
  if (isPopular !== undefined) out.isPopular = isPopular;
  if (maxUsers !== undefined) out.maxUsers = maxUsers;
  if (maxJobs !== undefined) out.maxJobs = maxJobs;
  if (annualMaxUsers !== undefined) out.annualMaxUsers = annualMaxUsers;
  if (annualMaxJobs !== undefined) out.annualMaxJobs = annualMaxJobs;
  return out;
}

export const hqPackagesService = {
  async listPackages() {
    const collection = await getCollection();
    await seedDefaultPackagesIfEmpty(collection);
    const docs = await collection.find({}).sort({ isSystem: -1, name: 1 }).toArray();
    return docs.map(toPackageRow);
  },

  async getPackageById(id) {
    if (!ObjectId.isValid(id)) return null;
    const collection = await getCollection();
    await seedDefaultPackagesIfEmpty(collection);
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    return doc ? toPackageRow(doc) : null;
  },

  async resolvePlanInput(raw, billingCycle) {
    const packages = await this.listPackages();
    if (!raw) return null;

    const cycle = resolveBillingCycle(
      billingCycle || (typeof raw === 'object' ? raw?.billingCycle : undefined)
    );

    if (typeof raw === 'string') {
      const s = raw.trim();
      const found = packages.find(
        (p) => p.id === s || p.slug === slugify(s) || p.name.toLowerCase() === s.toLowerCase()
      );
      return found ? toAssignablePlan(found, cycle) : null;
    }

    const id = String(raw.id || '').trim();
    const name = String(raw.name || '').trim();
    const found =
      packages.find((p) => (id && p.id === id) || (name && p.name.toLowerCase() === name.toLowerCase())) ||
      null;
    return found ? toAssignablePlan(found, cycle) : null;
  },

  async createPackage(data) {
    const parsed = parsePackageInput(data);
    const collection = await getCollection();
    await seedDefaultPackagesIfEmpty(collection);

    const slug = slugify(data?.slug || parsed.name);
    if (!slug) throw new Error('Could not generate package slug');

    const existing = await collection.findOne({
      $or: [{ slug }, { name: new RegExp(`^${parsed.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }],
    });
    if (existing) {
      throw new Error('A package with this name already exists');
    }

    const now = new Date();
    const doc = {
      slug,
      displayName: parsed.displayName || parsed.name.toUpperCase(),
      price: parsed.price || '',
      yearlyPrice: parsed.yearlyPrice || '',
      pricePeriod: parsed.pricePeriod || 'per month',
      features: parsed.features || [],
      isPopular: parsed.isPopular ?? false,
      ...parsed,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };
    const result = await collection.insertOne(doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    return toPackageRow(inserted);
  },

  async updatePackage(id, data) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid package id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Package not found');

    const parsed = parsePackageInput(data, { partial: true });
    if (parsed.name && parsed.name.toLowerCase() !== String(existing.name || '').toLowerCase()) {
      const dup = await collection.findOne({
        _id: { $ne: objectId },
        name: new RegExp(`^${parsed.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (dup) throw new Error('A package with this name already exists');
    }

    await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          ...parsed,
          updatedAt: new Date(),
        },
      }
    );
    const updated = await collection.findOne({ _id: objectId });
    return toPackageRow(updated);
  },

  async deletePackage(id) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid package id');
    const collection = await getCollection();
    const objectId = new ObjectId(id);
    const existing = await collection.findOne({ _id: objectId });
    if (!existing) throw new Error('Package not found');
    if (existing.isSystem) {
      throw new Error('System packages (Starter, Professional, Enterprise) cannot be deleted');
    }
    await collection.deleteOne({ _id: objectId });
    return { deleted: true, id };
  },
};
