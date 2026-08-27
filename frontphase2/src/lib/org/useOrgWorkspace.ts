'use client';

import { useEffect, useState } from 'react';
import { apiDashboardAccess } from '@/lib/dashboard/api';
import type { OrgCompanyOption } from '@/lib/dashboard/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  clearActiveOrgUnit,
  getActiveOrgUnitId,
  getActiveOrgUnitName,
  ORG_WORKSPACE_EVENT,
  setActiveOrgUnit,
} from './orgWorkspaceStorage';

export function useOrgWorkspace() {
  const { isSuperAdmin, hasPermission } = usePermissions();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [orgUnitName, setOrgUnitName] = useState('');
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [canSwitchCompanies, setCanSwitchCompanies] = useState(false);
  const [purpose, setPurpose] = useState('member');
  const [accessLoaded, setAccessLoaded] = useState(false);

  const localMaySwitch =
    isSuperAdmin() || hasPermission('switch_companies') || hasPermission('all');

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
        const serverAllows = Boolean(org?.canSwitchCompanies);
        const allowed = Boolean(serverAllows && localMaySwitch);
        setCanSwitchCompanies(allowed);
        setCompanies(allowed ? org?.companies || [] : []);
        setPurpose(String(org?.hierarchyPurpose || 'member'));
        setAccessLoaded(true);

        if (!allowed) {
          if (getActiveOrgUnitId()) clearActiveOrgUnit({ reload: false });
          setOrgUnitId('');
          const homeLabel =
            String(org?.homeOrgUnitName || '').trim() ||
            getActiveOrgUnitName();
          setOrgUnitName(homeLabel);
          return;
        }

        const saved = getActiveOrgUnitId();
        if (saved) {
          const match = (org?.companies || []).find((c) => c.id === saved);
          if (match?.name) {
            setOrgUnitName(match.name);
          } else {
            // Stale company id (deleted Comp B, etc.) — drop it so Structure/lists stay consistent.
            clearActiveOrgUnit({ reload: false });
            setOrgUnitId('');
            setOrgUnitName('');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanSwitchCompanies(false);
          setCompanies([]);
          setAccessLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [localMaySwitch]);

  return {
    orgUnitId,
    orgUnitName,
    companies,
    canSwitchCompanies: accessLoaded ? canSwitchCompanies : false,
    purpose,
    setActiveOrgUnit,
  };
}
