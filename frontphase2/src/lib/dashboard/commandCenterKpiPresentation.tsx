import React from 'react';
import {
  BadgeInfo,
  BarChart3,
  Briefcase,
  CheckCircle,
  Flame,
  FolderOpen,
  Phone,
  Plus,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import type { SummaryCardColor } from '@/components/ui/SummaryCard';
import type { ModuleTabKey } from './moduleCommandConfig';
import { clientTabFromWidget } from './commandCenterTableFilter';
import type { DashboardWidget } from './types';

const ICON_PROPS = { size: 16, strokeWidth: 2.35 as const };

export type KpiCardPresentation = {
  label: string;
  color: SummaryCardColor;
  icon: React.ReactNode;
};

/** Matches /client StatusCards tiles. */
export function clientCommandCenterKpiPresentation(
  clientTab: string,
): KpiCardPresentation {
  switch (clientTab) {
    case 'active':
      return {
        label: 'Active',
        color: 'blue',
        icon: <Users {...ICON_PROPS} />,
      };
    case 'on-hold':
      return {
        label: 'On Hold',
        color: 'orange',
        icon: <Briefcase {...ICON_PROPS} />,
      };
    case 'inactive':
      return {
        label: 'Inactive',
        color: 'gray',
        icon: <BadgeInfo {...ICON_PROPS} />,
      };
    case 'hot':
      return {
        label: 'Hot',
        color: 'purple',
        icon: <Flame {...ICON_PROPS} />,
      };
    case 'all':
    default:
      return {
        label: 'All Clients',
        color: 'indigo',
        icon: <FolderOpen {...ICON_PROPS} />,
      };
  }
}

/** Matches /leads list SummaryCard row. */
export function leadsCommandCenterKpiPresentation(
  slug: string | undefined,
  fallbackLabel: string,
): KpiCardPresentation {
  switch (slug) {
    case 'new':
      return { label: 'New', color: 'cyan', icon: <Plus {...ICON_PROPS} /> };
    case 'qualified':
      return { label: 'Qualified', color: 'purple', icon: <Target {...ICON_PROPS} /> };
    case 'converted':
      return { label: 'Converted', color: 'green', icon: <CheckCircle {...ICON_PROPS} /> };
    case 'overdue-follow-ups':
      return { label: 'Overdue follow-ups', color: 'rose', icon: <Phone {...ICON_PROPS} /> };
    case 'total-leads':
      return { label: 'All leads', color: 'blue', icon: <Users {...ICON_PROPS} /> };
    default:
      return {
        label: fallbackLabel,
        color: 'blue',
        icon: <BarChart3 size={16} strokeWidth={2.25} />,
      };
  }
}

export function resolveCommandCenterKpiPresentation(
  moduleKey: ModuleTabKey,
  widget: DashboardWidget,
): KpiCardPresentation | null {
  if (moduleKey === 'clients') {
    return clientCommandCenterKpiPresentation(clientTabFromWidget(widget));
  }
  if (moduleKey === 'leads') {
    return leadsCommandCenterKpiPresentation(widget.config?.kpiSlug, widget.config?.kpiLabel || widget.title);
  }
  return null;
}
