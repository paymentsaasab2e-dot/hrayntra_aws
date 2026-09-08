'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { apiOrgWorkspace } from '@/lib/org/orgApi';
import type { OrgCompanyOption } from '@/lib/dashboard/api';
import { usePermissions } from '@/hooks/usePermissions';
import { orgSideFromPathname } from './orgSide';
import { dedupeByCompanyName } from '../companyNameKey';
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

export type JobPostingCompanyOption = { id: string; name: string };

/** Who is posting this job: locked company/org name, or Super Admin dropdown of all orgs. */
export function resolveJobPostingCompanyChooser(opts: {
  companies: OrgCompanyOption[];
  orgUnitId: string;
  orgUnitName: string;
  hasCompanies: boolean;
  homeIsOrgCompany: boolean;
  canSwitchCompanies: boolean;
  tenantCompanyName: string;
}): {
  options: JobPostingCompanyOption[];
  canChoose: boolean;
  defaultId: string;
  defaultName: string;
  fieldLabel: string;
} {
  const tenantName = String(opts.tenantCompanyName || '').trim();
  const orgOptions = (Array.isArray(opts.companies) ? opts.companies : [])
    .map((company) => ({
      id: String(company?.id || '').trim(),
      name: String(company?.name || '').trim(),
    }))
    .filter((company) => company.id && company.name);

  if (opts.canSwitchCompanies && orgOptions.length > 0) {
    const options = [...orgOptions];
    if (tenantName && !options.some((row) => row.name.toLowerCase() === tenantName.toLowerCase())) {
      options.unshift({ id: '', name: tenantName });
    }
    const active =
      options.find((row) => row.id && row.id === String(opts.orgUnitId || '').trim()) || options[0];
    return {
      options,
      canChoose: options.length > 1,
      defaultId: active?.id || '',
      defaultName: active?.name || tenantName,
      fieldLabel: opts.hasCompanies ? 'Organization name' : 'Company name',
    };
  }

  const label = resolveAddJobWorkspaceLabel({
    hasCompanies: opts.hasCompanies,
    orgUnitName: opts.orgUnitName,
    orgUnitId: opts.orgUnitId,
    homeIsOrgCompany: opts.homeIsOrgCompany,
    companyName: tenantName,
  });
  const id =
    opts.hasCompanies && (opts.homeIsOrgCompany || String(opts.orgUnitId || '').trim())
      ? String(opts.orgUnitId || '').trim()
      : '';
  return {
    options: [{ id, name: label.displayName }],
    canChoose: false,
    defaultId: id,
    defaultName: label.displayName,
    fieldLabel: label.useOrganizationLabel ? 'Organization name' : 'Company name',
  };
}

export function useOrgWorkspace() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';
  const side = orgSideFromPathname(pathname, search);
  const { isSuperAdmin, hasPermission } = usePermissions();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [orgUnitName, setOrgUnitName] = useState('');
  const [companiesCrm, setCompaniesCrm] = useState<OrgCompanyOption[]>([]);
  const [companiesRecruitment, setCompaniesRecruitment] = useState<OrgCompanyOption[]>([]);
  const [purpose, setPurpose] = useState('member');
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [hasCompanies, setHasCompanies] = useState(false);
  const [homeIsOrgCompany, setHomeIsOrgCompany] = useState(false);

  const [apiCanSwitch, setApiCanSwitch] = useState(false);

  const localMaySwitch =
    isSuperAdmin() || hasPermission('switch_companies') || hasPermission('all');

  const companies = useMemo(() => {
    if (side === 'crm') return Array.isArray(companiesCrm) ? companiesCrm : [];
    if (side === 'recruitment') return Array.isArray(companiesRecruitment) ? companiesRecruitment : [];
    const byId = new Map<string, OrgCompanyOption>();
    [...(Array.isArray(companiesCrm) ? companiesCrm : []), ...(Array.isArray(companiesRecruitment) ? companiesRecruitment : [])].forEach((company) => {
      if (company?.id) byId.set(company.id, company);
    });
    return [...byId.values()];
  }, [side, companiesCrm, companiesRecruitment]);

  const canSwitchCompanies = Boolean(
    accessLoaded && (localMaySwitch || apiCanSwitch) && companies.length > 0,
  );
  const effectiveOrgUnitId = companies.some((c) => c.id === orgUnitId) ? orgUnitId : '';
  // Members without Switch companies still need their home company label in the nav.
  const effectiveOrgUnitName = effectiveOrgUnitId
    ? companies.find((c) => c.id === orgUnitId)?.name || orgUnitName
    : orgUnitName;

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
    void apiOrgWorkspace()
      .then((org) => {
        if (cancelled) return;
        const crm = Array.isArray(org?.companiesCrm) ? org.companiesCrm : null;
        const recruitment = Array.isArray(org?.companiesRecruitment)
          ? org.companiesRecruitment
          : null;
        const fallback = Array.isArray(org?.companies) ? org.companies : [];
        setCompaniesCrm(dedupeByCompanyName(crm || fallback, (company) => company.name));
        setCompaniesRecruitment(dedupeByCompanyName(recruitment || fallback, (company) => company.name));
        setPurpose(String(org?.hierarchyPurpose || 'member'));
        setHasCompanies(
          Boolean(org?.hasCompanies) ||
            (crm || []).length > 0 ||
            (recruitment || []).length > 0 ||
            fallback.length > 0,
        );
        setHomeIsOrgCompany(Boolean(org?.homeIsOrgCompany));
        // Trust API only — company arrays must not imply switch access without the permission.
        setApiCanSwitch(Boolean(org?.canSwitchCompanies));
        setAccessLoaded(true);

        const granted = [...(crm || []), ...(recruitment || []), ...fallback];
        const saved = getActiveOrgUnitId();
        if (saved && !granted.some((c) => c.id === saved)) {
          clearActiveOrgUnit({ reload: false });
          setOrgUnitId('');
          setOrgUnitName(String(org?.homeOrgUnitName || '').trim());
        } else if (saved) {
          const match = granted.find((c) => c.id === saved);
          if (match?.name) setOrgUnitName(match.name);
        } else if (!localMaySwitch) {
          setOrgUnitName(String(org?.homeOrgUnitName || '').trim() || getActiveOrgUnitName());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompaniesCrm([]);
          setCompaniesRecruitment([]);
          setHasCompanies(false);
          setHomeIsOrgCompany(false);
          setApiCanSwitch(false);
          setAccessLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [localMaySwitch]);

  return {
    orgUnitId: effectiveOrgUnitId,
    orgUnitName: effectiveOrgUnitName || orgUnitName,
    companies,
    canSwitchCompanies,
    hasCompanies,
    homeIsOrgCompany,
    purpose,
    setActiveOrgUnit,
  };
}
