/**
 * Persist Location column display mode (Country / State / City / Full address).
 * No React — safe for list mappers and exports.
 */

import {
  DEFAULT_TABLE_LOCATION_DISPLAY_MODE,
  isTableLocationDisplayMode,
  type TableLocationDisplayMode,
} from './formatTableLocation';

const STORAGE_SUFFIX = 'table.locationDisplayMode';
export const TABLE_LOCATION_DISPLAY_EVENT = 'ph2:table-location-display-mode';

function readTenantScope(): string {
  if (typeof window === 'undefined') return 'none';
  try {
    return String(localStorage.getItem('tenantDbName') || 'none').trim() || 'none';
  } catch {
    return 'none';
  }
}

function storageKey(tenantScope?: string): string {
  const scope = tenantScope ?? readTenantScope();
  return `tenantColumns:${scope}:${STORAGE_SUFFIX}`;
}

export function readTableLocationDisplayMode(tenantScope?: string): TableLocationDisplayMode {
  if (typeof window === 'undefined') return DEFAULT_TABLE_LOCATION_DISPLAY_MODE;
  try {
    const raw = localStorage.getItem(storageKey(tenantScope));
    if (isTableLocationDisplayMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_TABLE_LOCATION_DISPLAY_MODE;
}

export function writeTableLocationDisplayMode(
  mode: TableLocationDisplayMode,
  tenantScope?: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(tenantScope), mode);
    window.dispatchEvent(
      new CustomEvent(TABLE_LOCATION_DISPLAY_EVENT, { detail: { mode } }),
    );
  } catch {
    /* ignore */
  }
}

export function isTableLocationDisplayStorageKey(key: string | null): boolean {
  return Boolean(key && key.endsWith(STORAGE_SUFFIX));
}
