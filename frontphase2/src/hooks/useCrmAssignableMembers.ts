'use client';

import { useEffect, useState } from 'react';
import {
  apiGetClientAssignableMembers,
  apiGetLeadAssignableMembers,
  type CrmAssignableMember,
} from '@/lib/api';
import { startAsyncLoad } from '@/lib/asyncLoadGuard';
import type { TeamMember } from '@/types/team';
import { UserStatus } from '@/types/team';

const CRM_ASSIGN_MODULES = new Set(['Leads', 'Clients', 'RecruitmentClients']);

export function isCrmAssignmentModule(module?: string | null): boolean {
  return Boolean(module && CRM_ASSIGN_MODULES.has(String(module)));
}

function toTeamMember(member: CrmAssignableMember): TeamMember {
  const fullName =
    member.name ||
    `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
    member.email ||
    'User';
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  return {
    id: member.id,
    firstName: member.firstName || nameParts[0] || fullName,
    lastName: member.lastName || nameParts.slice(1).join(' ') || '',
    email: member.email || '',
    status: UserStatus.ACTIVE,
    role: {
      id: member.role?.id || '',
      roleName: member.role?.roleName || '',
      color: member.role?.color || 'gray',
      createdAt: '',
    },
    department: member.department
      ? {
          id: member.department.id || '',
          name: member.department.name || '',
          createdAt: '',
          updatedAt: '',
        }
      : null,
    manager: null,
    credential: null,
    _count: { tasks: 0 },
    orgUnitId: member.orgUnit?.id || null,
    orgUnit: member.orgUnit
      ? {
          id: member.orgUnit.id || '',
          name: member.orgUnit.name || '',
          kind: member.orgUnit.kind === 'branch' ? 'branch' : 'company',
        }
      : null,
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * Load CRM assignable users (sales-team filtered) without Organization → Member cascade.
 */
export function useCrmAssignableMembers(enabled = true, module?: string) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !isCrmAssignmentModule(module)) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const load = startAsyncLoad(setLoading);
    const fetchMembers =
      module === 'Leads'
        ? apiGetLeadAssignableMembers()
        : apiGetClientAssignableMembers(undefined, {
            recruitment: module === 'RecruitmentClients',
          });

    void fetchMembers
      .then((response) => {
        if (!load.isActive()) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setMembers(rows.map(toTeamMember));
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
  }, [enabled, module]);

  return {
    members,
    loading,
    canSelectCompany: false as const,
  };
}
