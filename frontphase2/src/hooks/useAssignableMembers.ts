'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { apiGetAssignCompanies } from '@/lib/org/orgApi';
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

  const [companies, setCompanies] = useState<AssignCompanyOption[]>([]);
  const [companiesReady, setCompaniesReady] = useState(!mayPickCompany);
  const [companyId, setCompanyId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const canSelectCompany = mayPickCompany && companies.length > 0;
  const seededCompanyRef = useRef('');

  useEffect(() => {
    if (!enabled || !canSelectCompany || !companiesReady || companyId) return;
    if (!initialCompanyId) return;
    if (!companies.some((row) => row.id === initialCompanyId)) return;
    if (seededCompanyRef.current === initialCompanyId) return;
    seededCompanyRef.current = initialCompanyId;
    setCompanyId(initialCompanyId);
  }, [enabled, canSelectCompany, companiesReady, companies, companyId, initialCompanyId]);

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
    void getAllTeamMembersForAssign(canSelectCompany ? companyId : undefined, module)
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
