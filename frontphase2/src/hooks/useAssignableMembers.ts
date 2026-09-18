'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { apiGetAssignCompanies, apiOrgWorkspace } from '@/lib/org/orgApi';
import { getActiveOrgUnitId, ORG_WORKSPACE_EVENT } from '@/lib/org/orgWorkspaceStorage';
import {
  getAllTeamMembersForAssign,
  teamMembersToBackendUsers,
  ensureCurrentUserInMembers,
  ASSIGNMENT_RULES_EVENT,
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
  const [homeCompanyId, setHomeCompanyId] = useState('');

  const [companies, setCompanies] = useState<AssignCompanyOption[]>([]);
  const [companiesReady, setCompaniesReady] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [rulesEpoch, setRulesEpoch] = useState(0);

  /**
   * Super Admin / cross-company users must pick an org — never load a tenant-wide mixed list.
   * Single-company workspaces auto-select and hide the picker.
   */
  const canSelectCompany = mayPickCompany || companies.length > 1;
  const seededCompanyRef = useRef('');

  useEffect(() => {
    const syncWorkspace = () => setWorkspaceCompanyId(getActiveOrgUnitId());
    syncWorkspace();
    window.addEventListener(ORG_WORKSPACE_EVENT, syncWorkspace);
    const onRulesChanged = () => setRulesEpoch((value) => value + 1);
    window.addEventListener(ASSIGNMENT_RULES_EVENT, onRulesChanged);
    return () => {
      window.removeEventListener(ORG_WORKSPACE_EVENT, syncWorkspace);
      window.removeEventListener(ASSIGNMENT_RULES_EVENT, onRulesChanged);
    };
  }, []);

  const preferredCompanyId = initialCompanyId || workspaceCompanyId || homeCompanyId;

  useEffect(() => {
    if (!enabled || !canSelectCompany || !companiesReady || companyId) return;
    if (!preferredCompanyId) {
      // Single org: auto-select so Manager/Team can load immediately.
      // Multi-org with no preference: pick first so existing assignments can hydrate.
      if (companies[0]?.id) {
        seededCompanyRef.current = companies[0].id;
        setCompanyId(companies[0].id);
      }
      return;
    }
    if (companies.some((row) => row.id === preferredCompanyId)) {
      if (seededCompanyRef.current === preferredCompanyId) return;
      seededCompanyRef.current = preferredCompanyId;
      setCompanyId(preferredCompanyId);
      return;
    }
    // Preferred org not in assignable list — fall back so the picker is not stuck empty.
    if (companies[0]?.id) {
      seededCompanyRef.current = companies[0].id;
      setCompanyId(companies[0].id);
    }
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

      try {
        const rows = await apiGetAssignCompanies(module);
        for (const row of Array.isArray(rows) ? rows : []) {
          if (row?.id) collected.push({ id: String(row.id), name: String(row.name || ''), kind: row.kind });
        }
      } catch {
        /* workspace is only used for home-company auto-select */
      }

      try {
        const org = await apiOrgWorkspace();
        const homeId = String(org?.homeOrgUnitId || org?.orgUnitId || '').trim();
        if (!cancelled) setHomeCompanyId(homeId);
      } catch {
        if (!cancelled) setHomeCompanyId('');
      }

      if (cancelled) return;
      setCompanies(mergeCompanies(collected));
      setCompaniesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, module]);

  useEffect(() => {
    if (!companyId) return;
    if (companies.some((row) => row.id === companyId)) return;
    setCompanyId('');
  }, [companies, companyId]);

  useEffect(() => {
    if (!enabled) return;
    if (!companiesReady) return;
    // Super Admin on All companies: do not fetch people from every org.
    if ((canSelectCompany || mayPickCompany) && !companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const load = startAsyncLoad(setLoading);
    const requestedCompanyId = canSelectCompany || mayPickCompany ? companyId : '';
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
  }, [enabled, companiesReady, canSelectCompany, mayPickCompany, companyId, module, rulesEpoch]);

  const membersWithSelf = useMemo(() => ensureCurrentUserInMembers(members), [members]);
  const users: BackendUser[] = useMemo(
    () => teamMembersToBackendUsers(membersWithSelf),
    [membersWithSelf],
  );

  return {
    canSelectCompany,
    mayPickCompany,
    companies,
    companyId,
    setCompanyId,
    members: membersWithSelf,
    users,
    loading,
    companiesReady,
  };
}
