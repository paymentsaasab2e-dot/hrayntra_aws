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
let inflightTenant = '';

export async function fetchAndCacheOrgWatermark(): Promise<ExportWatermarkSettings> {
  const tenant =
    typeof window !== 'undefined' ? String(window.localStorage.getItem('tenantDbName') || '').trim() : '';
  if (inflight && inflightTenant === tenant) return inflight;
  inflightTenant = tenant;
  inflight = (async () => {
    try {
      const res = await apiGetOrgWatermark();
      const still =
        typeof window !== 'undefined'
          ? String(window.localStorage.getItem('tenantDbName') || '').trim()
          : '';
      if (still !== tenant) return readCachedOrgWatermark();
      const next = normalizeExportWatermark(res.data?.watermark);
      writeCachedOrgWatermark(next);
      if (next.enabled) {
        void import('./exportWatermark')
          .then((m) => {
            if (next.imageDataUrl?.startsWith('data:image/') && next.imageUrl) {
              m.cacheWatermarkLogoDataUrl(next.imageUrl, next.imageDataUrl);
            }
            return m.preloadOrgWatermarkLogo(next);
          })
          .catch(() => undefined);
      }
      return next;
    } catch {
      return readCachedOrgWatermark();
    } finally {
      if (inflightTenant === tenant) inflight = null;
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
    const load = () => {
      setSettings(readCachedOrgWatermark());
      void fetchAndCacheOrgWatermark().then(setSettings);
    };
    load();
    const onCache = () => setSettings(readCachedOrgWatermark());
    window.addEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
    window.addEventListener('hryantra:tenant-changed', load);
    return () => {
      window.removeEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
      window.removeEventListener('hryantra:tenant-changed', load);
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchAndCacheOrgWatermark();
    setSettings(next);
    return next;
  }, []);

  return { settings, refresh };
}
