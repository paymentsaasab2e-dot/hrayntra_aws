const tokenService = require('../services/token.service');

async function getBalance(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const data = await tokenService.getBalance(candidateId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to get token balance',
    });
  }
}

async function getCatalog(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    let balance = null;
    let claimedEarnKeys = [];
    let earnLifecycle = [];
    let lifecycleGranted = [];
    if (candidateId) {
      try {
        const sync = await tokenService.syncLifecycleEarns(candidateId);
        lifecycleGranted = sync?.granted || [];
        balance = await tokenService.getBalance(candidateId);
        claimedEarnKeys = await tokenService.listClaimedEarnKeys(candidateId);
        earnLifecycle = await tokenService.getEarnLifecycle(candidateId);
      } catch {
        balance = null;
      }
    }
    const catalog = await tokenService.getCatalog();
    return res.json({
      success: true,
      data: {
        ...catalog,
        tokenBalance: balance?.tokenBalance ?? 0,
        freeTokensGrantedAt: balance?.freeTokensGrantedAt ?? null,
        claimedEarnKeys,
        earnLifecycle,
        lifecycleGranted,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load catalog',
    });
  }
}

async function purchase(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { packageId, paymentReference } = req.body || {};
    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: 'packageId is required',
      });
    }

    const result = await tokenService.purchasePack(
      candidateId,
      packageId,
      paymentReference
    );

    return res.json({
      success: true,
      message: `Added ${result.credited} tokens`,
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Purchase failed',
    });
  }
}

async function getTransactions(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const limit = Number(req.query.limit) || 20;
    const rows = await tokenService.listRecentTransactions(candidateId, limit);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load transactions',
    });
  }
}

/** Explicit grant endpoint (also runs automatically on dashboard open). */
async function claimWelcome(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const result = await tokenService.grantWelcomeTokensIfNeeded(candidateId);
    return res.json({
      success: true,
      data: result,
      message: result.granted
        ? `You received ${result.amount} free tokens!`
        : 'Welcome tokens already claimed',
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to claim welcome tokens',
    });
  }
}

async function spend(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const { serviceId } = req.body || {};
    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'serviceId is required' });
    }
    const result = await tokenService.spendCatalogService(candidateId, serviceId);
    if (result.tokenBalance != null) {
      res.setHeader('X-Token-Balance', String(result.tokenBalance));
      res.setHeader('X-Tokens-Spent', String(result.spent || 0));
    }
    return res.json({
      success: true,
      data: result,
      message: result.alreadyUnlocked
        ? 'Already unlocked'
        : `Spent ${result.spent} tokens`,
    });
  } catch (error) {
    if (error.code === 'INSUFFICIENT_TOKENS' || error.status === 402) {
      return res.status(402).json({
        success: false,
        message: error.message || 'Insufficient tokens',
        code: 'INSUFFICIENT_TOKENS',
        balance: error.balance ?? 0,
        required: error.required,
        service: error.service,
        shortfall: Math.max(0, (error.required || 0) - (error.balance || 0)),
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Spend failed',
    });
  }
}

/** Spend an explicit amount (e.g. reference-check escrow to HR Yantra). */
async function spendAmount(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const { amount, service, description } = req.body || {};
    const cost = Number(amount);
    if (!Number.isFinite(cost) || cost <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    const serviceId = String(service || 'office.reference-check');
    if (!serviceId.startsWith('office.reference-check')) {
      return res.status(400).json({
        success: false,
        message: 'service must be an office.reference-check* key',
      });
    }
    const result = await tokenService.spendTokensAmount(
      candidateId,
      cost,
      serviceId,
      description || `Spent ${cost} tokens on ${serviceId}`,
    );
    if (result.tokenBalance != null) {
      res.setHeader('X-Token-Balance', String(result.tokenBalance));
      res.setHeader('X-Tokens-Spent', String(result.spent || 0));
    }
    return res.json({
      success: true,
      data: result,
      message: `Spent ${result.spent} tokens (held by HR Yantra)`,
    });
  } catch (error) {
    if (error.code === 'INSUFFICIENT_TOKENS' || error.status === 402) {
      return res.status(402).json({
        success: false,
        message: error.message || 'Insufficient tokens',
        code: 'INSUFFICIENT_TOKENS',
        balance: error.balance ?? 0,
        required: error.required,
        service: error.service,
        shortfall: Math.max(0, (error.required || 0) - (error.balance || 0)),
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Spend failed',
    });
  }
}

/**
 * Grant tokens for reference-check refund (to requester) or payout (to referee).
 * Caller may credit another candidate when service is office.reference-check.*.
 */
async function grantAmount(req, res) {
  try {
    const actorId = tokenService.resolveCandidateId(req.user);
    if (!actorId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const { amount, service, description, candidateId: targetRaw } = req.body || {};
    const credit = Number(amount);
    if (!Number.isFinite(credit) || credit <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    const serviceId = String(service || '');
    if (!serviceId.startsWith('office.reference-check.')) {
      return res.status(400).json({
        success: false,
        message: 'service must be an office.reference-check.* key',
      });
    }
    const targetId = targetRaw ? String(targetRaw) : actorId;
    const result = await tokenService.grantTokensAmount(
      targetId,
      credit,
      serviceId,
      description || `Granted ${credit} tokens`,
    );
    if (result.tokenBalance != null && targetId === actorId) {
      res.setHeader('X-Token-Balance', String(result.tokenBalance));
    }
    return res.json({
      success: true,
      data: { ...result, targetCandidateId: targetId },
      message: `Granted ${result.granted} tokens`,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Grant failed',
    });
  }
}

async function getUnlocks(req, res) {
  try {
    const candidateId = tokenService.resolveCandidateId(req.user);
    if (!candidateId) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const unlocks = await tokenService.listUnlocks(candidateId);
    return res.json({ success: true, data: { unlocks } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load unlocks',
    });
  }
}

module.exports = {
  getBalance,
  getCatalog,
  purchase,
  getTransactions,
  claimWelcome,
  spend,
  spendAmount,
  grantAmount,
  getUnlocks,
};
