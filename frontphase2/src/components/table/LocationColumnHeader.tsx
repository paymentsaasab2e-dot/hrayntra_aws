'use client';

import {
  formatTableLocation,
  type TableLocationInput,
} from '../../lib/formatTableLocation';
import { useTableLocationDisplayMode } from '../../lib/useTableLocationDisplayMode';

/**
 * Formats a location cell with the shared Phase 2 display mode
 * (set from Columns → Location column: Country / State / City / Full address).
 */
export function useFormatTableLocationCell() {
  const { mode } = useTableLocationDisplayMode();
  return {
    mode,
    format: (input?: TableLocationInput | string | null, empty = '—') =>
      formatTableLocation(input, mode, empty),
  };
}
