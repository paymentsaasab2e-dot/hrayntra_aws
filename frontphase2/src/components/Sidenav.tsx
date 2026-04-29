'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '../hooks/usePermissions';
import { useUser } from '../hooks/useUser';
import {
  apiGetUnifiedCalendar,
  apiLogout,
  apiGetLeads,
  apiGetCandidates,
  apiGetClients,
  apiGetJobs,
  apiGetContacts,
} from '../lib/api';
import { NotificationDrawer } from './NotificationDrawer';
import { 
  Search, 
  Calendar, 
  Mail, 
  Bell, 
  Gift, 
  HelpCircle, 
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
  ChevronLeft,
  Menu,
  User,
  LogOut,
  Repeat,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_PROFILE_ICON = '/account-avatar-profile-user-11-svgrepo-com.svg';
const BLOCKED_DEFAULT_AVATAR_PATTERNS = ['photo-1701463387028-3947648f1337', 'images.unsplash.com'];

function resolveSidenavAvatar(src?: string | null) {
  const value = String(src || '').trim();
  if (!value) return DEFAULT_PROFILE_ICON;
  if (BLOCKED_DEFAULT_AVATAR_PATTERNS.some((pattern) => value.includes(pattern))) {
    return DEFAULT_PROFILE_ICON;
  }
  return value;
}

// ─── Fallback image component ─────────────────────────────────────────────────
const ImageWithFallback = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const [error, setError] = useState(false);
  const resolvedSrc = resolveSidenavAvatar(src);
  if (error || !resolvedSrc) {
    return <img src={DEFAULT_PROFILE_ICON} alt={alt} className={className} />;
  }
  return <img src={resolvedSrc} alt={alt} className={className} onError={() => setError(true)} />;
};

// ─── Quick Action Popover ─────────────────────────────────────────────────────
// ─── User Dropdown ────────────────────────────────────────────────────────────
const UserDropdown = ({ avatarUrl, userName, userRole }: { avatarUrl: string; userName: string; userRole: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const menuItems = [
    { icon: User,     label: 'My Profile' },
    { icon: Repeat,   label: 'Switch Workspace' },
    { icon: Settings, label: 'Settings' },
    { icon: LogOut,   label: 'Logout', color: 'text-red-500 hover:bg-red-50' },
  ];

  async function handleMenuClick(label: string) {
    if (label === 'My Profile') {
      router.push('/setting?section=profile');
      setIsOpen(false);
      return;
    }
    if (label === 'Settings') {
      router.push('/setting');
      setIsOpen(false);
      return;
    }
    if (label !== 'Logout' || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setIsOpen(false);

    try {
      await apiLogout();
    } finally {
      router.replace('/login?redirect=%2F');
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 focus:outline-none">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/50 transition-all">
          <ImageWithFallback src={avatarUrl} alt="User" className="w-full h-full object-cover" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-3 left-0 w-52 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50"
          >
            <div className="px-4 py-2 border-b border-slate-100 mb-1">
              <p className="text-sm font-semibold text-slate-800">{userName}</p>
              <p className="text-xs text-slate-500">{userRole}</p>
            </div>
            {menuItems.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleMenuClick(item.label)}
                disabled={item.label === 'Logout' && isLoggingOut}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  item.color || 'text-slate-600 hover:bg-slate-50'
                } ${item.label === 'Logout' && isLoggingOut ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="absolute top-full mt-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
      <div className="border-4 border-transparent border-b-slate-800 -mb-px" />
      <div className="bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
        {content}
      </div>
    </div>
  </div>
);

// ─── Nav Item ─────────────────────────────────────────────────────────────────
interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href?: string;
  active?: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}

const NavItem = ({ icon: Icon, label, href, active, collapsed, badge, onNavigate }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = active || (href && pathname === href);
  
  const content = (
    <div
      data-sidenav-nav-item="true"
      data-active={isActive ? 'true' : 'false'}
      className={`relative flex items-center h-9 rounded-md mx-2 my-0.5 px-2.5 cursor-pointer transition-all duration-150 group
        ${isActive
          ? 'bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
          : 'text-[#8899AA] hover:bg-white/8 hover:text-white'
        }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-r-full" />
      )}

      <div className={`flex items-center justify-center shrink-0 ${collapsed ? 'w-full' : 'mr-2.5'}`}>
        <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
      </div>

      {!collapsed && (
        <span className={`text-[13px] whitespace-nowrap overflow-hidden font-medium ${isActive ? 'text-white' : ''}`}>
          {label}
        </span>
      )}

      {!collapsed && badge ? (
        <span className="ml-auto bg-teal-500/20 text-teal-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      ) : null}

      {/* Tooltip on collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0A1929] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 whitespace-nowrap shadow-xl border border-white/10">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0A1929]" />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onNavigate} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

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

type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  href: string;
};

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

export function Sidenav({ avatarUrl = '', userProfile, children }: SidenavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [navSearch, setNavSearch] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<number | null>(null);
  const searchRequestSeqRef = useRef(0);
  const hasRestoredScrollRef = useRef(false);
  const { hasPermission, hasAnyPermission, isAdmin, isSuperAdmin } = usePermissions();
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  
  // Ensure client-side only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
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
  }, [pathname, mounted, isCollapsed]);

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
  
  // Super Admin sees everything - bypass permission checks
  const showAll = mounted && isSuperAdmin();

  const profile = {
    name: user?.name || userProfile?.name || 'User',
    role: user?.role || userProfile?.role || '',
    avatarUrl: resolveSidenavAvatar(user?.avatar || userProfile?.avatarUrl || avatarUrl),
  };

  const SIDEBAR_W = isCollapsed ? 64 : 240;

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
          const [leadRes, candidateRes, clientRes, jobRes, contactRes] = await Promise.all([
            apiGetLeads({ search: query, page: 1, limit: 4 }),
            apiGetCandidates({ search: query, page: 1, limit: 4 }),
            apiGetClients({ search: query, page: 1, limit: 4, includeContacts: false, includeLeadFields: false }),
            apiGetJobs({ search: query, page: 1, limit: 4 }),
            apiGetContacts({ search: query, page: 1, limit: 4 }),
          ]);

          if (searchRequestSeqRef.current !== requestSeq) return;

          const leadItems = extractListItems<any>(leadRes).map((lead: any) => ({
            id: String(lead.id),
            title: String(lead.companyName || lead.contactPerson || lead.email || 'Lead'),
            subtitle: [lead.contactPerson, lead.email].filter(Boolean).join(' • ') || 'Lead record',
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

          const clientItems = extractListItems<any>(clientRes).map((client: any) => ({
            id: String(client.id),
            title: String(client.companyName || client.name || 'Client'),
            subtitle: [client.location, client.email].filter(Boolean).join(' • ') || 'Client record',
            kind: 'Client',
            href: `/client?clientId=${encodeURIComponent(String(client.id))}`,
          }));

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

          setSearchResults([...leadItems, ...candidateItems, ...clientItems, ...jobItems, ...contactItems].slice(0, 10));
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
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 h-14 flex items-center px-5 z-50"
        style={{ backgroundColor: '#0F2A44', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo area — same width as sidebar so search starts after */}
        <div
          className="flex items-center gap-2 shrink-0 transition-all duration-300"
          style={{ width: SIDEBAR_W - 20 }}
        >
          <ImageWithFallback 
            src="/saasa-logo.png" 
            alt="SAASA Logo" 
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            {isCollapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className="flex flex-1 justify-center px-4">
          <div className="relative w-full max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setSearchFocused(false), 120);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearchSelection();
                }
                if (e.key === 'Escape') {
                  setNavSearch('');
                  setSearchResults([]);
                }
              }}
              placeholder="Search leads, candidates, clients..."
              className="w-full rounded-full border border-white/15 bg-white py-2.5 pl-11 pr-4 text-[13px] text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-white/30 focus:ring-2 focus:ring-white/20"
            />
            {searchFocused && (searchLoading || searchResults.length > 0) && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[70] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {searchLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching...</div>
                ) : (
                  <div className="max-h-[320px] overflow-auto py-2">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearchSelection(result)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="mt-0.5 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                          {result.kind}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{result.title}</div>
                          <div className="truncate text-xs text-slate-500">{result.subtitle}</div>
                        </div>
                      </button>
                    ))}
                    {searchResults.length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-500">No matches found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-4 pr-4 border-r border-white/10">
            <Tooltip content="Calendar">
              <Link href="/calendar" className="text-white/60 hover:text-white transition-colors">
                <Calendar className="w-5 h-5" />
              </Link>
            </Tooltip>
            <Tooltip content="Notifications">
              <button
                type="button"
                onClick={() => setNotificationDrawerOpen(true)}
                className="relative text-white/60 hover:text-white transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 px-1 text-[9px] font-bold text-white flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                ) : null}
              </button>
            </Tooltip>
            <Tooltip content="What's New">
              <button className="text-white/60 hover:text-white transition-colors">
                <Gift className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip content="Help Center">
              <Link
                href="/help-center"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Open Help Center"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>
            </Tooltip>
          </div>

          <UserDropdown 
            avatarUrl={profile.avatarUrl} 
            userName={profile.name}
            userRole={profile.role}
          />
        </div>
      </nav>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: SIDEBAR_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-14 flex flex-col z-40 overflow-hidden"
        style={{
          height: 'calc(100vh - 56px)',
          backgroundColor: '#0F2A44',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Scrollable nav */}
        <div
          ref={navScrollRef}
          onScroll={persistScrollPosition}
          className="flex-1 overflow-y-auto overflow-x-hidden py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Dashboard - always show */}
          <NavItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          
          {/* Leads */}
          {(mounted && (showAll || hasAnyPermission(['leads_read', 'leads_create', 'leads_update', 'leads_delete']))) && (
            <NavItem icon={Target} label="Leads" href="/leads" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
          {/* Clients */}
          {(mounted && (showAll || hasAnyPermission(['clients_read', 'clients_create', 'clients_update', 'clients_delete']))) && (
            <NavItem icon={Users} label="Clients" href="/client" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
          {/* Jobs */}
          {(mounted && (showAll || hasAnyPermission(['jobs_read', 'jobs_create', 'jobs_update', 'jobs_delete', 'view_jobs', 'create_job', 'edit_job', 'delete_job', 'assign_job']))) && (
            <NavItem icon={Briefcase} label="Jobs" href="/job" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
          {/* Candidates */}
          {(mounted && (showAll || hasAnyPermission(['candidates_read', 'candidates_create', 'candidates_update', 'candidates_delete', 'view_assigned_candidates', 'view_all_candidates', 'add_candidate', 'edit_candidate', 'delete_candidate']))) && (
            <NavItem icon={UserRound} label="Candidates" href="/candidate" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}

          {/* Interviews */}
          {(mounted && (showAll || hasAnyPermission(['interviews_read', 'interviews_create', 'interviews_update', 'interviews_delete']))) && (
            <NavItem icon={Calendar} label="Interviews" href="/interviews" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}

          {/* Placements */}
          {(mounted && (showAll || hasAnyPermission(['placements_read', 'placements_create', 'placements_update', 'placements_delete']))) && (
            <NavItem icon={Award} label="Placements" href="/placement" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
          {/* Pipeline */}
          {(mounted && (showAll || hasPermission('move_pipeline'))) && (
            <>
              <SectionLabel label="Recruitment Hub" collapsed={isCollapsed} />
              <NavItem icon={GitBranch} label="Pipeline" href="/pipeline" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
            </>
          )}
          
          {/* Matches */}
          {(mounted && (showAll || hasAnyPermission(['jobs_read', 'view_jobs', 'candidates_read', 'view_all_candidates', 'view_assigned_candidates']))) && (
            <NavItem icon={Zap} label="Matches" href="/matches" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}

          <Divider />

          {/* Tasks & Activities - always show */}
          <NavItem icon={CheckSquare} label="Tasks & Activities" href="/Task&Activites" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          
          {/* Inbox - always show */}
          <NavItem icon={Mail} label="Inbox" href="/inbox" collapsed={isCollapsed} badge={3} onNavigate={persistScrollPosition} />
          
          {/* Contacts */}
          {(mounted && (showAll || hasAnyPermission(['clients_read', 'leads_read', 'candidates_read', 'view_all_candidates', 'view_assigned_candidates']))) && (
            <NavItem icon={Contact} label="Contacts" href="/contacts" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}

          <Divider />

          {/* Reports */}
          {(mounted && (showAll || hasAnyPermission(['reports_read', 'reports_create', 'reports_update', 'reports_delete']))) && (
            <NavItem icon={BarChart3} label="Reports" href="/reports" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
          {/* Billing - show if Super Admin or has access_billing */}
          {(mounted && (showAll || hasPermission('access_billing'))) && (
            <NavItem icon={CreditCard} label="Billing" href="/billing" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}

          <div className="h-4" />

          {/* Team */}
          {(mounted && (showAll || hasAnyPermission(['add_team_member', 'assign_roles', 'edit_team_member', 'generate_credentials', 'manage_targets', 'manage_commission']))) && (
            <>
              <SectionLabel label="Team Management" collapsed={isCollapsed} />
              <NavItem icon={UserPlus} label="Team" href="/team" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
            </>
          )}

          {/* Settings - show if Super Admin or has manage_settings */}
          {(mounted && (showAll || hasPermission('manage_settings'))) && (
            <NavItem icon={Settings} label="Settings" href="/setting" collapsed={isCollapsed} onNavigate={persistScrollPosition} />
          )}
          
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/5">
          {/* Trial banner */}
          {!isCollapsed ? (
            <div className="mb-3 rounded-lg p-2.5 bg-emerald-400/8 border border-emerald-400/15">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Free Trial</span>
                <span className="text-[10px] text-emerald-400/70">30 days left</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[70%] rounded-full" />
              </div>
              <button className="w-full mt-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-semibold rounded transition-colors">
                Upgrade Plan
              </button>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Free Trial Active" />
            </div>
          )}

          {/* User row */}
          <div className="flex items-center gap-2.5">
            <UserDropdown 
              avatarUrl={profile.avatarUrl} 
              userName={profile.name} 
              userRole={profile.role} 
            />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white truncate">{profile.name}</p>
                <p className="text-[10px] text-[#4A6070] truncate">{profile.role}</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Main content area ───────────────────────────────────── */}
      <motion.main
        animate={{ marginLeft: SIDEBAR_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen bg-slate-50 pt-14 overflow-y-auto"
      >
        {children || (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome back, {profile.name}!</p>
            </div>
          </div>
        )}
      </motion.main>

      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </>
  );
}

export default Sidenav;
