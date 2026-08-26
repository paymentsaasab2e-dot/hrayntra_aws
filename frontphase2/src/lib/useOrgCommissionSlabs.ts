import { useEffect, useState } from 'react';
import { apiGetOrgCommissionSlabs } from './api';
import {
  DEFAULT_COMMISSION_SLAB_SETTINGS,
  type CommissionSlabSettings,
} from './commissionSlabs';

export function useOrgCommissionSlabs() {
  const [settings, setSettings] = useState<CommissionSlabSettings>(DEFAULT_COMMISSION_SLAB_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiGetOrgCommissionSlabs()
      .then((res) => {
        if (!cancelled && res.data?.commissionSlabs) {
          setSettings(res.data.commissionSlabs);
        }
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loaded };
}
