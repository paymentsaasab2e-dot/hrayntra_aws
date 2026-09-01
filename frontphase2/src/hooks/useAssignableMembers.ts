'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { apiGetAssignCompanies } from '@/lib/org/orgApi';
import { getActiveOrgUnitId, ORG_WORKSPACE_EVENT } from '@/lib/org/orgWorkspaceStorage';
import {
  getAllTeamMembersForAssign,
  teamMembersToBackendUsers,
} from '@/lib/api/teamApi';
import type { TeamMember } from '@/types/team';
import type { BackendUser } from '@/lib/api';

export type AssignCompanyOption = { id: string; name: string; kind?: string };

export function useAssignableMembers(
  enabled = true,
  module?: string,
  options?: { initialCompanyId?: string },
) {
  const { isSuperAdmin, hasAnyPermission } = usePermissions();
  const mayPickCompany =
    isSuperAdmin() ||
    hasAnyPermission(['view_cross_company_members', 'VIEW_CROSS_COMPANY_MEMBERS']);
  const initialCompanyId = String(options?.initialCompanyId || '').trim();
  const [workspaceCompanyId, setWorkspaceCompanyId] = useState('');

  const [companies, setCompanies] = useState<AssignCompanyOption[]>([]);
  const [companiesReady, setCompaniesReady] = useState(!mayPickCompany);
  const [companyId, setCompanyId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const canSelectCompany = mayPickCompany && companies.length > 0;
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
    if (!preferredCompanyId) return;
    if (!companies.some((row) => row.id === preferredCompanyId)) return;
    if (seededCompanyRef.current === preferredCompanyId) return;
    seededCompanyRef.current = preferredCompanyId;
    setCompanyId(preferredCompanyId);
  }, [enabled, canSelectCompany, companiesReady, companies, companyId, preferredCompanyId]);

  useEffect(() => {
    if (!enabled || !mayPickCompany) {
      setCompanies([]);
      setCompaniesReady(true);
      return;
    }
    let cancelled = false;
    setCompaniesReady(false);
    void apiGetAssignCompanies(module)
      .then((rows) => {
        if (cancelled) return;
        const next = (Array.isArray(rows) ? rows : []).filter(
          (row) => row?.id && row.kind !== 'hq',
        );
        setCompanies(next);
        setCompaniesReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setCompanies([]);
          setCompaniesReady(true);
        }
      });
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
    if (mayPickCompany && !companiesReady) return;
    if (canSelectCompany && !companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const requestedCompanyId = canSelectCompany ? companyId : '';
    void getAllTeamMembersForAssign(requestedCompanyId || undefined, module)
      .then((rows) => {
        if (!cancelled) setMembers(rows || []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, mayPickCompany, companiesReady, canSelectCompany, companyId, module]);

  const users: BackendUser[] = useMemo(() => teamMembersToBackendUsers(members), [members]);

  return {
    canSelectCompany,
    companies,
    companyId,
    setCompanyId,
    members,
    users,
    loading,
  };
}
