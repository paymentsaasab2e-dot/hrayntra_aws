'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_TABLE_LOCATION_DISPLAY_MODE,
  type TableLocationDisplayMode,
} from './formatTableLocation';
import {
  isTableLocationDisplayStorageKey,
  readTableLocationDisplayMode,
  TABLE_LOCATION_DISPLAY_EVENT,
  writeTableLocationDisplayMode,
} from './tableLocationDisplayStorage';

export {
  readTableLocationDisplayMode,
  writeTableLocationDisplayMode,
  TABLE_LOCATION_DISPLAY_EVENT,
} from './tableLocationDisplayStorage';

/** Shared across all Phase 2 list tables (tenant-scoped). */
export function useTableLocationDisplayMode() {
  const [mode, setModeState] = useState<TableLocationDisplayMode>(
    DEFAULT_TABLE_LOCATION_DISPLAY_MODE,
  );

  useEffect(() => {
    setModeState(readTableLocationDisplayMode());
    const onStorage = (event: StorageEvent) => {
      if (!isTableLocationDisplayStorageKey(event.key)) return;
      setModeState(readTableLocationDisplayMode());
    };
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: TableLocationDisplayMode }>).detail;
      if (
        detail?.mode === 'country' ||
        detail?.mode === 'state' ||
        detail?.mode === 'city' ||
        detail?.mode === 'all'
      ) {
        setModeState(detail.mode);
        return;
      }
      setModeState(readTableLocationDisplayMode());
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(TABLE_LOCATION_DISPLAY_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(TABLE_LOCATION_DISPLAY_EVENT, onCustom as EventListener);
    };
  }, []);

  const setMode = useCallback((next: TableLocationDisplayMode) => {
    writeTableLocationDisplayMode(next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
