import type { ElementType } from 'react';
import {
  LayoutDashboard,
  Target,
  Users,
  Briefcase,
  UserRound,
  GitBranch,
  Zap,
  Calendar,
  Award,
  CreditCard,
} from 'lucide-react';

/**
 * Sidebar nav row tint — matches the reference HRMS sidebar:
 *   - idle: colorful icon (per-item accent) so the rail stays colorful at rest
 *   - active: tinted glass wrap + brighter icon with a soft glow
 *
 * The wrapper applies a tinted ring for the glass effect; the icon keeps its brand color.
 */
export const NAV_ICON_ACCENTS: Record<
  string,
  { idle: string; activeWrap: string; activeIcon: string }
> = {
  sky: {
    idle: 'text-sky-400',
    activeWrap: 'bg-sky-400/10 border border-sky-400/25 ring-1 ring-sky-400/30 backdrop-blur',
    activeIcon: 'text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.55)]',
  },
  rose: {
    idle: 'text-rose-400',
    activeWrap: 'bg-rose-400/10 border border-rose-400/25 ring-1 ring-rose-400/30 backdrop-blur',
    activeIcon: 'text-rose-300 drop-shadow-[0_0_6px_rgba(251,113,133,0.55)]',
  },
  blue: {
    idle: 'text-blue-400',
    activeWrap: 'bg-blue-400/10 border border-blue-400/25 ring-1 ring-blue-400/30 backdrop-blur',
    activeIcon: 'text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.55)]',
  },
  amber: {
    idle: 'text-amber-400',
    activeWrap: 'bg-amber-400/10 border border-amber-400/25 ring-1 ring-amber-400/30 backdrop-blur',
    activeIcon: 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]',
  },
  violet: {
    idle: 'text-violet-400',
    activeWrap: 'bg-violet-400/10 border border-violet-400/25 ring-1 ring-violet-400/30 backdrop-blur',
    activeIcon: 'text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.55)]',
  },
  cyan: {
    idle: 'text-cyan-400',
    activeWrap: 'bg-cyan-400/10 border border-cyan-400/25 ring-1 ring-cyan-400/30 backdrop-blur',
    activeIcon: 'text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.55)]',
  },
  emerald: {
    idle: 'text-emerald-400',
    activeWrap: 'bg-emerald-400/10 border border-emerald-400/25 ring-1 ring-emerald-400/30 backdrop-blur',
    activeIcon: 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]',
  },
  indigo: {
    idle: 'text-indigo-400',
    activeWrap: 'bg-indigo-400/10 border border-indigo-400/25 ring-1 ring-indigo-400/30 backdrop-blur',
    activeIcon: 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.55)]',
  },
  orange: {
    idle: 'text-orange-400',
    activeWrap: 'bg-orange-400/10 border border-orange-400/25 ring-1 ring-orange-400/30 backdrop-blur',
    activeIcon: 'text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.55)]',
  },
  fuchsia: {
    idle: 'text-fuchsia-400',
    activeWrap: 'bg-fuchsia-400/10 border border-fuchsia-400/25 ring-1 ring-fuchsia-400/30 backdrop-blur',
    activeIcon: 'text-fuchsia-300 drop-shadow-[0_0_6px_rgba(232,121,249,0.55)]',
  },
  lime: {
    idle: 'text-lime-400',
    activeWrap: 'bg-lime-400/10 border border-lime-400/25 ring-1 ring-lime-400/30 backdrop-blur',
    activeIcon: 'text-lime-300 drop-shadow-[0_0_6px_rgba(190,242,100,0.55)]',
  },
  teal: {
    idle: 'text-teal-400',
    activeWrap: 'bg-teal-400/10 border border-teal-400/25 ring-1 ring-teal-400/30 backdrop-blur',
    activeIcon: 'text-teal-300 drop-shadow-[0_0_6px_rgba(45,212,191,0.55)]',
  },
  pink: {
    idle: 'text-pink-400',
    activeWrap: 'bg-pink-400/10 border border-pink-400/25 ring-1 ring-pink-400/30 backdrop-blur',
    activeIcon: 'text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.55)]',
  },
  slate: {
    idle: 'text-slate-300',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-slate-300/25 backdrop-blur',
    activeIcon: 'text-slate-100',
  },
};

export type NavAccent = keyof typeof NAV_ICON_ACCENTS;

export interface NavItemConfig {
  icon: ElementType;
  label: string;
  href: string;
  accent: NavAccent;
}

export interface CrmNavFlags {
  canViewDashboard: boolean;
  canViewLeads: boolean;
  canViewClients: boolean;
}

export function crmNavItems(flags: CrmNavFlags): NavItemConfig[] {
  return [
    ...(flags.canViewDashboard
      ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', accent: 'sky' as NavAccent }]
      : []),
    ...(flags.canViewLeads
      ? [{ icon: Target, label: 'Leads', href: '/leads', accent: 'rose' as NavAccent }]
      : []),
    ...(flags.canViewClients
      ? [{ icon: Users, label: 'CRM Clients', href: '/client', accent: 'blue' as NavAccent }]
      : []),
  ];
}

export interface RecruitmentNavFlags {
  canViewRecruitmentDashboard: boolean;
  canViewRecruitmentClients: boolean;
  canViewJobs: boolean;
  canViewCandidates: boolean;
  canViewPipeline: boolean;
  canViewMatches: boolean;
  canViewInterviews: boolean;
  canViewPlacements: boolean;
  canViewBilling: boolean;
}

export function recruitmentNavItems(flags: RecruitmentNavFlags): NavItemConfig[] {
  return [
    ...(flags.canViewRecruitmentDashboard
      ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/recruitment', accent: 'indigo' as NavAccent }]
      : []),
    ...(flags.canViewRecruitmentClients
      ? [{ icon: Users, label: 'Recruitment Clients', href: '/client?scope=recruitment', accent: 'blue' as NavAccent }]
      : []),
    ...(flags.canViewJobs
      ? [{ icon: Briefcase, label: 'Jobs', href: '/job', accent: 'amber' as NavAccent }]
      : []),
    ...(flags.canViewCandidates
      ? [{ icon: UserRound, label: 'Candidates', href: '/candidate', accent: 'violet' as NavAccent }]
      : []),
    ...(flags.canViewPipeline
      ? [{ icon: GitBranch, label: 'Pipeline', href: '/pipeline', accent: 'indigo' as NavAccent }]
      : []),
    ...(flags.canViewMatches
      ? [{ icon: Zap, label: 'Matches', href: '/matches', accent: 'orange' as NavAccent }]
      : []),
    ...(flags.canViewInterviews
      ? [{ icon: Calendar, label: 'Interviews', href: '/interviews', accent: 'cyan' as NavAccent }]
      : []),
    ...(flags.canViewPlacements
      ? [{ icon: Award, label: 'Placements', href: '/placement', accent: 'emerald' as NavAccent }]
      : []),
    ...(flags.canViewBilling
      ? [{ icon: CreditCard, label: 'Billing', href: '/billing', accent: 'amber' as NavAccent }]
      : []),
  ];
}
