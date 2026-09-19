'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGetOrgWatermark } from './api';
import {
  DEFAULT_EXPORT_WATERMARK,
  ORG_WATERMARK_CACHE_EVENT,
  normalizeExportWatermark,
  readCachedOrgWatermark,
  writeCachedOrgWatermark,
  type ExportWatermarkSettings,
} from './exportWatermark';

let inflight: Promise<ExportWatermarkSettings> | null = null;

export async function fetchAndCacheOrgWatermark(): Promise<ExportWatermarkSettings> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await apiGetOrgWatermark();
      const next = normalizeExportWatermark(res.data?.watermark);
      writeCachedOrgWatermark(next);
      if (next.enabled && next.imageUrl) {
        void import('./exportWatermark')
          .then((m) => m.preloadOrgWatermarkLogo(next))
          .catch(() => undefined);
      }
      return next;
    } catch {
      return readCachedOrgWatermark();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Shared org watermark for exports — Super Admin configures once for the team. */
export function useOrgExportWatermark() {
  const [settings, setSettings] = useState<ExportWatermarkSettings>(() =>
    typeof window !== 'undefined' ? readCachedOrgWatermark() : DEFAULT_EXPORT_WATERMARK,
  );

  useEffect(() => {
    setSettings(readCachedOrgWatermark());
    void fetchAndCacheOrgWatermark().then(setSettings);
    const onCache = () => setSettings(readCachedOrgWatermark());
    window.addEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
    return () => window.removeEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchAndCacheOrgWatermark();
    setSettings(next);
    return next;
  }, []);

  return { settings, refresh };
}
