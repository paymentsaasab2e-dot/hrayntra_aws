'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '../hooks/usePermissions';
import { MODULE_ACCESS_MAP } from '../lib/rbac/moduleAccess';
import { useUser } from '../hooks/useUser';
import {
  apiGetUnifiedCalendar,
  apiLogout,
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
  getCachedOrgSubscriptionPlanName,
  getCachedOrgPlanUsage,
  getCachedOrgRecruitmentMode,
  ORG_RECRUITMENT_CACHE_EVENT,
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
  DollarSign,
  Trash2,
  History,
  MessageSquarePlus,
  ShieldCheck,
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

// ─── User Dropdown ────────────────────────────────────────────────────────────
// Portal-based dropdown so it escapes the sidebar's `overflow-hidden` clip when
// collapsed. Auto-flips above/below the trigger based on viewport space, so the
// same component works for the bottom-of-sidebar avatar AND the top-right
// navbar avatar.
const MENU_WIDTH = 224; // matches w-56
const MENU_GAP = 12;

const UserDropdown = ({
  avatarUrl,
  userName,
  userRole,
  placement = 'auto',
  align = 'auto',
}: {
  avatarUrl: string;
  userName: string;
  userRole: string;
  /** Preferred direction: 'top' opens above the trigger, 'bottom' opens below. 'auto' picks the side with more room. */
  placement?: 'auto' | 'top' | 'bottom';
  /** Horizontal alignment relative to the trigger: 'left' aligns the menu's left edge to the trigger, 'right' aligns the right edge. 'auto' clamps to the viewport. */
  align?: 'auto' | 'left' | 'right';
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    // Estimate menu height (header + 4 items + paddings ≈ 220–260). Using 260 as upper bound for placement decision.
    const estimatedMenuH = 260;

    let openBelow: boolean;
    if (placement === 'top') openBelow = false;
    else if (placement === 'bottom') openBelow = true;
    else openBelow = viewportH - rect.bottom > estimatedMenuH || rect.top < estimatedMenuH;

    const top = openBelow
      ? Math.min(rect.bottom + MENU_GAP, viewportH - estimatedMenuH - 8)
      : Math.max(rect.top - estimatedMenuH - MENU_GAP, 8);

    let left: number;
    if (align === 'right') left = rect.right - MENU_WIDTH;
    else if (align === 'left') left = rect.left;
    else left = rect.left;
    // Clamp horizontally to viewport with 8px padding.
    left = Math.max(8, Math.min(left, viewportW - MENU_WIDTH - 8));

    setMenuStyle({ top, left });
  }, [placement, align]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    computePosition();
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onScrollOrResize = () => computePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const menuItems = [
    { icon: User, label: 'My Profile', iconClass: 'text-violet-500' },
    { icon: Repeat, label: 'Switch Workspace', iconClass: 'text-cyan-500' },
    { icon: Settings, label: 'Settings', iconClass: 'text-blue-500' },
    { icon: LogOut, label: 'Logout', color: 'text-red-500 hover:bg-red-50', iconClass: 'text-red-500' },
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
    if (label === 'Switch Workspace') {
      if (isSwitching) return;
      setIsSwitching(true);
      setIsOpen(false);
      try {
        // apiLogout already clears the access/refresh tokens AND tenantDbName,
        // so dropping the user on /login lets them sign into a different workspace.
        await apiLogout();
      } finally {
        router.replace('/login?switchWorkspace=1');
        router.refresh();
        setIsSwitching(false);
      }
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

  const menu =
    isOpen && typeof window !== 'undefined' && menuStyle
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: MENU_WIDTH, zIndex: 1000 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-100 py-2"
              role="menu"
            >
              <div className="px-4 py-2 border-b border-slate-100 mb-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{userRole}</p>
              </div>
              {menuItems.map((item, i) => {
                const disabled =
                  (item.label === 'Logout' && isLoggingOut) ||
                  (item.label === 'Switch Workspace' && isSwitching);
                return (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    onClick={() => handleMenuClick(item.label)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                      item.color || 'text-slate-600 hover:bg-slate-50'
                    } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <item.icon className={`w-4 h-4 ${item.iconClass || ''}`} />
                    <span>
                      {item.label === 'Switch Workspace' && isSwitching ? 'Switching…' : item.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/50 transition-all">
          <ImageWithFallback src={avatarUrl} alt="User" className="w-full h-full object-cover" />
        </div>
      </button>
      {menu}
    </>
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

/**
 * Sidebar nav row tint — matches the reference HRMS sidebar:
 *   - idle: muted slate text + slate icon (no color)
 *   - active: a glass-bordered, slightly translucent icon container with the
 *     module's brand color showing inside.
 *
 * The wrapper applies `bg-white/5 border border-white/10` plus a tinted ring
 * for the glass effect; the icon itself takes the brand color.
 */
const NAV_ICON_ACCENTS: Record<
  string,
  { idle: string; activeWrap: string; activeIcon: string }
> = {
  sky: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-sky-400/30 backdrop-blur',
    activeIcon: 'text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.55)]',
  },
  rose: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-rose-400/30 backdrop-blur',
    activeIcon: 'text-rose-300 drop-shadow-[0_0_6px_rgba(251,113,133,0.55)]',
  },
  blue: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-blue-400/30 backdrop-blur',
    activeIcon: 'text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.55)]',
  },
  amber: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-amber-400/30 backdrop-blur',
    activeIcon: 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]',
  },
  violet: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-violet-400/30 backdrop-blur',
    activeIcon: 'text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.55)]',
  },
  cyan: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-cyan-400/30 backdrop-blur',
    activeIcon: 'text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.55)]',
  },
  emerald: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-emerald-400/30 backdrop-blur',
    activeIcon: 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]',
  },
  indigo: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-indigo-400/30 backdrop-blur',
    activeIcon: 'text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.55)]',
  },
  orange: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-orange-400/30 backdrop-blur',
    activeIcon: 'text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.55)]',
  },
  fuchsia: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-fuchsia-400/30 backdrop-blur',
    activeIcon: 'text-fuchsia-300 drop-shadow-[0_0_6px_rgba(232,121,249,0.55)]',
  },
  lime: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-lime-400/30 backdrop-blur',
    activeIcon: 'text-lime-300 drop-shadow-[0_0_6px_rgba(190,242,100,0.55)]',
  },
  teal: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-teal-400/30 backdrop-blur',
    activeIcon: 'text-teal-300 drop-shadow-[0_0_6px_rgba(45,212,191,0.55)]',
  },
  pink: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-pink-400/30 backdrop-blur',
    activeIcon: 'text-pink-300 drop-shadow-[0_0_6px_rgba(244,114,182,0.55)]',
  },
  slate: {
    idle: 'text-slate-400',
    activeWrap: 'bg-white/5 border border-white/15 ring-1 ring-slate-300/25 backdrop-blur',
    activeIcon: 'text-slate-100',
  },
};

// ─── Nav Item ─────────────────────────────────────────────────────────────────
interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href?: string;
  active?: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
  /** Colored icon treatment in the dark sidebar */
  accent?: keyof typeof NAV_ICON_ACCENTS;
}

const NavItem = ({ icon: Icon, label, href, active, collapsed, badge, onNavigate, accent = 'sky' }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = active || (href && pathname === href);
  const tone = NAV_ICON_ACCENTS[accent] || NAV_ICON_ACCENTS.sky;

  const content = (
    <div
      data-sidenav-nav-item="true"
      data-active={isActive ? 'true' : 'false'}
      className={`relative flex items-center h-11 rounded-xl mx-2.5 my-0.5 ${collapsed ? 'px-2 justify-center' : 'pl-2.5 pr-2.5'} cursor-pointer transition-all duration-150 group
        ${isActive
          ? 'bg-white/[0.08] text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-[#8899AA] border border-transparent hover:bg-white/[0.04] hover:text-white'
        }`}
    >
      {isActive && (
        <div className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
      )}

      <div
        className={`flex items-center justify-center shrink-0 rounded-lg transition-all duration-150 ${collapsed ? 'h-8 w-8' : 'mr-2.5 h-8 w-8'} ${
          isActive ? tone.activeWrap : 'border border-white/[0.05] bg-white/[0.02]'
        }`}
      >
        <Icon
          size={17}
          strokeWidth={isActive ? 2 : 1.6}
          className={isActive ? tone.activeIcon : `${tone.idle} group-hover:text-white`}
        />
      </div>

      {!collapsed && (
        <span className={`text-[13px] whitespace-nowrap overflow-hidden ${isActive ? 'font-semibold text-white' : 'font-medium'}`}>
          {label}
        </span>
      )}

      {!collapsed && badge ? (
        <span className="ml-auto bg-orange-500/15 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-400/25">
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
  const [billingNavEnabled, setBillingNavEnabled] = useState(true);
  const [orgPlanName, setOrgPlanName] = useState<string>('');
  const [orgPlanUsage, setOrgPlanUsage] = useState<ReturnType<typeof getCachedOrgPlanUsage>>(null);
  const [orgSubscriptionPlan, setOrgSubscriptionPlan] = useState(
    () => (typeof window !== 'undefined' ? getCachedOrgSubscriptionPlan() : null)
  );
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
    };
    sync();
    window.addEventListener(ORG_RECRUITMENT_CACHE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ORG_RECRUITMENT_CACHE_EVENT, sync);
      window.removeEventListener('storage', sync);
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
  const profile = {
    name: user?.name || userProfile?.name || 'User',
    role: designation || formatRoleLabel(rawRole),
    avatarUrl: resolveSidenavAvatar(user?.avatar || userProfile?.avatarUrl || avatarUrl),
  };

  const SIDEBAR_W = isCollapsed ? 60 : 220;

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
            safe(apiGetJobs({ search: query, page: 1, limit: 3 })),
            safe(apiGetContacts({ search: query, page: 1, limit: 3 })),
            safe(apiGetUsers({ search: query, isActive: true, limit: 3 })),
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
            .filter((t: any) => {
              const haystack = [t.title, t.description, t.linkedEntityType].filter(Boolean).join(' ').toLowerCase();
              return haystack.includes(lower);
            })
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
              const haystack = [candidateName, p.candidate?.email, p.job?.title, p.client?.companyName, p.status]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return haystack.includes(lower);
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
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 h-14 flex items-center px-5 z-50"
        style={{ backgroundColor: '#0b1220', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo area — keep the collapse/expand button in its own slot so it
            stays clickable when the sidebar is collapsed (the logo no longer
            shares horizontal space with it). */}
        <div
          className="flex items-center gap-2 shrink-0 transition-all duration-300"
          style={{ width: SIDEBAR_W - 20 }}
        >
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/5 text-slate-200 transition-colors hover:bg-white/15 hover:text-white"
          >
            {isCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <ImageWithFallback
                src="/saasa-logo.png"
                alt="SAASA Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          )}
        </div>

        <div className="flex flex-1 justify-center px-4">
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400" />
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
              placeholder="Search candidates, jobs, clients, team, tasks…"
              className="h-9 w-full rounded-full border border-white/15 bg-white py-0 pl-10 pr-3.5 text-[13px] leading-none text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-white/30 focus:ring-2 focus:ring-white/20"
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
              <Link href="/calendar" className="text-amber-400/90 hover:text-amber-300 transition-colors">
                <Calendar className="w-5 h-5" />
              </Link>
            </Tooltip>
            <Tooltip content="Notifications">
              <button
                type="button"
                onClick={() => setNotificationDrawerOpen(true)}
                className="relative text-rose-400/90 hover:text-rose-300 transition-colors"
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
              <button className="text-violet-400/90 hover:text-violet-300 transition-colors">
                <Gift className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip content="Help Center">
              <Link
                href="/help-center"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400/90 hover:text-cyan-300 transition-colors"
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
            placement="bottom"
            align="right"
          />
        </div>
      </nav>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <motion.aside
        ref={asideRef}
        initial={false}
        animate={{ width: SIDEBAR_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="ph2-sidenav-aside fixed left-0 top-14 flex flex-col z-40 overflow-hidden"
        style={{
          height: 'calc(100vh - 56px)',
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
          {(mounted && (showAll || hasAnyPermission(['view_dashboard']) || isSuperAdmin())) && (
            <NavItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="sky" />
          )}
          
          {/* Leads — agency tenants only */}
          {(mounted && isAgencyMode && (showAll || hasAnyPermission(['leads_read', 'leads_create', 'leads_update', 'leads_delete']))) && (
            <NavItem icon={Target} label="Leads" href="/leads" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="rose" />
          )}
          
          {/* Clients — agency tenants only */}
          {(mounted && isAgencyMode && (showAll || hasAnyPermission(['clients_read', 'clients_create', 'clients_update', 'clients_delete']))) && (
            <NavItem icon={Users} label="Clients" href="/client" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="blue" />
          )}
          
          {/* Jobs */}
          {(mounted && (showAll || hasAnyPermission(['jobs_read', 'jobs_create', 'jobs_update', 'jobs_delete', 'view_jobs', 'create_job', 'edit_job', 'delete_job', 'assign_job']))) && (
            <NavItem icon={Briefcase} label="Jobs" href="/job" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="amber" />
          )}
          
          {/* Candidates */}
          {(mounted && (showAll || hasAnyPermission(['candidates_read', 'candidates_create', 'candidates_update', 'candidates_delete', 'view_assigned_candidates', 'view_all_candidates', 'add_candidate', 'edit_candidate', 'delete_candidate']))) && (
            <NavItem icon={UserRound} label="Candidates" href="/candidate" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="violet" />
          )}

          {/* Interviews */}
          {(mounted && (showAll || hasAnyPermission(['interviews_read', 'interviews_create', 'interviews_update', 'interviews_delete']))) && (
            <NavItem icon={Calendar} label="Interviews" href="/interviews" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="cyan" />
          )}

          {/* Placements */}
          {(mounted && (showAll || hasAnyPermission(['placements_read', 'placements_create', 'placements_update', 'placements_delete']))) && (
            <NavItem icon={Award} label="Placements" href="/placement" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="emerald" />
          )}
          
          {/* Pipeline */}
          {(mounted && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Pipeline))) && (
            <>
              <SectionLabel label="Recruitment Hub" collapsed={isCollapsed} />
              <NavItem icon={GitBranch} label="Pipeline" href="/pipeline" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="indigo" />
            </>
          )}
          
          {/* Matches */}
          {(mounted && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Matches))) && (
            <NavItem icon={Zap} label="Matches" href="/matches" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="orange" />
          )}

          <Divider />

          {(mounted && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Tasks))) && (
            <NavItem icon={CheckSquare} label="Tasks & Activities" href="/Task&Activites" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="lime" />
          )}

          {(mounted && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Inbox))) && (
            <NavItem icon={Mail} label="Inbox" href="/inbox" collapsed={isCollapsed} badge={3} onNavigate={persistScrollPosition} accent="fuchsia" />
          )}

          {(mounted && (showAll || hasAnyPermission(MODULE_ACCESS_MAP.Contacts))) && (
            <NavItem icon={Contact} label="Contacts" href="/contacts" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="teal" />
          )}

          <Divider />

          {/* Reports */}
          {(mounted && (showAll || hasAnyPermission(['reports_read', 'reports_create', 'reports_update', 'reports_delete']))) && (
            <NavItem icon={BarChart3} label="Reports" href="/reports" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="pink" />
          )}
          
          {/* Billing - show if Super Admin or has access_billing */}
          {(mounted && billingNavEnabled && (showAll || hasPermission('access_billing'))) && (
            <NavItem icon={CreditCard} label="Billing" href="/billing" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="amber" />
          )}

          {/* Recycle Bin — soft-deleted leads / clients / candidates / jobs land here.
              Visible to anyone with delete permission on at least one of those modules so the
              menu surfaces alongside the relevant deletion actions. */}
          {(mounted && (showAll || hasAnyPermission([
            'leads_delete',
            'clients_delete',
            'candidates_delete',
            'delete_candidate',
            'jobs_delete',
            'delete_job',
          ]))) && (
            <NavItem icon={Trash2} label="Recycle Bin" href="/recycle-bin" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="slate" />
          )}

          {mounted ? (
            <NavItem icon={History} label="Activity log" href="/activity-feed" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="violet" />
          ) : null}

          <div className="h-4" />

          {/* Team */}
          {mounted &&
            (showAll ||
              hasAnyPermission(MODULE_ACCESS_MAP.Team) ||
              hasAnyPermission(MODULE_ACCESS_MAP.Request)) && (
            <>
              <SectionLabel label="Team Management" collapsed={isCollapsed} />
              {(showAll || hasAnyPermission(MODULE_ACCESS_MAP.Team)) && (
                <NavItem icon={UserPlus} label="Team" href="/team" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="blue" />
              )}
              {(showAll || hasAnyPermission(MODULE_ACCESS_MAP.Request)) && (
                <>
                  <NavItem icon={MessageSquarePlus} label="Request" href="/request" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="indigo" />
                  <NavItem icon={ShieldCheck} label="Approvals" href="/request/approval" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="emerald" />
                </>
              )}
            </>
          )}

          {/* Settings — visible to every signed-in user. Profile + basic
              preferences are always available; confidential subsections inside
              `/setting` are gated by permission. */}
          {mounted && (
            <NavItem icon={Settings} label="Settings" href="/setting" collapsed={isCollapsed} onNavigate={persistScrollPosition} accent="slate" />
          )}
          
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/5">
          {/* Plan / Trial banner — once a plan is assigned (via HQ/settings) the
              "Free Trial" banner is replaced with the active plan name. */}
          {!isCollapsed ? (
            orgSubscriptionPlan?.isTrial ? (
              <div className="mb-3 rounded-lg p-2.5 bg-emerald-400/8 border border-emerald-400/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {isTrialExpired(orgSubscriptionPlan) ? 'Trial ended' : '5-day trial'}
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
                  <span className="text-[10px] text-emerald-400/70">30 days left</span>
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
              placement="top"
              align="left"
            />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white truncate">{profile.name}</p>
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
        className="ph2-main-surface min-h-screen pt-14 overflow-y-auto"
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
