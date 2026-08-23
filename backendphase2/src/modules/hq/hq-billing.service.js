import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { hqDemosService } from './hq-demos.service.js';
import { hqPackagesService } from './hq-packages.service.js';
import { hqPhase1TokensService } from './hq-phase1-tokens.service.js';
import {
  listAllTenantBillingTransactions,
  listTenantBillingTransactions,
} from './hq-billing-ledger.service.js';

const DEFAULT_LIMIT = Math.min(
  1000,
  Math.max(100, Number(process.env.HQ_BILLING_LIST_MAX || 500) || 500),
);

let portalMongoClient = null;

async function getPortalMongoDb() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) return null;
  if (!portalMongoClient) {
    portalMongoClient = new MongoClient(url);
    await portalMongoClient.connect();
  }
  return portalMongoClient.db();
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isHqSetupAccount(row) {
  const email = normalizeEmail(row?.email);
  const db = String(row?.tenantDbName || '').toLowerCase().trim();
  if (email === 'admin@gmail.com') return true;
  if (db === 'hq_admin' || db.startsWith('hqadmin')) return true;
  return false;
}

function mapTenantCycle(row, packages) {
  const plan = row?.subscriptionPlan || {};
  const pkg =
    packages.find((p) => p.id === plan.id) ||
    packages.find((p) => String(p.name || '').toLowerCase() === String(plan.name || '').toLowerCase()) ||
    null;
  const billingCycle = plan.billingCycle === 'annual' ? 'annual' : 'monthly';
  const price =
    plan.price ||
    (billingCycle === 'annual' ? pkg?.yearlyPrice : pkg?.price) ||
    null;

  return {
    tenantId: String(row?.id || row?._id || ''),
    tenantName: row?.organizationName || row?.name || '—',
    email: row?.email || '',
    tenantDbName: row?.tenantDbName || '',
    signupSource: row?.signupSource || 'hq_manual',
    planName: plan.name || '—',
    planId: plan.id || null,
    billingCycle,
    price: price != null ? String(price) : null,
    planStartDate: plan.planStartDate || null,
    planEndDate: plan.planEndDate || null,
    purchasedAt: plan.purchasedAt || null,
    upgradedAt: plan.upgradedAt || null,
    lastPaymentReference: plan.lastPaymentReference || null,
    isTrial: Boolean(plan.isTrial),
    aiCoins: Number(plan.coins ?? 0) || 0,
    status: row?.status || 'ACTIVE',
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  };
}

async function loadCandidateDirectory(db, candidateIds) {
  const map = new Map();
  if (!db || !candidateIds.length) return map;
  const objectIds = candidateIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (!objectIds.length) return map;

  const docs = await db
    .collection('candidates')
    .find({ _id: { $in: objectIds } })
    .project({ name: 1, firstName: 1, lastName: 1, email: 1, phone: 1, title: 1, tokenBalance: 1 })
    .toArray();

  for (const doc of docs) {
    map.set(String(doc._id), {
      id: String(doc._id),
      name: doc.name || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || '',
      email: doc.email || '',
      phone: doc.phone || '',
      title: doc.title || '',
      tokenBalance: Number(doc.tokenBalance ?? 0) || 0,
    });
  }
  return map;
}

function buildPackLabelMap(packs) {
  const map = new Map();
  for (const pack of packs || []) {
    if (pack?.id) map.set(String(pack.id), pack.name || pack.id);
  }
  return map;
}

function mapCandidateTransaction(row, candidateMap, packMap) {
  const candidateId = String(row.candidateId || '');
  const candidate = candidateMap.get(candidateId) || {};
  const type = String(row.type || '').toUpperCase();
  const packageId = String(row.packageId || '').trim();
  const amount = Math.abs(Number(row.amount) || 0);
  const isSpend = type === 'SPEND';

  return {
    id: String(row._id || ''),
    candidateId,
    candidateName: candidate.name || '—',
    candidateEmail: candidate.email || '',
    candidatePhone: candidate.phone || '',
    type,
    label:
      type === 'PURCHASE'
        ? 'Coin purchase'
        : type === 'SPEND'
          ? 'Coin spend'
          : type === 'GRANT'
            ? 'Coin grant'
            : type,
    amount,
    direction: isSpend ? 'debit' : 'credit',
    unit: 'coins',
    balanceAfter: Number(row.balanceAfter) || 0,
    packageId: packageId || null,
    packageName: packMap.get(packageId) || row.service || packageId || '',
    service: row.service || '',
    reference: row.reference || '',
    description: row.description || '',
    occurredAt: toIso(row.createdAt),
  };
}

function buildEmployerSubscriptionTransactions(tenant, packages) {
  const cycle = mapTenantCycle(tenant, packages);
  const rows = [];

  if (cycle.purchasedAt || cycle.lastPaymentReference) {
    rows.push({
      id: `sub_${cycle.tenantId}_purchase`,
      tenantId: cycle.tenantId,
      tenantName: cycle.tenantName,
      email: cycle.email,
      tenantDbName: cycle.tenantDbName,
      type: 'SUBSCRIPTION',
      label: 'Subscription purchase',
      amount: cycle.price ? Number(cycle.price) || 0 : 0,
      direction: 'credit',
      unit: 'INR',
      reference: cycle.lastPaymentReference || '',
      description: `${cycle.planName} · ${cycle.billingCycle}`,
      occurredAt: toIso(cycle.purchasedAt) || cycle.createdAt,
      actorEmail: cycle.email,
    });
  }

  if (cycle.upgradedAt) {
    rows.push({
      id: `sub_${cycle.tenantId}_upgrade`,
      tenantId: cycle.tenantId,
      tenantName: cycle.tenantName,
      email: cycle.email,
      tenantDbName: cycle.tenantDbName,
      type: 'PLAN_UPGRADE',
      label: 'Plan upgrade',
      amount: cycle.price ? Number(cycle.price) || 0 : 0,
      direction: 'credit',
      unit: 'INR',
      reference: cycle.lastPaymentReference || '',
      description: `Upgraded to ${cycle.planName}`,
      occurredAt: toIso(cycle.upgradedAt),
      actorEmail: cycle.email,
    });
  }

  return rows;
}

function mapEmployerLedgerTransaction(row, tenantByDb, tenantByEmail) {
  const tenant =
    tenantByDb.get(row.tenantDbName) ||
    tenantByEmail.get(normalizeEmail(row.tenantEmail)) ||
    null;
  const type = String(row.type || '').toUpperCase();
  const isSpend = type === 'COIN_SPEND';

  return {
    id: row.id,
    tenantId: tenant?.tenantId || '',
    tenantName: tenant?.tenantName || tenant?.organizationName || tenant?.name || '—',
    email: row.tenantEmail || tenant?.email || '',
    tenantDbName: row.tenantDbName || tenant?.tenantDbName || '',
    type,
    label:
      type === 'COIN_PURCHASE'
        ? 'AI coin purchase'
        : type === 'COIN_SPEND'
          ? 'AI coin spend'
          : type.replace(/_/g, ' ').toLowerCase(),
    amount: Number(row.amount) || 0,
    direction: isSpend ? 'debit' : 'credit',
    unit: row.unit || 'coins',
    balanceAfter: Number(row.balanceAfter) || 0,
    reference: row.reference || '',
    description: row.description || '',
    featureId: row.featureId || '',
    packId: row.packId || '',
    occurredAt: row.occurredAt,
    actorEmail: row.actorEmail || row.tenantEmail || '',
  };
}

function summarizeLedger(transactions) {
  let purchases = 0;
  let spends = 0;
  let grants = 0;
  let coinsIn = 0;
  let coinsOut = 0;

  for (const row of transactions) {
    const type = String(row.type || '').toUpperCase();
    const amount = Number(row.amount) || 0;
    if (type === 'PURCHASE' || type === 'COIN_PURCHASE' || type === 'SUBSCRIPTION' || type === 'PLAN_UPGRADE') {
      purchases += 1;
      if (row.unit !== 'INR') coinsIn += amount;
    } else if (type === 'SPEND' || type === 'COIN_SPEND') {
      spends += 1;
      coinsOut += amount;
    } else if (type === 'GRANT') {
      grants += 1;
      coinsIn += amount;
    }
  }

  return { purchases, spends, grants, coinsIn, coinsOut, total: transactions.length };
}

async function fetchCandidateTransactions({ limit = DEFAULT_LIMIT, candidateId } = {}) {
  const db = await getPortalMongoDb();
  if (!db) return { transactions: [], stats: summarizeLedger([]) };

  const filter = candidateId ? { candidateId: new ObjectId(candidateId) } : {};
  const rows = await db
    .collection('token_transactions')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), DEFAULT_LIMIT))
    .toArray();

  const candidateIds = [...new Set(rows.map((row) => String(row.candidateId || '')).filter(Boolean))];
  const candidateMap = await loadCandidateDirectory(db, candidateIds);
  const packsOverview = await hqPhase1TokensService.getOverview({ includeInactive: true }).catch(() => ({ packs: [] }));
  const packMap = buildPackLabelMap(packsOverview?.packs);

  const transactions = rows.map((row) => mapCandidateTransaction(row, candidateMap, packMap));
  return { transactions, stats: summarizeLedger(transactions) };
}

export const hqBillingService = {
  async listCandidateTransactions(options = {}) {
    return fetchCandidateTransactions(options);
  },

  async getCandidateLedger(candidateId) {
    const db = await getPortalMongoDb();
    if (!db || !ObjectId.isValid(candidateId)) {
      throw new Error('Invalid candidate id');
    }

    const candidateMap = await loadCandidateDirectory(db, [candidateId]);
    const candidate = candidateMap.get(String(candidateId)) || {
      id: candidateId,
      name: '—',
      email: '',
      phone: '',
      title: '',
      tokenBalance: 0,
    };

    const { transactions, stats } = await fetchCandidateTransactions({
      limit: DEFAULT_LIMIT,
      candidateId,
    });

    return { entity: { ...candidate, phase: 'phase1' }, transactions, stats };
  },

  async listEmployerTransactions({ limit = DEFAULT_LIMIT } = {}) {
    const [tenants, packages, ledgerRows, demosResult] = await Promise.all([
      headquartersAuthService.listTenants(),
      hqPackagesService.listPackages(),
      listAllTenantBillingTransactions({ limit }),
      hqDemosService.listDemoRequests(),
    ]);

    const activeTenants = (tenants || []).filter((t) => !t.isDeleted && !isHqSetupAccount(t));
    const tenantByDb = new Map();
    const tenantByEmail = new Map();
    for (const tenant of activeTenants) {
      const cycle = mapTenantCycle(tenant, packages);
      tenantByDb.set(cycle.tenantDbName, cycle);
      if (cycle.email) tenantByEmail.set(normalizeEmail(cycle.email), cycle);
    }

    const subscriptionRows = activeTenants.flatMap((tenant) =>
      buildEmployerSubscriptionTransactions(tenant, packages),
    );

    const coinRows = ledgerRows.map((row) => mapEmployerLedgerTransaction(row, tenantByDb, tenantByEmail));

    const landingRows = (demosResult?.demos || [])
      .filter((row) => row.requestKind === 'purchase')
      .map((row) => ({
        id: `landing_${row.id}`,
        tenantId: '',
        tenantName: row.organizationName || '—',
        email: row.email || '',
        tenantDbName: row.trialTenantDbName || '',
        type: 'LANDING_PURCHASE',
        label: 'Landing purchase request',
        amount: 0,
        direction: 'credit',
        unit: 'INR',
        reference: String(row.id || ''),
        description: `${row.packageName || row.packageSlug || 'Package'} · ${row.billingCycle || 'monthly'}`,
        occurredAt: toIso(row.submittedAt || row.createdAt),
        actorEmail: row.email || '',
      }));

    const transactions = [...subscriptionRows, ...coinRows, ...landingRows].sort((a, b) =>
      String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')),
    );

    return {
      transactions: transactions.slice(0, limit),
      stats: summarizeLedger(transactions),
    };
  },

  async getEmployerLedger(tenantKey) {
    const key = String(tenantKey || '').trim();
    if (!key) throw new Error('Tenant key is required');

    const [tenants, packages, ledgerRows] = await Promise.all([
      headquartersAuthService.listTenants(),
      hqPackagesService.listPackages(),
      listTenantBillingTransactions({
        tenantDbName: key.includes('@') ? undefined : key,
        tenantEmail: key.includes('@') ? key : undefined,
        limit: DEFAULT_LIMIT,
      }),
    ]);

    let tenant = (tenants || []).find(
      (row) =>
        String(row.tenantDbName || '').trim() === key ||
        normalizeEmail(row.email) === normalizeEmail(key) ||
        String(row.id || row._id || '') === key,
    );

    if (!tenant || tenant.isDeleted || isHqSetupAccount(tenant)) {
      tenant = (tenants || []).find((row) => normalizeEmail(row.email) === normalizeEmail(key));
    }

    if (!tenant) throw new Error('Tenant not found');

    const cycle = mapTenantCycle(tenant, packages);
    const subscriptionRows = buildEmployerSubscriptionTransactions(tenant, packages);
    const tenantByDb = new Map([[cycle.tenantDbName, cycle]]);
    const tenantByEmail = new Map([[normalizeEmail(cycle.email), cycle]]);
    const coinRows = ledgerRows.map((row) => mapEmployerLedgerTransaction(row, tenantByDb, tenantByEmail));

    const transactions = [...subscriptionRows, ...coinRows].sort((a, b) =>
      String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')),
    );

    return {
      entity: {
        phase: 'phase2',
        tenantId: cycle.tenantId,
        tenantName: cycle.tenantName,
        email: cycle.email,
        tenantDbName: cycle.tenantDbName,
        planName: cycle.planName,
        billingCycle: cycle.billingCycle,
        aiCoins: cycle.aiCoins,
        price: cycle.price,
        planStartDate: cycle.planStartDate,
        planEndDate: cycle.planEndDate,
      },
      transactions,
      stats: summarizeLedger(transactions),
    };
  },

  async getBillingOverview() {
    const [candidateResult, employerResult, tenants, demosResult, packages, packsOverview] =
      await Promise.all([
        this.listCandidateTransactions({ limit: DEFAULT_LIMIT }),
        this.listEmployerTransactions({ limit: DEFAULT_LIMIT }),
        headquartersAuthService.listTenants(),
        hqDemosService.listDemoRequests(),
        hqPackagesService.listPackages(),
        hqPhase1TokensService.getOverview({ includeInactive: true }).catch(() => ({ packs: [] })),
      ]);

    const candidateTx = candidateResult.transactions;
    const employerTx = employerResult.transactions;
    const activeTenants = (tenants || []).filter((t) => !t.isDeleted && !isHqSetupAccount(t));
    const tenantCycles = activeTenants.map((row) => mapTenantCycle(row, packages));
    const onPlan = tenantCycles.filter((row) => row.planName && row.planName !== '—');
    const purchaseRequests = (demosResult?.demos || []).filter((row) => row.requestKind === 'purchase');

    return {
      employer: {
        totalTenants: tenantCycles.length,
        tenantsOnPlan: onPlan.length,
        monthlyCycles: onPlan.filter((row) => row.billingCycle === 'monthly').length,
        annualCycles: onPlan.filter((row) => row.billingCycle === 'annual').length,
        landingPurchases: tenantCycles.filter((row) => row.signupSource === 'landing_purchase').length,
        purchaseRequests: purchaseRequests.length,
        coinPurchases: employerTx.filter((t) => t.type === 'COIN_PURCHASE').length,
        coinSpends: employerTx.filter((t) => t.type === 'COIN_SPEND').length,
        totalTransactions: employerTx.length,
      },
      candidate: {
        totalPurchases: candidateResult.stats.purchases,
        totalSpends: candidateResult.stats.spends,
        totalGrants: candidateResult.stats.grants,
        totalTokensSold: candidateResult.stats.coinsIn,
        totalTokensSpent: candidateResult.stats.coinsOut,
        uniqueBuyers: new Set(candidateTx.filter((t) => t.type === 'PURCHASE').map((t) => t.candidateId)).size,
        activePackTypes: Array.isArray(packsOverview?.packs) ? packsOverview.packs.length : 0,
        totalTransactions: candidateTx.length,
      },
      generatedAt: new Date().toISOString(),
    };
  },

  async listCandidatePurchases(options = {}) {
    const result = await fetchCandidateTransactions(options);
    const purchases = result.transactions.filter((row) => row.type === 'PURCHASE');
    return {
      purchases,
      stats: {
        totalPurchases: purchases.length,
        totalTokensSold: purchases.reduce((sum, row) => sum + row.amount, 0),
        uniqueBuyers: new Set(purchases.map((row) => row.candidateId)).size,
      },
    };
  },

  async listEmployerBilling() {
    const [tenants, demosResult, packages, employerTxResult] = await Promise.all([
      headquartersAuthService.listTenants(),
      hqDemosService.listDemoRequests(),
      hqPackagesService.listPackages(),
      this.listEmployerTransactions({ limit: DEFAULT_LIMIT }),
    ]);

    const activeTenants = (tenants || []).filter((t) => !t.isDeleted && !isHqSetupAccount(t));
    const tenantCycles = activeTenants
      .map((row) => mapTenantCycle(row, packages))
      .sort((a, b) => String(b.purchasedAt || b.planStartDate || '').localeCompare(String(a.purchasedAt || a.planStartDate || '')));

    const purchaseRequests = (demosResult?.demos || [])
      .filter((row) => row.requestKind === 'purchase')
      .map((row) => ({
        id: String(row?.id || row?._id || ''),
        fullName: row?.fullName || row?.name || '—',
        email: row?.email || '',
        organizationName: row?.organizationName || '—',
        requestKind: row?.requestKind || 'purchase',
        packageName: row?.packageName || row?.packageSlug || '—',
        packageSlug: row?.packageSlug || '',
        billingCycle: row?.billingCycle === 'annual' ? 'annual' : 'monthly',
        trialProvisioned: Boolean(row?.trialProvisioned),
        trialTenantDbName: row?.trialTenantDbName || '',
        status: row?.status || 'PENDING',
        submittedAt: toIso(row?.submittedAt || row?.createdAt),
        createdAt: toIso(row?.createdAt),
      }));

    const onPlan = tenantCycles.filter((row) => row.planName && row.planName !== '—');

    return {
      tenantCycles,
      purchaseRequests,
      transactions: employerTxResult.transactions,
      stats: {
        totalTenants: tenantCycles.length,
        tenantsOnPlan: onPlan.length,
        monthlyCycles: onPlan.filter((row) => row.billingCycle === 'monthly').length,
        annualCycles: onPlan.filter((row) => row.billingCycle === 'annual').length,
        landingPurchases: tenantCycles.filter((row) => row.signupSource === 'landing_purchase').length,
        purchaseRequests: purchaseRequests.length,
        totalTransactions: employerTxResult.transactions.length,
      },
    };
  },

  async getBilling() {
    const [overview, candidate, employer] = await Promise.all([
      this.getBillingOverview(),
      this.listCandidateTransactions({ limit: DEFAULT_LIMIT }),
      this.listEmployerBilling(),
    ]);

    return {
      overview,
      candidate,
      employer,
    };
  },
};
