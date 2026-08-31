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

export function getStoredTenantCompanyName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('currentUser');
    if (!raw) return '';
    const user = JSON.parse(raw) as { organizationName?: string; companyName?: string };
    return String(user?.organizationName || user?.companyName || '').trim();
  } catch {
    return '';
  }
}

/** Own-company label in Add Job: org unit when companies exist and the viewer is under one; otherwise tenant company name. */
export function resolveAddJobWorkspaceLabel(opts: {
  hasCompanies: boolean;
  orgUnitName: string;
  orgUnitId?: string;
  homeIsOrgCompany: boolean;
  companyName: string;
}): { displayName: string; useOrganizationLabel: boolean } {
  const orgName = String(opts.orgUnitName || '').trim();
  const viewingOrgUnit =
    opts.hasCompanies &&
    Boolean(orgName) &&
    (opts.homeIsOrgCompany || Boolean(String(opts.orgUnitId || '').trim()));
  if (viewingOrgUnit) {
    return { displayName: orgName, useOrganizationLabel: true };
  }
  return {
    displayName: String(opts.companyName || '').trim() || 'Your organization',
    useOrganizationLabel: false,
  };
}

export function useOrgWorkspace() {
  const { isSuperAdmin, hasPermission } = usePermissions();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [orgUnitName, setOrgUnitName] = useState('');
  const [companies, setCompanies] = useState<OrgCompanyOption[]>([]);
  const [canSwitchCompanies, setCanSwitchCompanies] = useState(false);
  const [purpose, setPurpose] = useState('member');
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [hasCompanies, setHasCompanies] = useState(false);
  const [homeIsOrgCompany, setHomeIsOrgCompany] = useState(false);

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
        setHasCompanies(Boolean(org?.hasCompanies) || (org?.companies || []).length > 0);
        setHomeIsOrgCompany(Boolean(org?.homeIsOrgCompany));
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
          setHasCompanies(false);
          setHomeIsOrgCompany(false);
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
    hasCompanies,
    homeIsOrgCompany,
    purpose,
    setActiveOrgUnit,
  };
}
