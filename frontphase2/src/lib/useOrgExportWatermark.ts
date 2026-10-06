'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGetOrgWatermark } from './api';
import {
  DEFAULT_EXPORT_WATERMARK,
  ORG_WATERMARK_CACHE_EVENT,
  clearOrgExportWatermarkCache,
  normalizeExportWatermark,
  readCachedOrgWatermark,
  writeCachedOrgWatermark,
  type ExportWatermarkSettings,
} from './exportWatermark';

const inflightByTenant = new Map<string, Promise<ExportWatermarkSettings>>();

function currentTenantScope(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    return String(window.localStorage.getItem('tenantDbName') || '').trim() || 'anon';
  } catch {
    return 'anon';
  }
}

export async function fetchAndCacheOrgWatermark(): Promise<ExportWatermarkSettings> {
  const tenantScope = currentTenantScope();
  const existing = inflightByTenant.get(tenantScope);
  if (existing) return existing;

  const request = (async () => {
    try {
      const res = await apiGetOrgWatermark();
      // Tenant may have switched while the request was in flight — never cache into the wrong workspace.
      if (currentTenantScope() !== tenantScope) {
        return readCachedOrgWatermark();
      }
      const next = normalizeExportWatermark(res.data?.watermark);
      writeCachedOrgWatermark(next);
      if (next.enabled) {
        void import('./exportWatermark')
          .then((m) => {
            if (currentTenantScope() !== tenantScope) return undefined;
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
      inflightByTenant.delete(tenantScope);
    }
  })();

  inflightByTenant.set(tenantScope, request);
  return request;
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
    const onTenantChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ previous?: string | null; next?: string | null }>)
        .detail;
      const previous = String(detail?.previous || '').trim();
      if (previous) clearOrgExportWatermarkCache({ tenantDbName: previous });
      // Drop any in-flight fetch from the prior tenant.
      inflightByTenant.clear();
      setSettings(DEFAULT_EXPORT_WATERMARK);
      void fetchAndCacheOrgWatermark().then(setSettings);
    };

    window.addEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
    window.addEventListener('hryantra:tenant-changed', onTenantChanged);
    return () => {
      window.removeEventListener(ORG_WATERMARK_CACHE_EVENT, onCache);
      window.removeEventListener('hryantra:tenant-changed', onTenantChanged);
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchAndCacheOrgWatermark();
    setSettings(next);
    return next;
  }, []);

  return { settings, refresh };
}
