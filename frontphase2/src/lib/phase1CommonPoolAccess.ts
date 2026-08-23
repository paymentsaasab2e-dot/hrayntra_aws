import { getCachedPhase1CommonPoolEnabled } from './api';

/** Whether this tenant may see Hrayntra Phase 1 (candidatecommon) in Phase 2 lists. */
export function shouldIncludePhase1CommonPool(): boolean {
  return getCachedPhase1CommonPoolEnabled();
}
