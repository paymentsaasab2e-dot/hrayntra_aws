'use client';

import { toast } from 'sonner';
import {
  apiCreateNotification,
  type AppNotificationCategory,
} from './api';

type ExtraOptions = {
  /** Persist this toast as a bell notification. Defaults to true. */
  persist?: boolean;
  category?: AppNotificationCategory;
  description?: string;
  actionLabel?: string;
  actionPath?: string;
  metadata?: Record<string, unknown>;
};

function persistToBell(
  title: string,
  category: AppNotificationCategory,
  options?: ExtraOptions
) {
  if (options?.persist === false) return;
  void apiCreateNotification({
    category,
    title,
    description: options?.description,
    actionLabel: options?.actionLabel ?? null,
    actionPath: options?.actionPath ?? null,
    metadata: options?.metadata,
  }).catch(() => {
    /* bell side-channel is non-critical */
  });
}

/**
 * Drop-in replacement for direct `sonner.toast.*` calls. Behaves identically
 * for the toast and additionally records a CRM bell notification so the user
 * can review the action later from the bell drawer.
 *
 * Use `{ persist: false }` to skip the bell write (e.g. validation feedback).
 */
export const notify = {
  success(title: string, options?: ExtraOptions) {
    toast.success(title, options?.description ? { description: options.description } : undefined);
    persistToBell(title, options?.category ?? 'SYSTEM', options);
  },
  error(title: string, options?: ExtraOptions) {
    toast.error(title, options?.description ? { description: options.description } : undefined);
    persistToBell(title, options?.category ?? 'SYSTEM', options);
  },
  info(title: string, options?: ExtraOptions) {
    toast.info?.(title, options?.description ? { description: options.description } : undefined) ??
      toast(title, options?.description ? { description: options.description } : undefined);
    persistToBell(title, options?.category ?? 'SYSTEM', options);
  },
  warning(title: string, options?: ExtraOptions) {
    toast.warning?.(title, options?.description ? { description: options.description } : undefined) ??
      toast(title, options?.description ? { description: options.description } : undefined);
    persistToBell(title, options?.category ?? 'SYSTEM', options);
  },
};
