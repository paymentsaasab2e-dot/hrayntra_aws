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
  dashboardLevel: 'self',
  statsScope: 'self',
  canFullStats: false,
  scopeLabel: 'your assigned records',
  showMineTab: false,
  showMineApprovals: false,
  org: { canSwitchCompanies: false, companies: [] },
};

export function useDashboardAccess() {
  const { canAccess, hasPermission, hasAnyPermission, isSuperAdmin } = usePermissions();
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
    // Only Super Admin auto-sees all dashboard tabs. Admin role follows permission ticks.
    const sa = isSuperAdmin();
    const modules = {
      leads: sa || canAccess('Leads'),
      clients: sa || canAccess('Clients'),
      jobs: sa || canAccess('Jobs'),
      candidates: sa || canAccess('Candidates'),
      interviews: sa || canAccess('Interviews'),
      placements: sa || canAccess('Placements'),
      tasks: sa || canAccess('Tasks'),
      team: sa || canAccess('Team'),
    };

    const crmAssigned = hasAnyPermission(Object.values(DASH_CRM_TAB_PERMS));
    const recAssigned = hasAnyPermission(Object.values(DASH_REC_TAB_PERMS));
    const canOpenDash = sa || hasPermission('view_dashboard');
    const showMineApprovals =
      rankAccess.showMineApprovals || sa || hasPermission('dash_mine_approvals');
    const showMineTab = rankAccess.showMineTab || sa || showMineApprovals;
    const canFullStats = rankAccess.canFullStats || sa;
    const dashboardLevel =
      sa ? 'tenant' : rankAccess.dashboardLevel || (canFullStats ? 'tenant' : 'self');

    const crmTab = (id: Exclude<CrmCategoryTabId, 'mine'>, fallback: boolean) => {
      if (sa) return true;
      if (crmAssigned) return hasPermission(DASH_CRM_TAB_PERMS[id]);
      return canOpenDash && fallback;
    };

    const recTab = (id: Exclude<RecCategoryTabId, 'mine'>, fallback: boolean) => {
      if (sa) return true;
      if (recAssigned) return hasPermission(DASH_REC_TAB_PERMS[id]);
      return canOpenDash && fallback;
    };

    const crmTeam = crmTab('team', modules.team);
    const recTeam = recTab('team', modules.team);

    // Hours & scores (4th tab) follows Team tab — paid unlock still applies inside the panel.
    // People listed there follow dashboard level (self / department / company / tenant).
    const crmTabs: Record<CrmCategoryTabId, boolean> = {
      mine: showMineTab && (sa || crmAssigned || canOpenDash),
      insights: crmTab('insights', modules.leads || modules.clients || modules.tasks),
      portfolio: crmTab('portfolio', modules.leads || modules.clients),
      team: crmTeam,
      people: crmTeam,
    };

    const recTabs: Record<RecCategoryTabId, boolean> = {
      mine: showMineTab && (sa || recAssigned || canOpenDash),
      insights: recTab('insights', modules.jobs || modules.candidates || modules.interviews),
      pipeline: recTab('pipeline', modules.jobs || modules.candidates),
      team: recTeam,
      people: recTeam,
    };

    return {
      full: sa,
      modules,
      crmTabs,
      recTabs,
      showMineTab,
      showMineApprovals,
      canFullStats,
      dashboardLevel,
      scopeLabel: rankAccess.scopeLabel,
      departmentName: rankAccess.departmentName,
      statsScope: canFullStats ? rankAccess.statsScope || 'full' : 'self',
      org: rankAccess.org,
      rankAccess,
    };
  }, [canAccess, hasPermission, hasAnyPermission, isSuperAdmin, rankAccess]);
}
