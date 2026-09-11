'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { apiGetAssignCompanies, apiOrgWorkspace } from '@/lib/org/orgApi';
import { getActiveOrgUnitId, ORG_WORKSPACE_EVENT } from '@/lib/org/orgWorkspaceStorage';
import {
  getAllTeamMembersForAssign,
  teamMembersToBackendUsers,
} from '@/lib/api/teamApi';
import type { TeamMember } from '@/types/team';
import type { BackendUser } from '@/lib/api';
import { startAsyncLoad } from '@/lib/asyncLoadGuard';
import { dedupeByCompanyName } from '@/lib/companyNameKey';

export type AssignCompanyOption = { id: string; name: string; kind?: string };

function mergeCompanies(rows: AssignCompanyOption[]): AssignCompanyOption[] {
  return dedupeByCompanyName(
    (Array.isArray(rows) ? rows : []).filter((row) => row?.id && row.kind !== 'hq'),
    (row) => row.name,
  );
}

export function useAssignableMembers(
  enabled = true,
  module?: string,
  options?: { initialCompanyId?: string },
) {
  const { isSuperAdmin, hasAnyPermission } = usePermissions();
  const mayPickCompany =
    isSuperAdmin() ||
    hasAnyPermission([
      'view_cross_company_members',
      'VIEW_CROSS_COMPANY_MEMBERS',
      'switch_companies',
      'SWITCH_COMPANIES',
    ]);
  const initialCompanyId = String(options?.initialCompanyId || '').trim();
  const [workspaceCompanyId, setWorkspaceCompanyId] = useState('');

  const [companies, setCompanies] = useState<AssignCompanyOption[]>([]);
  const [companiesReady, setCompaniesReady] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  /** Show Organization whenever we have at least one org unit to assign under. */
  const canSelectCompany = companies.length > 0;
  const seededCompanyRef = useRef('');

  useEffect(() => {
    const syncWorkspace = () => setWorkspaceCompanyId(getActiveOrgUnitId());
    syncWorkspace();
    window.addEventListener(ORG_WORKSPACE_EVENT, syncWorkspace);
    return () => window.removeEventListener(ORG_WORKSPACE_EVENT, syncWorkspace);
  }, []);

  const preferredCompanyId = initialCompanyId || workspaceCompanyId;

  useEffect(() => {
    if (!enabled || !canSelectCompany || !companiesReady || companyId) return;
    if (!preferredCompanyId) {
      // Single org: auto-select so Manager/Team can load immediately.
      if (companies.length === 1 && companies[0]?.id) {
        seededCompanyRef.current = companies[0].id;
        setCompanyId(companies[0].id);
      }
      return;
    }
    if (!companies.some((row) => row.id === preferredCompanyId)) return;
    if (seededCompanyRef.current === preferredCompanyId) return;
    seededCompanyRef.current = preferredCompanyId;
    setCompanyId(preferredCompanyId);
  }, [enabled, canSelectCompany, companiesReady, companies, companyId, preferredCompanyId]);

  useEffect(() => {
    if (!enabled) {
      setCompanies([]);
      setCompaniesReady(true);
      return;
    }
    let cancelled = false;
    setCompaniesReady(false);

    void (async () => {
      const collected: AssignCompanyOption[] = [];

      if (mayPickCompany) {
        try {
          const rows = await apiGetAssignCompanies(module);
          for (const row of Array.isArray(rows) ? rows : []) {
            if (row?.id) collected.push({ id: String(row.id), name: String(row.name || ''), kind: row.kind });
          }
        } catch {
          /* fall through to workspace */
        }
      }

      try {
        const org = await apiOrgWorkspace();
        const fromWorkspace = [
          ...(Array.isArray(org?.companiesRecruitment) ? org.companiesRecruitment : []),
          ...(Array.isArray(org?.companies) ? org.companies : []),
          ...(Array.isArray(org?.companiesCrm) ? org.companiesCrm : []),
        ];
        for (const row of fromWorkspace) {
          const id = String(row?.id || '').trim();
          const name = String(row?.name || '').trim();
          if (id && name) collected.push({ id, name, kind: 'company' });
        }
        // Pinned / home company when switch list is empty
        const homeId = String(org?.homeOrgUnitId || org?.orgUnitId || '').trim();
        const homeName = String(org?.homeOrgUnitName || '').trim();
        if (homeId && homeName && !collected.some((c) => c.id === homeId)) {
          collected.push({ id: homeId, name: homeName, kind: 'company' });
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      setCompanies(mergeCompanies(collected));
      setCompaniesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, mayPickCompany, module]);

  useEffect(() => {
    if (!companyId) return;
    if (companies.some((row) => row.id === companyId)) return;
    setCompanyId('');
  }, [companies, companyId]);

  useEffect(() => {
    if (!enabled) return;
    if (!companiesReady) return;
    if (canSelectCompany && !companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const load = startAsyncLoad(setLoading);
    const requestedCompanyId = canSelectCompany ? companyId : '';
    void getAllTeamMembersForAssign(requestedCompanyId || undefined, module)
      .then((rows) => {
        if (load.isActive()) setMembers(rows || []);
      })
      .catch(() => {
        if (load.isActive()) setMembers([]);
      })
      .finally(() => {
        load.finish();
      });
    return () => {
      load.abort();
    };
  }, [enabled, companiesReady, canSelectCompany, companyId, module]);

  const users: BackendUser[] = useMemo(() => teamMembersToBackendUsers(members), [members]);

  return {
    canSelectCompany,
    companies,
    companyId,
    setCompanyId,
    members,
    users,
    loading,
    companiesReady,
  };
}
