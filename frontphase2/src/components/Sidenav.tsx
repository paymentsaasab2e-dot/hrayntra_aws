'use client';

import React, { Suspense, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { usePermissions } from '../hooks/usePermissions';
import { MODULE_ACCESS_MAP } from '../lib/rbac/moduleAccess';
import { matchesQuickSearch, buildQuickSearchHaystack } from '../lib/quickSearch';
import { crmNavItems, recruitmentNavItems } from '../lib/navConfig';
import { useUser } from '../hooks/useUser';
import { NavItem, NavGroupFlyout } from './sidenavParts/NavItems';

import { PageErrorBoundary } from './PageErrorBoundary';
import {
  apiGetUnifiedCalendar,
  apiGetLeads,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetContacts,
  apiGetUsers,
  apiGetInterviews,
  apiGetTasks,
  apiGetPlacements,
  apiGetNotificationUnreadCount,
  NOTIFICATIONS_UPDATED_EVENT,
  isOrgBillingNavEnabled,
  isOrgModuleEnabled,
  getAccessToken,
  getCachedOrgSubscriptionPlanName,
  getCachedOrgPlanUsage,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
  syncOrgRecruitmentSummaryFromApi,
} from '../lib/api';
import {
  getCachedOrgSubscriptionPlan,
  getEmployersPurchaseUrl,
  getTrialDaysRemaining,
  isTrialExpired,
} from '../lib/orgTrialPlan';
import { formatDirectorDisplay } from '../constants/salutations';
import { formatDateDMY, formatDateTimeDMY } from '../utils/dateDisplay';
import { NotificationDrawer } from './NotificationDrawer';
import { 
  CalendarDays,
  Mail,
  LayoutDashboard, 
  Target,
  Users, 
  Briefcase, 
  UserRound, 
  GitBranch, 
  Zap, 
  Award, 
  CheckSquare, 
  Contact, 
  BarChart3, 
  CreditCard, 
  UserPlus, 
  Settings, 
  ChevronDown,
  Building2,
  DollarSign,
  Trash2,
  History,
  Coins,
  MessageSquarePlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppShellHeader, UserDropdown, resolveSidenavAvatar, Tooltip, type GlobalSearchResult } from './AppShellHeader';

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel = ({ label, collapsed }: { label: string; collapsed: boolean }) => {
  if (collapsed) return <div className="h-px bg-white/8 my-3 mx-3" />;
  return (
    <div className="px-4 mt-5 mb-1.5">
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#4A6070]">{label}</span>
    </div>
  );
};

const Divider = () => <div className="h-px bg-white/8 my-2 mx-3" />;

const SIDENAV_SCROLL_STORAGE_KEY = 'hrayntra:sidenav-scroll-top';

function extractListItems<T>(response: any): T[] {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    if (Array.isArray((payload as any).data)) return (payload as any).data as T[];
    if (Array.isArray((payload as any).items)) return (payload as any).items as T[];
  }
  return [];
}

// ─── Main Sidenav ─────────────────────────────────────────────────────────────
interface SidenavProps {
  avatarUrl?: string;
  userProfile?: { name: string; role: string; avatarUrl: string };
  children?: React.ReactNode;
}

function SidenavInner({ avatarUrl = '', userProfile, children }: SidenavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [navSearch, setNavSearch] = useState('');
  const [billingNavEnabled, setBillingNavEnabled] = useState(true);
  const [hqModulesTick, setHqModulesTick] = useState(0);
  const [orgPlanName, setOrgPlanName] = useState<string>('');
  const [orgPlanUsage, setOrgPlanUsage] = useState<ReturnType<typeof getCachedOrgPlanUsage>>(null);
  // Always null on first render (SSR + hydration) — cache is applied in useEffect to avoid hydration mismatch.
  const [orgSubscriptionPlan, setOrgSubscriptionPlan] = useState<ReturnType<
    typeof getCachedOrgSubscriptionPlan
  >>(null);
  const [recruitmentMode, setRecruitmentMode] = useState<'agency' | 'standalone'>('agency');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const searchRequestSeqRef = useRef(0);
  const hasRestoredScrollRef = useRef(false);
  const { hasPermission, hasAnyPermission, isAdmin, isSuperAdmin } = usePermissions();
  const { user } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Ensure client-side only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const sync = () => {
      setBillingNavEnabled(isOrgBillingNavEnabled());
      setOrgPlanName(getCachedOrgSubscriptionPlanName());
      setOrgPlanUsage(getCachedOrgPlanUsage());
      setOrgSubscriptionPlan(getCachedOrgSubscriptionPlan());
      setRecruitmentMode(getCachedOrgRecruitmentMode());
      setHqModulesTick((n) => n + 1);
    };
    sync();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Pull latest HQ tab entitlements on every shell mount / focus so tenant
  // sidenav updates after HQ changes tabs (not only on next login).
  useEffect(() => {
    if (!getAccessToken()) return undefined;
    let cancelled = false;
    const refreshModules = () => {
      void syncOrgRecruitmentSummaryFromApi().then(() => {
        if (!cancelled) setHqModulesTick((n) => n + 1);
      });
      void import('../lib/useOrgExportWatermark')
        .then((m) => m.fetchAndCacheOrgWatermark())
        .catch(() => undefined);
    };
    refreshModules();
    const onFocus = () => refreshModules();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Bell badge: keep CRM unread count fresh. Listens to the in-app event
  // emitted whenever a notification is created / marked read / deleted.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await apiGetNotificationUnreadCount();
        if (!cancelled) setNotificationCount(res.count);
      } catch {
        /* silent — bell badge is non-critical */
      }
    };
    void refresh();
    const onUpdated = () => void refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
      window.clearInterval(interval);
    };
  }, []);

  useLayoutEffect(() => {
    if (!mounted || hasRestoredScrollRef.current) {
      return;
    }

    const nav = navScrollRef.current;
    if (!nav) {
      return;
    }

    hasRestoredScrollRef.current = true;

    try {
      const savedScrollTop = window.sessionStorage.getItem(SIDENAV_SCROLL_STORAGE_KEY);
      if (savedScrollTop !== null) {
        nav.scrollTop = Number(savedScrollTop) || 0;
      }
    } catch {
      // Ignore storage failures and fall back to the browser's default behavior.
    }
  }, [mounted]);

  useEffect(() => {
    const nav = navScrollRef.current;
    if (!nav) {
      return;
    }

    const activeItem = nav.querySelector<HTMLElement>('[data-sidenav-nav-item="true"][data-active="true"]');
    if (!activeItem) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const isFullyVisible = itemRect.top >= navRect.top && itemRect.bottom <= navRect.bottom;

    if (!isFullyVisible) {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [pathname, mounted, isCollapsed, mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    return () => {
      const nav = navScrollRef.current;
      if (!nav) {
        return;
      }

      try {
        window.sessionStorage.setItem(SIDENAV_SCROLL_STORAGE_KEY, String(nav.scrollTop));
      } catch {
        // Ignore storage failures.
      }
    };
  }, []);

  const persistScrollPosition = () => {
    const nav = navScrollRef.current;
    if (!nav) {
      return;
    }

    try {
      window.sessionStorage.setItem(SIDENAV_SCROLL_STORAGE_KEY, String(nav.scrollTop));
    } catch {
      // Ignore storage failures.
    }
  };

  const handleNavigate = () => {
    persistScrollPosition();
    setMobileNavOpen(false);
  };

  // Keep wheel / trackpad scroll on the fixed sidebar from bubbling to `motion.main`
  // (phase 2 shell uses overflow-y-auto on main). Native non-passive listener is required
  // so preventDefault works at scroll boundaries and over the non-scroll footer.
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      const nav = navScrollRef.current;
      if (!nav) {
        e.preventDefault();
        return;
      }

      // Horizontal trackpad scroll should not move the main surface horizontally.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const overNav = e.clientY >= navRect.top && e.clientY <= navRect.bottom;

      if (!overNav) {
        e.preventDefault();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = nav;
      const eps = 2;
      const canScrollUp = scrollTop > eps;
      const canScrollDown = scrollTop + clientHeight < scrollHeight - eps;
      const hasOverflow = scrollHeight > clientHeight + eps;

      if (!hasOverflow) {
        e.preventDefault();
        return;
      }

      const dy = e.deltaY;
      if (dy < 0 && !canScrollUp) {
        e.preventDefault();
        return;
      }
      if (dy > 0 && !canScrollDown) {
        e.preventDefault();
        return;
      }
    };

    aside.addEventListener('wheel', handleWheel, { passive: false });
    return () => aside.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadNotificationCount() {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const response = await apiGetUnifiedCalendar({
          start: start.toISOString(),
          end: end.toISOString(),
          mineOnly: true,
        });

        if (!ignore) {
          setNotificationCount(response.data.events.length);
        }
      } catch {
        if (!ignore) {
          setNotificationCount(0);
        }
      }
    }

    if (mounted) {
      loadNotificationCount();
    }

    return () => {
      ignore = true;
    };
  }, [mounted]);

  useEffect(() => {
    const syncSidenavWidth = () => {
      const width = window.innerWidth < 768 ? 0 : isCollapsed ? 60 : 220;
      document.documentElement.style.setProperty('--ph2-sidenav-w', `${width}px`);
    };
    syncSidenavWidth();
    window.addEventListener('resize', syncSidenavWidth);
    return () => window.removeEventListener('resize', syncSidenavWidth);
  }, [isCollapsed]);
  
  // Super Admin sees everything - bypass permission checks
  const showAll = mounted && isSuperAdmin();
  const isAgencyMode = recruitmentMode !== 'standalone';

  // Show the user's `designation` (e.g. "Senior Recruiter") when set so a
  // user with role RECRUITER doesn't get labelled with the bare role string.
  // SUPER_ADMIN keeps showing "SUPER_ADMIN" because it has no designation set.
  const formatRoleLabel = (raw: string) => {
    if (!raw) return '';
    if (raw === 'SUPER_ADMIN') return 'Super Admin';
    return raw
      .toLowerCase()
      .split(/[_\s]+/)
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join(' ');
  };
  const rawRole = user?.role || userProfile?.role || '';
  const designation = (user?.designation || '').trim();
  const companyName = String(user?.organizationName || user?.companyName || '').trim();
  const profile = {
    name: user?.name || userProfile?.name || 'User',
    role: designation || formatRoleLabel(rawRole),
    avatarUrl: resolveSidenavAvatar(user?.avatar || userProfile?.avatarUrl || avatarUrl),
    companyName,
  };

  const SIDEBAR_W = isCollapsed ? 60 : 220;
  const navCollapsed = mobileNavOpen ? false : isCollapsed;

  // CRM group visibility + auto-expansion when the user is on one of its routes.
  // HQ `enabledModules` gates tabs even for tenant Super Admins.
  // hqModulesTick re-reads localStorage when HQ updates tenant tabs.
  void hqModulesTick;
  const canViewDashboard =
    mounted &&
    isOrgModuleEnabled('crm_dashboard') &&
    (showAll || hasAnyPermission(['view_dashboard']) || isSuperAdmin());
  const canViewLeads =
    mounted &&
    isAgencyMode &&
    isOrgModuleEnabled('leads') &&
    (showAll || hasAnyPermission(['leads_read', 'leads_create', 'leads_update', 'leads_delete']));
  const canViewClients =
    mounted &&
    isAgencyMode &&
    isOrgModuleEnabled('clients') &&
    (showAll || hasAnyPermission(['clients_read', 'clients_create', 'clients_update', 'clients_delete']));
  const canViewRecruitmentClients =
    mounted &&
    isOrgModuleEnabled('clients') &&
    (showAll || hasAnyPermission(MODULE_ACCESS_MAP.RecruitmentClients));
  const isCrmClientsRoute =
    (pathname === '/client' || (pathname || '').startsWith('/client/')) &&
    searchParams.get('scope') !== 'recruitment';
  const isCrmRouteActive =
    ['/leads', '/dashboard'].some(
      (route) => pathname === route || (pathname || '').startsWith(`${route}/`),
    ) || isCrmClientsRoute;

  // Recruitment group — Jobs, Candidates, Interviews, Placements, Dashboard
  const canViewJobs =
    mounted &&
    isOrgModuleEnabled('jobs') &&
    (showAll ||
      hasAnyPermission([
        'jobs_read',
        'jobs_create',
        'jobs_update',
        'jobs_delete',
        'view_jobs',
        'create_job',
        'edit_job',
        'delete_job',
        'assign_job',
      ]));
  const canViewCandidates =
    mounted &&
    isOrgModuleEnabled('candidates') &&
    (showAll ||
      hasAnyPermission([
        'candidates_read',
        'candidates_create',
        'candidates_update',
        'candidates_delete',
        'view_assigned_candidates',
        'view_all_candidates',
        'add_candidate',
        'edit_candidate',
        'delete_candidate',
      ]));
  const canViewInterviews =
    mounted &&
    isOrgModuleEnabled('interviews') &&
    (showAll || hasAnyPermission(['interviews_read', 'interviews_create', 'interviews_update', 'interviews_delete']));
  const canViewPlacements =
    mounted &&
    isOrgModuleEnabled('placements') &&
    (showAll || hasAnyPermission(['placements_read', 'placements_create', 'placements_update', 'placements_delete']));
  const canViewRecruitmentDashboard =
    mounted &&
    isOrgModuleEnabled('command_center') &&
    (showAll ||
      isSuperAdmin() ||
      hasAnyPermission(MODULE_ACCESS_MAP.RecDashboard));
  const canViewPipeline =
    mounted &&
    isOrgModuleEnabled('pipeline') &&
    (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Pipeline));
  const canViewMatches =
    mounted &&
    isOrgModuleEnabled('matches') &&
    (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Matches));
  const canViewBilling =
    mounted &&
    isOrgModuleEnabled('billing') &&
    billingNavEnabled &&
    (showAll || hasPermission('access_billing'));
  const canViewRecruitmentNav =
    canViewJobs ||
    canViewCandidates ||
    canViewInterviews ||
    canViewPlacements ||
    canViewRecruitmentDashboard ||
    canViewPipeline ||
    canViewMatches ||
    canViewRecruitmentClients ||
    canViewBilling;
  const isRecruitmentClientsRoute =
    pathname === '/client' && searchParams.get('scope') === 'recruitment';
  const isRecruitmentRouteActive =
    [
      '/job',
      '/candidate',
      '/interviews',
      '/placement',
      '/placements',
      '/recruitment',
      '/pipeline',
      '/matches',
      '/billing',
    ].some((route) => pathname === route || (pathname || '').startsWith(`${route}/`)) ||
    isRecruitmentClientsRoute;

  useEffect(() => {
    const query = navSearch.trim();
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }

    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestSeq = ++searchRequestSeqRef.current;
    setSearchLoading(true);

    searchTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          // Universal search: query every backend list endpoint that supports
          // a `search` param so the navbar surfaces *any* record by name.
          // Each endpoint is wrapped so a single failure doesn't blank the
          // whole result set; missing endpoints (e.g., user lacks permission)
          // simply contribute zero results.
          const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null as T | null);
          const [
            leadRes,
            candidateRes,
            clientRes,
            recClientRes,
            jobRes,
            contactRes,
            userRes,
            interviewRes,
            taskRes,
            placementRes,
          ] = await Promise.all([
            safe(apiGetLeads({ search: query, page: 1, limit: 3 })),
            safe(apiGetCandidates({ search: query, page: 1, limit: 3 })),
            safe(apiGetClients({ search: query, page: 1, limit: 3, includeContacts: false, includeLeadFields: false })),
            safe(apiGetClients({ search: query, page: 1, limit: 3, includeContacts: false, includeLeadFields: false, recruitmentEnabled: true })),
            safe(apiGetJobs({ search: query, page: 1, limit: 3 })),
            safe(apiGetContacts({ search: query, page: 1, limit: 3 })),
            safe(apiGetUsers({ assignable: true, search: query, isActive: true, limit: 3 })),
            safe(apiGetInterviews({ search: query, page: 1, limit: 3 })),
            safe(apiGetTasks({ page: 1, limit: 6 } as any)),
            safe(apiGetPlacements({ page: 1, limit: 6 } as any)),
          ]);

          if (searchRequestSeqRef.current !== requestSeq) return;

          const leadItems = extractListItems<any>(leadRes).map((lead: any) => ({
            id: String(lead.id),
            title: String(lead.companyName || lead.contactPerson || lead.email || 'Lead'),
            subtitle:
              [formatDirectorDisplay(lead.directorSalutation, lead.directorName || lead.contactPerson), lead.email]
                .filter(Boolean)
                .join(' • ') || 'Lead record',
            kind: 'Lead',
            href: `/leads?leadId=${encodeURIComponent(String(lead.id))}`,
          }));

          const candidateItems = extractListItems<any>(candidateRes).map((candidate: any) => ({
            id: String(candidate.id),
            title: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || candidate.email || 'Candidate',
            subtitle: [candidate.currentCompany, candidate.email].filter(Boolean).join(' • ') || 'Candidate record',
            kind: 'Candidate',
            href: `/candidate?candidateId=${encodeURIComponent(String(candidate.id))}`,
          }));

          const crmClientItems = extractListItems<any>(clientRes).map((client: any) => ({
            id: String(client.id),
            title: String(client.companyName || client.name || 'Client'),
            subtitle: [client.location, client.email].filter(Boolean).join(' • ') || 'Client record',
            kind: 'Client',
            href: `/client?clientId=${encodeURIComponent(String(client.id))}`,
          }));
          const recClientItems = extractListItems<any>(recClientRes).map((client: any) => ({
            id: String(client.id),
            title: String(client.companyName || client.name || 'Client'),
            subtitle: [client.location, client.email].filter(Boolean).join(' • ') || 'Recruitment client',
            kind: 'Client',
            href: `/client?scope=recruitment&clientId=${encodeURIComponent(String(client.id))}`,
          }));
          const seenClientIds = new Set(crmClientItems.map((item) => item.id));
          const clientItems = [
            ...crmClientItems,
            ...recClientItems.filter((item) => !seenClientIds.has(item.id)),
          ];

          const jobItems = extractListItems<any>(jobRes).map((job: any) => ({
            id: String(job.id),
            title: String(job.title || 'Job'),
            subtitle: [job.client?.companyName, job.location].filter(Boolean).join(' • ') || 'Job record',
            kind: 'Job',
            href: `/job?jobId=${encodeURIComponent(String(job.id))}`,
          }));

          const contactItems = extractListItems<any>(contactRes).map((contact: any) => ({
            id: String(contact.id),
            title: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.email || 'Contact',
            subtitle: [contact.company?.companyName, contact.email].filter(Boolean).join(' • ') || 'Contact record',
            kind: 'Contact',
            href: `/contacts?contactId=${encodeURIComponent(String(contact.id))}`,
          }));

          const teamItems = extractListItems<any>(userRes).map((u: any) => ({
            id: String(u.id),
            title: String(u.name || u.email || 'Team member'),
            subtitle: [u.role, u.email].filter(Boolean).join(' • ') || 'Team member',
            kind: 'Team',
            href: `/team?memberId=${encodeURIComponent(String(u.id))}`,
          }));

          const interviewItems = extractListItems<any>(interviewRes).map((iv: any) => {
            const candidateName = [iv.candidate?.firstName, iv.candidate?.lastName].filter(Boolean).join(' ').trim();
            const jobTitle = iv.job?.title || iv.title || 'Interview';
            return {
              id: String(iv.id),
              title: candidateName ? `${candidateName} • ${jobTitle}` : String(jobTitle),
              subtitle: [iv.round, iv.status, iv.scheduledAt ? formatDateTimeDMY(iv.scheduledAt) : null]
                .filter(Boolean)
                .join(' • ') || 'Interview',
              kind: 'Interview',
              href: `/interviews?interviewId=${encodeURIComponent(String(iv.id))}`,
            };
          });

          // Tasks/Placements list endpoints don't accept `search`, so filter
          // their first page client-side against the query.
          const lower = query.toLowerCase();
          const taskItems = extractListItems<any>(taskRes)
            .filter((t: any) =>
              matchesQuickSearch(
                buildQuickSearchHaystack(t.title, t.description, t.linkedEntityType),
                lower,
              ),
            )
            .slice(0, 3)
            .map((t: any) => ({
              id: String(t.id),
              title: String(t.title || 'Task'),
              subtitle: [t.status, t.priority, t.dueDate ? formatDateDMY(t.dueDate) : null]
                .filter(Boolean)
                .join(' • ') || 'Task',
              kind: 'Task',
              href: `/Task&Activites?taskId=${encodeURIComponent(String(t.id))}`,
            }));

          const placementItems = extractListItems<any>(placementRes)
            .filter((p: any) => {
              const candidateName = [p.candidate?.firstName, p.candidate?.lastName].filter(Boolean).join(' ');
              return matchesQuickSearch(
                buildQuickSearchHaystack(
                  candidateName,
                  p.candidate?.email,
                  p.job?.title,
                  p.client?.companyName,
                  p.status,
                ),
                lower,
              );
            })
            .slice(0, 3)
            .map((p: any) => {
              const candidateName = [p.candidate?.firstName, p.candidate?.lastName].filter(Boolean).join(' ').trim();
              return {
                id: String(p.id),
                title: candidateName || p.job?.title || 'Placement',
                subtitle: [p.job?.title, p.client?.companyName, p.status].filter(Boolean).join(' • ') || 'Placement',
                kind: 'Placement',
                href: `/placement?placementId=${encodeURIComponent(String(p.id))}`,
              };
            });

          setSearchResults(
            [
              ...candidateItems,
              ...jobItems,
              ...clientItems,
              ...leadItems,
              ...contactItems,
              ...teamItems,
              ...interviewItems,
              ...placementItems,
              ...taskItems,
            ].slice(0, 12)
          );
        } catch {
          if (searchRequestSeqRef.current === requestSeq) {
            setSearchResults([]);
          }
        } finally {
          if (searchRequestSeqRef.current === requestSeq) {
            setSearchLoading(false);
          }
        }
      })();
    }, 250);
  }, [navSearch]);

  const runSearchSelection = (result?: GlobalSearchResult | null) => {
    const target = result || searchResults[0];
    if (!target) return;
    setNavSearch('');
    setSearchResults([]);
    setSearchFocused(false);
    router.push(target.href);
  };

  return (
    <>
      <AppShellHeader
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mounted={mounted}
        notificationCount={notificationCount}
        setNotificationDrawerOpen={setNotificationDrawerOpen}
        profile={profile}
        navSearch={navSearch}
        setNavSearch={setNavSearch}
        searchFocused={searchFocused}
        setSearchFocused={setSearchFocused}
        searchLoading={searchLoading}
        searchResults={searchResults}
        runSearchSelection={runSearchSelection}
      />
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="ph2-sidenav-backdrop md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <motion.aside
        ref={asideRef}
        initial={false}
        animate={{ width: SIDEBAR_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className={`ph2-sidenav-aside fixed left-0 z-40 flex flex-col overflow-hidden ${
          mobileNavOpen ? 'ph2-sidenav-open' : ''
        }`}
        style={{
          top: 'calc(3.5rem + var(--ph2-impersonation-banner-h, 0px))',
          height: 'calc(100vh - 3.5rem - var(--ph2-impersonation-banner-h, 0px))',
          backgroundColor: '#0b1220',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Scrollable nav */}
        <div
          ref={navScrollRef}
          onScroll={persistScrollPosition}
          className="sidenav-scrollbar flex-1 overflow-y-auto overflow-x-hidden py-2"
        >
          {/* CRM — hover flyout: Dashboard → Leads → Clients */}
          {mounted && (canViewLeads || canViewClients || canViewDashboard) && (
            <NavGroupFlyout
              icon={Building2}
              imageSrc="/crmlog.png"
              label="CRM"
              collapsed={navCollapsed}
              accent="sky"
              active={isCrmRouteActive}
              onNavigate={handleNavigate}
              expandInline={mobileNavOpen}
              items={crmNavItems({ canViewDashboard, canViewLeads, canViewClients })}
            />
          )}

          {/* Recruitment — hover flyout: Dashboard first, then Jobs → … */}
          {mounted && canViewRecruitmentNav && (
            <NavGroupFlyout
              icon={Briefcase}
              imageSrc="/image-removebg-preview.png"
              label="Recruitment"
              collapsed={navCollapsed}
              accent="amber"
              active={isRecruitmentRouteActive}
              onNavigate={handleNavigate}
              expandInline={mobileNavOpen}
              items={recruitmentNavItems({
                canViewRecruitmentDashboard,
                canViewRecruitmentClients,
                canViewJobs,
                canViewCandidates,
                canViewPipeline,
                canViewMatches,
                canViewInterviews,
                canViewPlacements,
                canViewBilling,
              })}
            />
          )}

          <Divider />

          {(mounted && isOrgModuleEnabled('tasks_activities') && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Tasks))) && (
            <NavItem icon={CheckSquare} label="Tasks & Activities" href="/Task&Activites" collapsed={navCollapsed} onNavigate={handleNavigate} accent="lime" />
          )}

          {(mounted && isOrgModuleEnabled('events') && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Events))) && (
            <NavItem icon={CalendarDays} label="Portal Events" href="/events" collapsed={navCollapsed} onNavigate={handleNavigate} accent="sky" />
          )}

          {(mounted &&
            (isOrgModuleEnabled('clients') || isOrgModuleEnabled('jobs')) &&
            (showAll || hasAnyPermission(MODULE_ACCESS_MAP.CompanyPage))) && (
            <NavItem icon={Building2} label="Company Page" href="/company-page" collapsed={navCollapsed} onNavigate={handleNavigate} accent="blue" />
          )}

          {(mounted && isOrgModuleEnabled('inbox') && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Inbox))) && (
            <NavGroupFlyout
              icon={Mail}
              label="Inbox"
              collapsed={navCollapsed}
              accent="fuchsia"
              active={(pathname || '') === '/inbox' || (pathname || '').startsWith('/inbox/')}
              onNavigate={handleNavigate}
              expandInline={mobileNavOpen}
              items={[
                { icon: Mail, label: 'Gmail', href: '/inbox?mailbox=gmail', accent: 'rose' },
                { icon: Mail, label: 'Outlook', href: '/inbox?mailbox=outlook', accent: 'sky' },
              ]}
            />
          )}

          {(mounted && isOrgModuleEnabled('contacts') && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Contacts))) && (
            <NavItem icon={Contact} label="Contacts" href="/contacts" collapsed={navCollapsed} onNavigate={handleNavigate} accent="teal" />
          )}

          <Divider />

          {/* Reports */}
          {(mounted && isOrgModuleEnabled('reports') && (showAll || hasAnyPermission(['reports_read', 'reports_create', 'reports_update', 'reports_delete']))) && (
            <NavItem icon={BarChart3} label="Reports" href="/reports" collapsed={navCollapsed} onNavigate={handleNavigate} accent="pink" />
          )}
          
          {/* Recycle Bin — soft-deleted leads / clients / candidates / jobs land here.
              Visible to anyone with delete permission on at least one of those modules so the
              menu surfaces alongside the relevant deletion actions. */}
          {(mounted && isOrgModuleEnabled('recycle_bin') && (showAll || hasAnyPermission([
            'leads_delete',
            'clients_delete',
            'recruitment_clients_delete',
            'candidates_delete',
            'delete_candidate',
            'jobs_delete',
            'delete_job',
          ]))) && (
            <NavItem icon={Trash2} label="Recycle Bin" href="/recycle-bin" collapsed={navCollapsed} onNavigate={handleNavigate} accent="slate" />
          )}

          {mounted && isOrgModuleEnabled('activity_feed') ? (
            <NavItem icon={History} label="Activity log" href="/activity-feed" collapsed={navCollapsed} onNavigate={handleNavigate} accent="violet" />
          ) : null}

          <div className="h-4" />

          {/* Team */}
          {mounted &&
            (isOrgModuleEnabled('team') || isOrgModuleEnabled('requests') || isOrgModuleEnabled('approvals')) &&
            (showAll ||
              hasAnyPermission(MODULE_ACCESS_MAP.Team) ||
              hasAnyPermission(MODULE_ACCESS_MAP.Request) ||
              hasAnyPermission(MODULE_ACCESS_MAP.Organization)) && (
            <>
              <SectionLabel label="Team Management" collapsed={navCollapsed} />
              {(isOrgModuleEnabled('team') && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Team))) && (
                <NavItem icon={UserPlus} label="Team" href="/team" collapsed={navCollapsed} onNavigate={handleNavigate} accent="blue" />
              )}
              {(isOrgModuleEnabled('team') &&
                (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Organization))) && (
                <NavItem icon={GitBranch} label="Organization" href="/organization" collapsed={navCollapsed} onNavigate={handleNavigate} accent="teal" />
              )}
              {((isOrgModuleEnabled('requests') || isOrgModuleEnabled('approvals')) &&
                (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Request))) && (
                <NavItem icon={MessageSquarePlus} label="Requests" href="/request" collapsed={navCollapsed} onNavigate={handleNavigate} accent="indigo" />
              )}
              {showAll ? (
                <NavItem icon={Coins} label="Subscription" href="/subscription" collapsed={navCollapsed} onNavigate={handleNavigate} accent="amber" />
              ) : null}
            </>
          )}

          {/* Settings — gated by HQ modules when restricted; otherwise always available. */}
          {mounted && isOrgModuleEnabled('settings') && (
            <NavItem icon={Settings} label="Settings" href="/setting" collapsed={navCollapsed} onNavigate={handleNavigate} accent="slate" />
          )}
          
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/5">
          {/* Plan / Trial banner — read from client cache only after mount to avoid hydration mismatch. */}
          {!navCollapsed ? (
            !mounted ? (
              <div className="mb-3 h-[88px] rounded-lg bg-white/5 border border-white/10 animate-pulse" aria-hidden />
            ) : orgSubscriptionPlan?.isTrial ? (
              <div className="mb-3 rounded-lg p-2.5 bg-emerald-400/8 border border-emerald-400/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {isTrialExpired(orgSubscriptionPlan) ? 'Trial ended' : 'Trial'}
                  </span>
                  <span className="text-[10px] text-emerald-400/70">
                    {isTrialExpired(orgSubscriptionPlan)
                      ? 'Upgrade'
                      : `${getTrialDaysRemaining(orgSubscriptionPlan) ?? '—'} days left`}
                  </span>
                </div>
                <div className="text-sm font-bold text-emerald-300 truncate">
                  {orgSubscriptionPlan.name || orgPlanName || 'Starter Trial'}
                </div>
                <div className="mt-1 text-[10px] text-emerald-300/80">
                  {orgSubscriptionPlan.planStartDate
                    ? `Started ${formatDateDMY(orgSubscriptionPlan.planStartDate)}`
                    : 'Trial workspace'}
                  {orgSubscriptionPlan.planEndDate
                    ? ` · Ends ${formatDateDMY(orgSubscriptionPlan.planEndDate)}`
                    : ''}
                </div>
                <a
                  href={getEmployersPurchaseUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex w-full items-center justify-center rounded py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-semibold transition-colors"
                >
                  Purchase plan
                </a>
              </div>
            ) : orgPlanName ? (
              <div className="mb-3 rounded-lg p-2.5 bg-sky-400/8 border border-sky-400/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Active Plan</span>
                  <span className="text-[10px] text-sky-400/70">Live</span>
                </div>
                <div className="text-sm font-bold text-sky-300 truncate">{orgPlanName}</div>
                {orgPlanUsage ? (
                  <div className="mt-1 text-[10px] text-sky-300/80">
                    {orgPlanUsage.maxUsers == null
                      ? `${orgPlanUsage.activeUsers} users`
                      : `${orgPlanUsage.activeUsers}/${orgPlanUsage.maxUsers} users`}
                    {' · '}
                    {orgPlanUsage.maxJobs == null
                      ? `${orgPlanUsage.activeJobs} jobs`
                      : `${orgPlanUsage.activeJobs}/${orgPlanUsage.maxJobs} jobs`}
                  </div>
                ) : null}
                <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 w-full rounded-full" />
                </div>
              </div>
            ) : (
              <div className="mb-3 rounded-lg p-2.5 bg-emerald-400/8 border border-emerald-400/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Free Trial</span>
                  <span className="text-[10px] text-emerald-400/70">Upgrade available</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[70%] rounded-full" />
                </div>
                <button className="w-full mt-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-semibold rounded transition-colors">
                  Upgrade Plan
                </button>
              </div>
            )
          ) : (
            <div className="flex justify-center mb-3">
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${orgPlanName ? 'bg-sky-500' : 'bg-emerald-500'}`}
                title={orgPlanName ? `Active plan: ${orgPlanName}` : 'Free Trial Active'}
              />
            </div>
          )}

          {/* User row */}
          <div className="flex items-center gap-2.5">
            <UserDropdown
              avatarUrl={profile.avatarUrl}
              userName={profile.name}
              userRole={profile.role}
              companyName={profile.companyName}
              placement="top"
              align="left"
            />
            {!navCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white truncate">{profile.name}</p>
                {profile.companyName ? (
                  <p className="text-[9px] text-slate-300 truncate">{profile.companyName}</p>
                ) : null}
                <p className="text-[9px] text-[#4A6070] truncate">{profile.role}</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Main content area ───────────────────────────────────── */}
      <motion.main
        animate={{ marginLeft: SIDEBAR_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="ph2-main-surface min-h-screen min-w-0 max-w-full overflow-y-auto pt-[calc(3.5rem+var(--ph2-impersonation-banner-h,0px))]"
      >
        <PageErrorBoundary key={pathname || 'page'}>
          {children || (
            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
                <p className="text-sm text-slate-500">Welcome back, {profile.name}!</p>
              </div>
            </div>
          )}
        </PageErrorBoundary>
      </motion.main>

      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </>
  );
}

function SidenavShellFallback({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <div
        className="fixed inset-x-0 z-50 h-14 bg-[#0b1220] top-[var(--ph2-impersonation-banner-h,0px)]"
        aria-hidden
      />
      <div className="ph2-main-surface min-h-screen min-w-0 max-w-full pt-[calc(3.5rem+var(--ph2-impersonation-banner-h,0px))]">
        {children}
      </div>
    </>
  );
}

export function Sidenav(props: SidenavProps) {
  return (
    <Suspense fallback={<SidenavShellFallback>{props.children}</SidenavShellFallback>}>
      <PageErrorBoundary fallback={<SidenavShellFallback>{props.children}</SidenavShellFallback>}>
        <SidenavInner {...props} />
      </PageErrorBoundary>
    </Suspense>
  );
}

export default Sidenav;
