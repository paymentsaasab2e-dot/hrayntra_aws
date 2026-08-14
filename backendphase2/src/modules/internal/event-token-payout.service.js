import { runWithTenantContext } from '../../config/prisma.js';
import { headquartersAuthService } from '../auth/headquarters-auth.service.js';
import { addTenantCoins } from '../setting/tenantCoinWallet.service.js';

/**
 * Credit Phase 2 / HQ creator when a Phase 1 candidate spends tokens to join an event.
 * 1 candidate token → 1 AI coin.
 */
export async function creditEventCreator({
  amount,
  source,
  tenantDbName,
  createdByEmail,
  eventId,
}) {
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  if (add <= 0) {
    return { credited: 0, sink: 'none' };
  }

  const src = String(source || '').toLowerCase();
  const tenant = String(tenantDbName || '').trim();
  const email = String(createdByEmail || '').trim();

  if (src === 'tenant' && tenant) {
    const result = await runWithTenantContext(tenant, async () =>
      addTenantCoins(add, {
        user: { tenantDbName: tenant, email },
        reason: `event_payout:${eventId || ''}`,
      }),
    );
    return {
      credited: add,
      sink: 'tenant',
      coins: result?.coins ?? null,
      tenantDbName: tenant,
    };
  }

  if (email) {
    const updated = await headquartersAuthService.incrementCoinsForEmail(email, add);
    if (!updated) {
      return { credited: 0, sink: 'hq', pending: true, error: 'hq_user_not_found', email };
    }
    return {
      credited: add,
      sink: 'hq',
      coins: updated?.subscriptionPlan?.coins ?? updated?.coins ?? null,
      email,
    };
  }

  return { credited: 0, sink: 'none' };
}

export async function postEventTokenPayout(req, res) {
  try {
    const body = req.body || {};
    const result = await creditEventCreator({
      amount: body.amount ?? body.tokenCost,
      source: body.source,
      tenantDbName: body.tenantDbName,
      createdByEmail: body.createdByEmail,
      eventId: body.eventId,
    });
    return res.json({
      success: true,
      message: 'Event payout applied',
      data: result,
    });
  } catch (error) {
    console.error('[event-token-payout]', error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Event payout failed',
    });
  }
}
