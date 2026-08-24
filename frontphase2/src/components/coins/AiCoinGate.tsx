'use client';

import React, { useCallback } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { notifyTenantCoinsChanged } from '@/lib/api';
import { useTenantCoins } from './TenantCoinsContext';
import { openAiCoinPurchaseModal } from './AiCoinPurchaseModal';
import { TokenCoinIcon } from './TokenCoinIcon';

export type AiCoinGateResult = {
  cost: number;
  coins: number;
  locked: boolean;
  refresh: () => Promise<void>;
  /** Returns false if action should not run (insufficient coins or user cancelled). */
  confirmAndUnlock: () => boolean;
  /** Async wrapper: runs fn only after unlock confirm when affordable. */
  runWithUnlock: <T>(fn: () => T | Promise<T>) => Promise<T | undefined>;
  openPurchase: () => void;
};

/**
 * Gate for Phase 2 AI actions. Shows lock when balance < HQ cost;
 * on click, asks to spend coins then runs the action (backend deducts).
 * When coins are spent, opens the demo purchase modal.
 */
export function useAiCoinGate(featureId: string): AiCoinGateResult {
  // HQ users should be able to use AI/features without paying tenant coins.
  // We treat any `/hq/*` route as HQ context for UI gating purposes.
  const pathname = usePathname();
  if (String(pathname || '').startsWith('/hq')) {
    return {
      cost: 0,
      coins: 0,
      locked: false,
      refresh: async () => undefined,
      confirmAndUnlock: () => true,
      runWithUnlock: async <T,>(fn: () => T | Promise<T>) => fn(),
      openPurchase: () => {},
    };
  }

  const { coins, getFeatureCost, isFeatureLocked, refresh, openPurchase } = useTenantCoins();
  const cost = getFeatureCost(featureId);
  const locked = isFeatureLocked(featureId);

  const openPurchaseForFeature = useCallback(() => {
    openPurchase({
      featureId,
      required: cost,
      balance: coins,
    });
  }, [openPurchase, featureId, cost, coins]);

  const confirmAndUnlock = useCallback(() => {
    if (cost <= 0) return true;
    if (locked || coins < cost) {
      openAiCoinPurchaseModal({
        featureId,
        required: cost,
        balance: coins,
      });
      void refresh();
      return false;
    }
    const ok = window.confirm(
      `Unlock this AI feature for ${cost} coin${cost === 1 ? '' : 's'}?\n\nYour balance: ${coins} → ${coins - cost} after use.`
    );
    if (ok && cost > 0) {
      // Instant sidenav update — reconciled by API response / refresh after the call.
      notifyTenantCoinsChanged({ spent: cost });
    }
    return ok;
  }, [cost, locked, coins, featureId, refresh]);

  const runWithUnlock = useCallback(
    async <T,>(fn: () => T | Promise<T>): Promise<T | undefined> => {
      if (!confirmAndUnlock()) return undefined;
      try {
        return await fn();
      } finally {
        void refresh();
      }
    },
    [confirmAndUnlock, refresh]
  );

  return {
    cost,
    coins,
    locked,
    refresh,
    confirmAndUnlock,
    runWithUnlock,
    openPurchase: openPurchaseForFeature,
  };
}

type AiCoinGateButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  featureId: string;
  /** Called after unlock confirm (and only if affordable). */
  onUnlockClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  /** Hide cost badge */
  hideCost?: boolean;
  /** Visual variant */
  variant?: 'solid' | 'outline' | 'icon';
};

/**
 * Button that shows Lock + coin cost. Click spends/unlocks then runs handler.
 * Every use requires unlock (pay-per-use). Locked → opens purchase modal.
 */
export function AiCoinGateButton({
  featureId,
  onUnlockClick,
  onClick,
  children,
  className = '',
  disabled,
  hideCost = false,
  variant = 'solid',
  title,
  ...rest
}: AiCoinGateButtonProps) {
  const { cost, coins, locked, confirmAndUnlock, refresh } = useAiCoinGate(featureId);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!confirmAndUnlock()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    try {
      if (onUnlockClick) await onUnlockClick(e);
      else if (onClick) await onClick(e);
    } finally {
      void refresh();
    }
  };

  const lockedStyles =
    variant === 'icon'
      ? locked
        ? 'bg-slate-300 text-slate-600'
        : ''
      : locked
        ? 'opacity-90 ring-2 ring-amber-300/80'
        : '';

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      title={
        title ||
        (locked
          ? `Locked — needs ${cost} coins (you have ${coins}). Click to purchase.`
          : cost > 0
            ? `Spend ${cost} coins to unlock`
            : undefined)
      }
      onClick={(e) => void handleClick(e)}
      className={`relative inline-flex items-center gap-1.5 ${lockedStyles} ${className}`}
    >
      {locked ? (
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : cost > 0 ? (
        <Unlock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      {children}
      {!hideCost && cost > 0 ? (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            locked ? 'bg-amber-100 text-amber-800' : 'bg-white/20 text-inherit'
          }`}
        >
          <TokenCoinIcon className="h-2.5 w-2.5" />
          {cost}
        </span>
      ) : null}
    </button>
  );
}

/** Small lock + cost chip for existing buttons (non-wrapping). */
export function AiCoinLockBadge({ featureId, className = '' }: { featureId: string; className?: string }) {
  const { cost, locked } = useAiCoinGate(featureId);
  if (cost <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        locked ? 'bg-amber-100 text-amber-800' : 'bg-teal-50 text-teal-800'
      } ${className}`}
    >
      {locked ? <Lock className="h-2.5 w-2.5" /> : <TokenCoinIcon className="h-2.5 w-2.5" />}
      {cost}
    </span>
  );
}
