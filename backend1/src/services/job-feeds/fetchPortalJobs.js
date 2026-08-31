/**
 * Load every job document from the portal Mongo `jobs` collection.
 * Uses a cursor / skip-take loop so the XML feeds are not capped at 10/20/50/2000.
 */

const JOB_FEED_PROJECTION = {
  title: 1,
  description: 1,
  overview: 1,
  aboutRole: 1,
  location: 1,
  city: 1,
  country: 1,
  state: 1,
  status: 1,
  statusLabel: 1,
  isActive: 1,
  isDeleted: 1,
  expectedClosureDate: 1,
  clientId: 1,
  companyId: 1,
  salary: 1,
  salaryMin: 1,
  salaryMax: 1,
  salaryCurrency: 1,
  salaryType: 1,
  type: 1,
  employmentType: 1,
  workMode: 1,
  jobLocationType: 1,
  jobCategory: 1,
  industry: 1,
  department: 1,
  keyResponsibilities: 1,
  requirements: 1,
  candidateRequirements: 1,
  preferredSkills: 1,
  skills: 1,
  benefits: 1,
  postedAt: 1,
  postedDate: 1,
  createdAt: 1,
  updatedAt: 1,
  showClientNamePublicly: 1,
  hqHideClientName: 1,
  publicFieldVisibility: 1,
  publishToAdzuna: 1,
  publishToCareerjet: 1,
  distributionPlatforms: 1,
  geo_lat: 1,
  geoLat: 1,
  geo_lng: 1,
  geoLng: 1,
  postcode: 1,
  postalCode: 1,
};

const BATCH_SIZE = 500;
const MAX_JOBS = 250000;

function mongoId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.$oid) return String(value.$oid);
  return String(value);
}

function cursorIdValue(cursor) {
  const id = cursor?.id;
  if (id == null) return '0';
  if (typeof id === 'object' && id.$numberLong != null) return String(id.$numberLong);
  return String(id);
}

function batchFromCommand(result) {
  if (Array.isArray(result?.cursor?.firstBatch)) return result.cursor.firstBatch;
  if (Array.isArray(result?.cursor?.nextBatch)) return result.cursor.nextBatch;
  if (Array.isArray(result?.documents)) return result.documents;
  return [];
}

function normalizeRawJob(doc, clientById = new Map()) {
  const id = mongoId(doc._id) || mongoId(doc.id);
  const clientId = mongoId(doc.clientId);
  return {
    ...doc,
    id,
    clientId: clientId || null,
    client: clientById.get(clientId) || doc.client || null,
    company: doc.company || null,
  };
}

async function loadClientsByIds(prismaClient, clientIds) {
  const clientById = new Map();
  const ids = [...new Set(clientIds.filter((id) => /^[a-fA-F0-9]{24}$/.test(id)))];
  if (!ids.length) return clientById;

  if (typeof prismaClient?.$runCommandRaw === 'function') {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const slice = ids.slice(i, i + BATCH_SIZE);
      const clients = await prismaClient.$runCommandRaw({
        find: 'clients',
        filter: { _id: { $in: slice.map((id) => ({ $oid: id })) } },
        projection: { companyName: 1, website: 1 },
      });
      for (const row of batchFromCommand(clients)) {
        clientById.set(mongoId(row._id), {
          companyName: row.companyName || '',
          website: row.website || '',
        });
      }
    }
    return clientById;
  }

  if (typeof prismaClient?.client?.findMany === 'function') {
    const rows = await prismaClient.client.findMany({
      where: { id: { in: ids } },
      select: { id: true, companyName: true, website: true },
    });
    for (const row of rows) {
      clientById.set(row.id, {
        companyName: row.companyName || '',
        website: row.website || '',
      });
    }
  }
  return clientById;
}

async function fetchJobsViaPrisma(prismaClient) {
  const docs = [];
  let skip = 0;
  for (;;) {
    const page = await prismaClient.job.findMany({
      skip,
      take: BATCH_SIZE,
      include: {
        client: { select: { companyName: true, website: true } },
        company: { select: { name: true, website: true } },
      },
    });
    if (!Array.isArray(page) || page.length === 0) break;
    docs.push(...page);
    if (docs.length >= MAX_JOBS) break;
    if (page.length < BATCH_SIZE) break;
    skip += page.length;
  }
  return docs.map((doc) => normalizeRawJob(doc));
}

async function fetchJobsViaMongoCursor(prismaClient) {
  const docs = [];
  const first = await prismaClient.$runCommandRaw({
    find: 'jobs',
    filter: {},
    projection: JOB_FEED_PROJECTION,
    sort: { postedDate: -1 },
    batchSize: BATCH_SIZE,
  });
  docs.push(...batchFromCommand(first));
  let cursorId = cursorIdValue(first?.cursor);
  const collection = String(first?.cursor?.ns || '').split('.').pop() || 'jobs';

  while (cursorId && cursorId !== '0' && docs.length < MAX_JOBS) {
    const more = await prismaClient.$runCommandRaw({
      getMore: { $numberLong: cursorId },
      collection,
      batchSize: BATCH_SIZE,
    });
    const batch = batchFromCommand(more);
    if (!batch.length) break;
    docs.push(...batch);
    cursorId = cursorIdValue(more?.cursor);
    if (batch.length < BATCH_SIZE && (cursorId === '0' || !cursorId)) break;
  }

  const clientIds = docs.map((doc) => mongoId(doc.clientId));
  const clientById = await loadClientsByIds(prismaClient, clientIds);
  return docs.slice(0, MAX_JOBS).map((doc) => normalizeRawJob(doc, clientById));
}

async function fetchAllPortalJobs(prismaClient) {
  if (!prismaClient) {
    throw new Error('Database client is unavailable');
  }
  if (typeof prismaClient.$runCommandRaw === 'function') {
    return fetchJobsViaMongoCursor(prismaClient);
  }
  if (typeof prismaClient.job?.findMany === 'function') {
    return fetchJobsViaPrisma(prismaClient);
  }
  throw new Error('Database client cannot list jobs');
}

module.exports = {
  BATCH_SIZE,
  MAX_JOBS,
  JOB_FEED_PROJECTION,
  mongoId,
  fetchAllPortalJobs,
  normalizeRawJob,
};
