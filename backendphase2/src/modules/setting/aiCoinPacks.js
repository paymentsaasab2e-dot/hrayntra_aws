/**
 * Demo AI coin packs for Phase 2 employer tenants.
 * Purchase is simulated (no real payment gateway) — credits coins immediately.
 */
export const PHASE2_AI_COIN_PACKS = [
  {
    id: 'ai_pack_starter',
    name: 'Starter',
    coins: 100,
    priceUsd: 9,
    priceLabel: '$9',
    description: 'Enough for light AI job and lead assist.',
    popular: false,
  },
  {
    id: 'ai_pack_growth',
    name: 'Growth',
    coins: 500,
    priceUsd: 39,
    priceLabel: '$39',
    description: 'Best for daily AI hiring workflows.',
    popular: true,
  },
  {
    id: 'ai_pack_scale',
    name: 'Scale',
    coins: 2000,
    priceUsd: 99,
    priceLabel: '$99',
    description: 'High-volume AI usage across the team.',
    popular: false,
  },
];

export function getCoinPack(packId) {
  const id = String(packId || '').trim();
  return PHASE2_AI_COIN_PACKS.find((p) => p.id === id) || null;
}

export function listCoinPacks() {
  return PHASE2_AI_COIN_PACKS.map((p) => ({ ...p }));
}
