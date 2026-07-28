const { prisma } = require('../lib/prisma');
const {
  WELCOME_TOKEN_AMOUNT,
  getServiceCost,
  getPurchasePack,
  SERVICE_CATALOG,
  PURCHASE_PACKS,
  EARN_TASK_CATALOG,
  PROFILE_SECTION_EARN_MAP,
  REOPENABLE_EARN_KEYS,
  getEarnReward,
  getBaseEarnKey,
  getRepeatEarnAmount,
  ledgerServiceForCycle,
  openMarkerService,
  isOpenMarkerService,
  isPaidEarnService,
} = require('../constants/tokenCatalog');

function resolveCandidateId(user) {
  if (!user) return null;
  return user.candidateId || user.id || null;
}

async function getBalance(candidateId) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      tokenBalance: true,
      freeTokensGrantedAt: true,
    },
  });
  if (!candidate) {
    const err = new Error('Candidate not found');
    err.status = 404;
    throw err;
  }
  return {
    tokenBalance: candidate.tokenBalance ?? 0,
    freeTokensGrantedAt: candidate.freeTokensGrantedAt,
    welcomeAmount: WELCOME_TOKEN_AMOUNT,
  };
}

/**
 * Idempotent: grants WELCOME_TOKEN_AMOUNT once when the candidate first hits dashboard.
 */
async function grantWelcomeTokensIfNeeded(candidateId) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      tokenBalance: true,
      freeTokensGrantedAt: true,
    },
  });

  if (!candidate) {
    return { granted: false, tokenBalance: 0 };
  }

  if (candidate.freeTokensGrantedAt) {
    return {
      granted: false,
      tokenBalance: candidate.tokenBalance ?? 0,
      freeTokensGrantedAt: candidate.freeTokensGrantedAt,
    };
  }

  const now = new Date();
  const newBalance = (candidate.tokenBalance ?? 0) + WELCOME_TOKEN_AMOUNT;

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      tokenBalance: newBalance,
      freeTokensGrantedAt: now,
    },
  });

  try {
    await prisma.tokenTransaction.create({
      data: {
        candidateId,
        type: 'GRANT',
        amount: WELCOME_TOKEN_AMOUNT,
        balanceAfter: newBalance,
        description: `Welcome bonus: ${WELCOME_TOKEN_AMOUNT} free tokens`,
        service: 'welcome',
      },
    });
  } catch (err) {
    console.warn('[tokens] Failed to write GRANT ledger:', err?.message || err);
  }

  try {
    const { createCandidateNotification } = require('./notification.service');
    void createCandidateNotification(candidateId, {
      type: 'system',
      title: `+${WELCOME_TOKEN_AMOUNT} tokens earned`,
      description: 'Welcome bonus credited for joining the dashboard.',
      actionButton: 'View balance',
      actionPath: '/subscriptions',
      metadata: { kind: 'token_earn', channel: 'activity', earnKey: 'welcome', amount: WELCOME_TOKEN_AMOUNT },
    });
  } catch {
    /* non-fatal */
  }

  return {
    granted: true,
    tokenBalance: newBalance,
    freeTokensGrantedAt: now,
    amount: WELCOME_TOKEN_AMOUNT,
  };
}

/**
 * Deduct tokens for a catalogued service. Throws with status 402 if insufficient.
 */
async function spendTokens(candidateId, serviceId) {
  const cost = getServiceCost(serviceId);
  if (cost == null) {
    const err = new Error(`Unknown billable service: ${serviceId}`);
    err.status = 400;
    throw err;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { tokenBalance: true },
  });

  if (!candidate) {
    const err = new Error('Candidate not found');
    err.status = 404;
    throw err;
  }

  const balance = candidate.tokenBalance ?? 0;
  if (balance < cost) {
    const err = new Error('Insufficient tokens');
    err.status = 402;
    err.code = 'INSUFFICIENT_TOKENS';
    err.balance = balance;
    err.required = cost;
    err.service = serviceId;
    throw err;
  }

  const newBalance = balance - cost;

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { tokenBalance: newBalance },
  });

  try {
    await prisma.tokenTransaction.create({
      data: {
        candidateId,
        type: 'SPEND',
        amount: cost,
        balanceAfter: newBalance,
        service: serviceId,
        description: `Spent ${cost} tokens on ${serviceId}`,
      },
    });
  } catch (err) {
    console.warn('[tokens] Failed to write SPEND ledger:', err?.message || err);
  }

  return { tokenBalance: newBalance, spent: cost, service: serviceId };
}

/**
 * Deduct an explicit token amount (e.g. course unlock with per-course pricing).
 * Uses atomic decrement + retries on write conflicts / deadlocks (P2034).
 */
async function spendTokensAmount(candidateId, cost, serviceId, description) {
  const amount = Number(cost) || 0;
  if (amount <= 0) {
    const bal = await getBalance(candidateId);
    return { tokenBalance: bal.tokenBalance, spent: 0, service: serviceId };
  }

  const maxAttempts = 5;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const candidate = await tx.candidate.findUnique({
            where: { id: candidateId },
            select: { tokenBalance: true },
          });

          if (!candidate) {
            const err = new Error('Candidate not found');
            err.status = 404;
            throw err;
          }

          const balance = candidate.tokenBalance ?? 0;
          if (balance < amount) {
            const err = new Error('Insufficient tokens');
            err.status = 402;
            err.code = 'INSUFFICIENT_TOKENS';
            err.balance = balance;
            err.required = amount;
            err.service = serviceId;
            throw err;
          }

          const updated = await tx.candidate.update({
            where: { id: candidateId },
            data: { tokenBalance: { decrement: amount } },
            select: { tokenBalance: true },
          });

          const newBalance = updated.tokenBalance ?? balance - amount;

          try {
            await tx.tokenTransaction.create({
              data: {
                candidateId,
                type: 'SPEND',
                amount,
                balanceAfter: newBalance,
                service: serviceId,
                description: description || `Spent ${amount} tokens on ${serviceId}`,
              },
            });
          } catch (err) {
            console.warn('[tokens] Failed to write SPEND ledger:', err?.message || err);
          }

          return { tokenBalance: newBalance, spent: amount, service: serviceId };
        },
        { maxWait: 5000, timeout: 15000 },
      );
      return result;
    } catch (err) {
      lastErr = err;
      const code = err?.code || err?.meta?.code;
      const msg = String(err?.message || '');
      const retryable =
        code === 'P2034' ||
        /write conflict|deadlock|could not serialize|transaction failed/i.test(msg);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 40 * attempt + Math.floor(Math.random() * 40)));
    }
  }

  throw lastErr;
}

/**
 * Credit an explicit token amount (refunds / reference-check payouts).
 * Atomic increment + retries on write conflicts.
 */
async function grantTokensAmount(candidateId, amount, serviceId, description) {
  const credit = Number(amount) || 0;
  if (credit <= 0) {
    const bal = await getBalance(candidateId);
    return { tokenBalance: bal.tokenBalance, granted: 0, service: serviceId };
  }

  const maxAttempts = 5;
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const candidate = await tx.candidate.findUnique({
            where: { id: candidateId },
            select: { tokenBalance: true },
          });

          if (!candidate) {
            const err = new Error('Candidate not found');
            err.status = 404;
            throw err;
          }

          const updated = await tx.candidate.update({
            where: { id: candidateId },
            data: { tokenBalance: { increment: credit } },
            select: { tokenBalance: true },
          });

          const newBalance = updated.tokenBalance ?? (candidate.tokenBalance ?? 0) + credit;

          try {
            await tx.tokenTransaction.create({
              data: {
                candidateId,
                type: 'GRANT',
                amount: credit,
                balanceAfter: newBalance,
                service: serviceId || 'grant.amount',
                description: description || `Granted ${credit} tokens`,
              },
            });
          } catch (err) {
            console.warn('[tokens] Failed to write GRANT ledger:', err?.message || err);
          }

          return { tokenBalance: newBalance, granted: credit, service: serviceId };
        },
        { maxWait: 5000, timeout: 15000 },
      );
      return result;
    } catch (err) {
      lastErr = err;
      const code = err?.code || err?.meta?.code;
      const msg = String(err?.message || '');
      const retryable =
        code === 'P2034' ||
        /write conflict|deadlock|could not serialize|transaction failed/i.test(msg);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 40 * attempt + Math.floor(Math.random() * 40)));
    }
  }

  throw lastErr;
}

/**
 * Mock purchase — credits tokens without a real payment gateway.
 */
async function purchasePack(candidateId, packageId, paymentReference) {
  const pack = getPurchasePack(packageId);
  if (!pack) {
    const err = new Error('Invalid package');
    err.status = 400;
    throw err;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { tokenBalance: true },
  });

  if (!candidate) {
    const err = new Error('Candidate not found');
    err.status = 404;
    throw err;
  }

  const newBalance = (candidate.tokenBalance ?? 0) + pack.tokens;
  const reference =
    paymentReference ||
    `mock_${pack.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { tokenBalance: newBalance },
  });

  try {
    await prisma.tokenTransaction.create({
      data: {
        candidateId,
        type: 'PURCHASE',
        amount: pack.tokens,
        balanceAfter: newBalance,
        packageId: pack.id,
        reference,
        description: `Purchased ${pack.name} pack (${pack.tokens} tokens for ${pack.priceLabel})`,
      },
    });
  } catch (err) {
    console.warn('[tokens] Failed to write PURCHASE ledger:', err?.message || err);
  }

  return {
    tokenBalance: newBalance,
    pack,
    reference,
    credited: pack.tokens,
  };
}

async function listRecentTransactions(candidateId, limit = 20) {
  if (!prisma.tokenTransaction?.findMany) return [];
  return prisma.tokenTransaction.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });
}

function getCatalog() {
  return {
    services: SERVICE_CATALOG,
    packs: PURCHASE_PACKS,
    earnTasks: EARN_TASK_CATALOG,
    welcomeAmount: WELCOME_TOKEN_AMOUNT,
  };
}

/**
 * Backfill earns for work already done (signup CV, first dashboard, filled sections).
 * Also reopens profile earn tasks when the user undoes a section.
 */
async function syncLifecycleEarns(candidateId) {
  const granted = [];
  if (!candidateId) return { granted };

  try {
    const welcome = await grantWelcomeTokensIfNeeded(candidateId);
    if (welcome?.granted) {
      granted.push({ earnKey: 'welcome', amount: welcome.amount || WELCOME_TOKEN_AMOUNT });
    }
  } catch (err) {
    console.warn('[tokens] lifecycle welcome sync skipped:', err?.message || err);
  }

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        resumeUrl: true,
        resume: { select: { id: true } },
      },
    });
    const hasCv = Boolean(candidate?.resume?.id || candidate?.resumeUrl);
    if (hasCv) {
      const cvEarn = await earnOnce(
        candidateId,
        'earn.cv_upload',
        'Earned tokens for CV on file (upload or signup)'
      );
      if (cvEarn?.granted) {
        granted.push({ earnKey: 'earn.cv_upload', amount: cvEarn.amount });
      }
    }
  } catch (err) {
    console.warn('[tokens] lifecycle CV sync skipped:', err?.message || err);
  }

  try {
    const { getMissingProfileSections } = require('../utils/profile-completeness.util');
    const completeness = await getMissingProfileSections(candidateId, { persist: false });
    const sections = completeness?.sections || [];
    const completedKeys = sections.filter((s) => s.isComplete).map((s) => s.key).filter(Boolean);
    const incompleteKeys = sections.filter((s) => !s.isComplete).map((s) => s.key).filter(Boolean);

    await reopenProfileEarnsIfNeeded(candidateId, incompleteKeys);

    if (completedKeys.length) {
      const sectionEarns = await grantProfileSectionEarns(candidateId, completedKeys);
      for (const e of sectionEarns) {
        if (e?.granted) granted.push({ earnKey: e.earnKey, amount: e.amount, cycle: e.cycle });
      }
    }
  } catch (err) {
    console.warn('[tokens] lifecycle profile sync skipped:', err?.message || err);
  }

  return { granted };
}

/** Ledger rows for one earn family (base + repeats + open markers). */
async function listEarnFamilyRows(candidateId, baseEarnKey) {
  if (!candidateId || !baseEarnKey || !prisma.tokenTransaction?.findMany) return [];
  try {
    const rows = await prisma.tokenTransaction.findMany({
      where: {
        candidateId,
        type: 'GRANT',
        OR: [
          { service: baseEarnKey },
          { service: { startsWith: `${baseEarnKey}.` } },
        ],
      },
      select: { id: true, service: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows || [];
  } catch (err) {
    console.warn('[tokens] listEarnFamilyRows failed:', err?.message || err);
    return [];
  }
}

/**
 * Open cycle = user can earn again (never paid, or undid section after a paid grant).
 */
async function getEarnCycleState(candidateId, earnKey) {
  const baseKey = getBaseEarnKey(earnKey);
  const rows = await listEarnFamilyRows(candidateId, baseKey);
  const paidCount = rows.filter(
    (r) => (r.amount || 0) > 0 && isPaidEarnService(r.service, baseKey)
  ).length;
  const last = rows[0];

  if (!last) {
    return { baseKey, cycleIndex: 1, canGrant: true, paidCount: 0, reopenable: REOPENABLE_EARN_KEYS.has(baseKey) };
  }

  if (isOpenMarkerService(last.service)) {
    return {
      baseKey,
      cycleIndex: paidCount + 1,
      canGrant: true,
      paidCount,
      reopenable: REOPENABLE_EARN_KEYS.has(baseKey),
    };
  }

  // Last event was a paid grant — cycle closed until section is undone.
  return {
    baseKey,
    cycleIndex: paidCount,
    canGrant: false,
    paidCount,
    reopenable: REOPENABLE_EARN_KEYS.has(baseKey),
  };
}

/** Write amount-0 open marker so the next completion can grant a (smaller) repeat reward. */
async function markEarnReopened(candidateId, earnKey) {
  const baseKey = getBaseEarnKey(earnKey);
  if (!REOPENABLE_EARN_KEYS.has(baseKey)) return false;

  const state = await getEarnCycleState(candidateId, baseKey);
  if (state.paidCount < 1) return false;
  if (state.canGrant) return false; // already open

  const bal = await getBalance(candidateId);
  const marker = openMarkerService(baseKey);
  try {
    await prisma.tokenTransaction.create({
      data: {
        candidateId,
        type: 'GRANT',
        amount: 0,
        balanceAfter: bal.tokenBalance ?? 0,
        service: marker,
        description: `Earn task reopened after undo: ${baseKey}`,
      },
    });
    return true;
  } catch (err) {
    console.warn('[tokens] markEarnReopened failed:', err?.message || err);
    return false;
  }
}

async function reopenProfileEarnsIfNeeded(candidateId, incompleteSectionKeys = []) {
  const reopened = [];
  for (const key of incompleteSectionKeys) {
    const earnKey = PROFILE_SECTION_EARN_MAP[key];
    if (!earnKey) continue;
    try {
      const ok = await markEarnReopened(candidateId, earnKey);
      if (ok) reopened.push(earnKey);
    } catch (err) {
      console.warn('[tokens] reopen skipped:', earnKey, err?.message || err);
    }
  }
  return reopened;
}

/**
 * Ordered earn lifecycle with done | pending from live profile state.
 * Pending again after undo; `tokens` = next credit (smaller on repeats).
 */
async function getEarnLifecycle(candidateId) {
  let sections = [];
  try {
    const { getMissingProfileSections } = require('../utils/profile-completeness.util');
    const completeness = await getMissingProfileSections(candidateId, { persist: false });
    sections = completeness?.sections || [];
  } catch (err) {
    console.warn('[tokens] getEarnLifecycle completeness skipped:', err?.message || err);
  }

  const completedSectionKeys = new Set(
    sections.filter((s) => s.isComplete).map((s) => s.key)
  );
  const incompleteKeys = sections.filter((s) => !s.isComplete).map((s) => s.key).filter(Boolean);
  await reopenProfileEarnsIfNeeded(candidateId, incompleteKeys);

  const claimed = new Set(await listClaimedEarnKeys(candidateId));
  const tasks = [...EARN_TASK_CATALOG].sort((a, b) => (a.order || 0) - (b.order || 0));
  const sectionKeyByEarn = Object.fromEntries(
    Object.entries(PROFILE_SECTION_EARN_MAP).map(([section, earn]) => [earn, section])
  );

  const result = [];
  for (const task of tasks) {
    if (task.id === 'welcome' || task.id === 'earn.cv_upload') {
      const done = claimed.has(task.id);
      result.push({
        ...task,
        status: done ? 'done' : 'pending',
        done,
        cycle: done ? 1 : 0,
        nextTokens: done ? 0 : task.tokens,
      });
      continue;
    }

    const sectionKey = sectionKeyByEarn[task.id];
    const sectionComplete = sectionKey ? completedSectionKeys.has(sectionKey) : false;
    const cycleState = await getEarnCycleState(candidateId, task.id);
    const pending = !(sectionComplete && !cycleState.canGrant);
    const nextCycle = cycleState.canGrant
      ? cycleState.cycleIndex
      : Math.max(2, cycleState.paidCount + 1);
    const nextTokens = getRepeatEarnAmount(task.id, pending ? nextCycle : 1) || task.tokens;

    result.push({
      ...task,
      tokens: pending ? nextTokens : task.tokens,
      baseTokens: task.tokens,
      status: pending ? 'pending' : 'done',
      done: !pending,
      cycle: cycleState.paidCount,
      nextTokens: pending ? nextTokens : 0,
      repeat: pending && nextCycle > 1,
    });
  }
  return result;
}

/**
 * Grant tokens. Idempotent per ledger `service` key.
 * Pass options.amount / options.ledgerService for repeat cycles.
 */
async function earnOnce(candidateId, earnKey, description, options = {}) {
  const baseKey = getBaseEarnKey(earnKey);
  const amount =
    options.amount != null ? Number(options.amount) : getEarnReward(earnKey);
  const ledgerService = options.ledgerService || earnKey;

  if (amount == null || amount <= 0) {
    const err = new Error(`Unknown earn task: ${earnKey}`);
    err.status = 400;
    throw err;
  }

  if (prisma.tokenTransaction?.findFirst) {
    const existing = await prisma.tokenTransaction.findFirst({
      where: { candidateId, type: 'GRANT', service: ledgerService },
      select: { id: true },
    });
    if (existing) {
      const bal = await getBalance(candidateId);
      return {
        granted: false,
        tokenBalance: bal.tokenBalance,
        amount: 0,
        earnKey: baseKey,
        ledgerService,
      };
    }
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { tokenBalance: true },
  });
  if (!candidate) {
    const err = new Error('Candidate not found');
    err.status = 404;
    throw err;
  }

  const newBalance = (candidate.tokenBalance ?? 0) + amount;
  await prisma.candidate.update({
    where: { id: candidateId },
    data: { tokenBalance: newBalance },
  });

  try {
    await prisma.tokenTransaction.create({
      data: {
        candidateId,
        type: 'GRANT',
        amount,
        balanceAfter: newBalance,
        service: ledgerService,
        description: description || `Earned ${amount} tokens: ${baseKey}`,
      },
    });
  } catch (err) {
    console.warn('[tokens] Failed to write EARN ledger:', err?.message || err);
  }

  try {
    const { createCandidateNotification } = require('./notification.service');
    const label = description || baseKey;
    void createCandidateNotification(candidateId, {
      type: 'system',
      title: `+${amount} tokens earned`,
      description: String(label).slice(0, 200),
      actionButton: 'View balance',
      actionPath: '/subscriptions',
      metadata: { kind: 'token_earn', channel: 'activity', earnKey: baseKey, amount, ledgerService },
    });
  } catch {
    /* non-fatal */
  }

  return {
    granted: true,
    tokenBalance: newBalance,
    amount,
    earnKey: baseKey,
    ledgerService,
    cycle: options.cycle,
  };
}

/** Grant profile-section earns (supports reopen + smaller repeat credits). */
async function grantProfileSectionEarns(candidateId, completedSectionKeys = []) {
  const granted = [];
  for (const key of completedSectionKeys) {
    const earnKey = PROFILE_SECTION_EARN_MAP[key];
    if (!earnKey) continue;
    try {
      const cycleState = await getEarnCycleState(candidateId, earnKey);
      if (!cycleState.canGrant) continue;

      const cycleIndex = cycleState.cycleIndex;
      const amount = getRepeatEarnAmount(earnKey, cycleIndex);
      if (amount == null || amount <= 0) continue;

      const ledgerService = ledgerServiceForCycle(earnKey, cycleIndex);
      const result = await earnOnce(
        candidateId,
        earnKey,
        cycleIndex > 1
          ? `Profile re-complete (cycle ${cycleIndex}): ${key}`
          : `Profile complete: ${key}`,
        { amount, ledgerService, cycle: cycleIndex }
      );
      if (result.granted) {
        granted.push({ ...result, cycle: cycleIndex });
      }
    } catch (err) {
      console.warn('[tokens] profile earn skipped:', earnKey, err?.message || err);
    }
  }
  return granted;
}

/** One-time unlocks: charge once, then free forever for that candidate. */
const ONE_TIME_UNLOCK_SERVICES = new Set([
  'lms.interview.unlock-request',
  'lms.interview.unlock-interviewer',
]);

async function hasUnlockedService(candidateId, serviceId) {
  if (!prisma.tokenTransaction?.findFirst) return false;
  const row = await prisma.tokenTransaction.findFirst({
    where: { candidateId, service: serviceId, type: 'SPEND' },
    select: { id: true },
  });
  return Boolean(row);
}

async function listUnlocks(candidateId) {
  const unlocks = {};
  for (const serviceId of ONE_TIME_UNLOCK_SERVICES) {
    unlocks[serviceId] = await hasUnlockedService(candidateId, serviceId);
  }
  return unlocks;
}

/** Earn keys already granted (ledger GRANT.service). */
async function listClaimedEarnKeys(candidateId) {
  const claimed = new Set();
  if (!candidateId || !prisma.tokenTransaction?.findMany) return [];
  try {
    const rows = await prisma.tokenTransaction.findMany({
      where: { candidateId, type: 'GRANT' },
      select: { service: true },
    });
    for (const row of rows) {
      if (row.service) claimed.add(row.service);
    }
  } catch (err) {
    console.warn('[tokens] listClaimedEarnKeys failed:', err?.message || err);
  }
  return Array.from(claimed);
}

/**
 * Spend catalog tokens. For one-time unlock services, skip charge if already unlocked.
 */
async function spendCatalogService(candidateId, serviceId) {
  if (ONE_TIME_UNLOCK_SERVICES.has(serviceId)) {
    const already = await hasUnlockedService(candidateId, serviceId);
    if (already) {
      const bal = await getBalance(candidateId);
      return {
        alreadyUnlocked: true,
        tokenBalance: bal.tokenBalance,
        spent: 0,
        service: serviceId,
      };
    }
  }

  const result = await spendTokens(candidateId, serviceId);
  return { ...result, alreadyUnlocked: false };
}

module.exports = {
  resolveCandidateId,
  getBalance,
  grantWelcomeTokensIfNeeded,
  spendTokens,
  purchasePack,
  listRecentTransactions,
  getCatalog,
  WELCOME_TOKEN_AMOUNT,
  spendTokensAmount,
  grantTokensAmount,
  spendCatalogService,
  listUnlocks,
  listClaimedEarnKeys,
  hasUnlockedService,
  ONE_TIME_UNLOCK_SERVICES,
  earnOnce,
  grantProfileSectionEarns,
  syncLifecycleEarns,
  getEarnLifecycle,
  reopenProfileEarnsIfNeeded,
  getEarnCycleState,
};
