'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { apiDashboardAccess, type DashboardStatsAccess } from '@/lib/dashboard/api';
import type { CrmCategoryTabId } from '@/components/dashboard/crm/crmShared';
import type { RecCategoryTabId } from '@/components/dashboard/recruitment/recShared';

export const DASH_CRM_TAB_PERMS: Record<Exclude<CrmCategoryTabId, 'mine'>, string> = {
  insights: 'dash_crm_insights',
  portfolio: 'dash_crm_pipeline',
  team: 'dash_crm_team',
  people: 'dash_crm_people',
};

export const DASH_REC_TAB_PERMS: Record<Exclude<RecCategoryTabId, 'mine'>, string> = {
  insights: 'dash_rec_insights',
  pipeline: 'dash_rec_pipeline',
  team: 'dash_rec_team',
  people: 'dash_rec_people',
};

const EMPTY_RANK: DashboardStatsAccess = {
  statsScope: 'self',
  canFullStats: false,
  showMineTab: false,
  showMineApprovals: false,
  org: { canSwitchCompanies: false, companies: [] },
};

export function useDashboardAccess() {
  const { canAccess, hasPermission, hasAnyPermission, isAdmin, isSuperAdmin } = usePermissions();
  const [rankAccess, setRankAccess] = useState<DashboardStatsAccess>(EMPTY_RANK);

  useEffect(() => {
    let cancelled = false;
    void apiDashboardAccess()
      .then((data) => {
        if (!cancelled && data) setRankAccess(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const full = isAdmin() || isSuperAdmin();
    const modules = {
      leads: full || canAccess('Leads'),
      clients: full || canAccess('Clients'),
      jobs: full || canAccess('Jobs'),
      candidates: full || canAccess('Candidates'),
      interviews: full || canAccess('Interviews'),
      placements: full || canAccess('Placements'),
      tasks: full || canAccess('Tasks'),
      team: full || canAccess('Team'),
    };

    const crmAssigned = hasAnyPermission(Object.values(DASH_CRM_TAB_PERMS));
    const recAssigned = hasAnyPermission(Object.values(DASH_REC_TAB_PERMS));
    const canOpenDash = full || hasPermission('view_dashboard');
    const showMineApprovals =
      rankAccess.showMineApprovals || isSuperAdmin() || hasPermission('dash_mine_approvals');
    const showMineTab = rankAccess.showMineTab || isSuperAdmin() || showMineApprovals;
    const canFullStats = rankAccess.canFullStats || isSuperAdmin();

    const crmTab = (id: Exclude<CrmCategoryTabId, 'mine'>, fallback: boolean) => {
      if (full) return true;
      if (crmAssigned) return hasPermission(DASH_CRM_TAB_PERMS[id]);
      return canOpenDash && fallback;
    };

    const recTab = (id: Exclude<RecCategoryTabId, 'mine'>, fallback: boolean) => {
      if (full) return true;
      if (recAssigned) return hasPermission(DASH_REC_TAB_PERMS[id]);
      return canOpenDash && fallback;
    };

    const crmTabs: Record<CrmCategoryTabId, boolean> = {
      mine: showMineTab && (full || crmAssigned || canOpenDash),
      insights: crmTab('insights', modules.leads || modules.clients || modules.tasks),
      portfolio: crmTab('portfolio', modules.leads || modules.clients),
      team: crmTab('team', modules.team),
      people: crmTab('people', modules.team),
    };

    const recTabs: Record<RecCategoryTabId, boolean> = {
      mine: showMineTab && (full || recAssigned || canOpenDash),
      insights: recTab('insights', modules.jobs || modules.candidates || modules.interviews),
      pipeline: recTab('pipeline', modules.jobs || modules.candidates),
      team: recTab('team', modules.team),
      people: recTab('people', modules.team),
    };

    return {
      full,
      modules,
      crmTabs,
      recTabs,
      showMineTab,
      showMineApprovals,
      canFullStats,
      statsScope: canFullStats ? rankAccess.statsScope : 'self',
      org: rankAccess.org,
    };
  }, [canAccess, hasPermission, hasAnyPermission, isAdmin, isSuperAdmin, rankAccess]);
}
