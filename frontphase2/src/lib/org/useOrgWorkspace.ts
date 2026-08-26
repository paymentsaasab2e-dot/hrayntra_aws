'use client';

import { useEffect, useState } from 'react';
import { apiDashboardAccess } from '@/lib/dashboard/api';
import type { OrgCompanyOption } from '@/lib/dashboard/api';
import {
  getActiveOrgUnitId,
  getActiveOrgUnitName,
  ORG_WORKSPACE_EVENT,
  setActiveOrgUnit,
} from './orgWorkspaceStorage';

export function useOrgWorkspace() {
  const [orgUnitId, setOrgUnitId] = useState('');
  const [orgUnitName, setOrgUnitName] = useState('');
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [canSwitchCompanies, setCanSwitchCompanies] = useState(false);
  const [purpose, setPurpose] = useState('member');

  useEffect(() => {
    const sync = () => {
      setOrgUnitId(getActiveOrgUnitId());
      setOrgUnitName(getActiveOrgUnitName());
    };
    sync();
    window.addEventListener(ORG_WORKSPACE_EVENT, sync);
    return () => window.removeEventListener(ORG_WORKSPACE_EVENT, sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void apiDashboardAccess()
      .then((data) => {
        if (cancelled) return;
        const org = data?.org;
        setCanSwitchCompanies(Boolean(org?.canSwitchCompanies));
        setCompanies(org?.companies || []);
        setPurpose(String(org?.hierarchyPurpose || 'member'));
        const saved = getActiveOrgUnitId();
        if (saved) {
          const match = (org?.companies || []).find((c) => c.id === saved);
          if (match?.name) setOrgUnitName(match.name);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    orgUnitId,
    orgUnitName,
    companies,
    canSwitchCompanies,
    purpose,
    setActiveOrgUnit,
  };
}
