'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { apiLogout } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { SpeedMetricBadge, useSpeedMeasure } from './common/SpeedMetricBadge';
import { TokenCoinIcon } from './coins/TokenCoinIcon';
import { PageErrorBoundary } from './PageErrorBoundary';
import { OrgWorkspaceSwitcher } from './org/OrgWorkspaceSwitcher';
import { SuperAdminWorkSwitcher } from './org/SuperAdminWorkSwitcher';
import { useTenantCoins } from './coins/TenantCoinsContext';
import {
  Search,
  Calendar,
  Bell,
  Gift,
  HelpCircle,
  Menu,
  X,
  ChevronLeft,
  User,
  LogOut,
  Repeat,
  Settings,
  Lock,
} from 'lucide-react';

const DEFAULT_PROFILE_ICON = '/account-avatar-profile-user-11-svgrepo-com.svg';
const BLOCKED_DEFAULT_AVATAR_PATTERNS = ['photo-1701463387028-3947648f1337', 'images.unsplash.com'];

export function resolveSidenavAvatar(src?: string | null) {
  const value = String(src || '').trim();
  if (!value) return DEFAULT_PROFILE_ICON;
  if (BLOCKED_DEFAULT_AVATAR_PATTERNS.some((pattern) => value.includes(pattern))) {
    return DEFAULT_PROFILE_ICON;
  }
  return value;
}

export const ImageWithFallback = ({
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

const MENU_WIDTH = 224;
const MENU_GAP = 12;

export const UserDropdown = ({
  avatarUrl,
  userName,
  userRole,
  companyName,
  placement = 'auto',
  align = 'auto',
}: {
  avatarUrl: string;
  userName: string;
  userRole: string;
  companyName?: string;
  placement?: 'auto' | 'top' | 'bottom';
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
        await apiLogout();
      } finally {
        window.location.assign('/login?switchWorkspace=1');
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
      window.location.assign('/login');
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
                {companyName ? (
                  <p className="text-xs font-medium text-slate-600 truncate">{companyName}</p>
                ) : null}
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

export const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => (
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

export type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  href: string;
};

export type AppShellHeaderProps = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  mounted: boolean;
  notificationCount: number;
  setNotificationDrawerOpen: (v: boolean) => void;
  profile: { name: string; role: string; companyName?: string; avatarUrl: string };
  navSearch: string;
  setNavSearch: (v: string) => void;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  searchLoading: boolean;
  searchResults: GlobalSearchResult[];
  runSearchSelection: (result?: GlobalSearchResult | null) => void;
};

export function AppShellHeader({
  mobileNavOpen,
  setMobileNavOpen,
  isCollapsed,
  setIsCollapsed,
  mounted,
  notificationCount,
  setNotificationDrawerOpen,
  profile,
  navSearch,
  setNavSearch,
  searchFocused,
  setSearchFocused,
  searchLoading,
  searchResults,
  runSearchSelection,
}: AppShellHeaderProps) {
  const { coins: tenantCoins, openPurchase } = useTenantCoins();
  const pathname = usePathname();
  const pageSpeedMs = useSpeedMeasure(true, pathname);

  return (
    <nav
      className="fixed left-0 right-0 z-50 flex h-14 min-w-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-4 lg:px-5 top-[var(--ph2-impersonation-banner-h,0px)]"
      style={{ backgroundColor: '#0b1220', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 md:transition-all md:duration-300">
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/5 text-slate-200 transition-colors hover:bg-white/15 hover:text-white md:hidden"
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="relative z-10 hidden h-8 w-8 shrink-0 place-items-center rounded-md bg-white/5 text-slate-200 transition-colors hover:bg-white/15 hover:text-white md:grid"
        >
          {isCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
        <div className={`min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
          <ImageWithFallback
            src="/hryantra-logo.png"
            alt="HRYANTRA"
            className="h-7 w-auto object-contain sm:h-8"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-3 lg:px-4">
        <div className="relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400 sm:left-3.5" />
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
              }
            }}
            placeholder="Search candidates, jobs, clients…"
            aria-label="Search candidates, jobs, clients, team, tasks"
            className="h-9 w-full min-w-0 rounded-full border border-white/15 bg-white py-0 pl-8 pr-3 text-[13px] leading-none text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-white/30 focus:ring-2 focus:ring-white/20 sm:pl-10 sm:pr-3.5"
          />
          {searchFocused && (searchLoading || (Array.isArray(searchResults) && searchResults.length > 0)) && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-[70] max-h-[min(60vh,320px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {searchLoading ? (
                <div className="px-4 py-3 text-sm text-slate-500">Searching...</div>
              ) : (
                <div className="max-h-[min(60vh,320px)] overflow-auto py-2">
                  {(Array.isArray(searchResults) ? searchResults : []).map((result) => (
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

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
        <SpeedMetricBadge timeMs={pageSpeedMs} label="Speed" variant="pill" className="hidden sm:inline-flex bg-slate-900/60 border-white/10 text-emerald-300" />
        <div className="hidden lg:block">
          {mounted ? (
            <PageErrorBoundary fallback={null}>
              <SuperAdminWorkSwitcher variant="header" />
            </PageErrorBoundary>
          ) : null}
        </div>
        <div className="hidden sm:block">
          {mounted ? (
            <PageErrorBoundary fallback={null}>
              <OrgWorkspaceSwitcher variant="header" />
            </PageErrorBoundary>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 border-r border-white/10 pr-1.5 sm:gap-3 sm:pr-3 lg:gap-4 lg:pr-4">
          <Tooltip content="Calendar">
            <Link href="/calendar" className="grid h-9 w-9 place-items-center text-amber-400/90 transition-colors hover:text-amber-300">
              <Calendar className="h-5 w-5" />
            </Link>
          </Tooltip>
          <Tooltip content={tenantCoins > 0 ? `${tenantCoins} AI coins — click to buy more` : 'No coins — click to purchase'}>
            <button
              type="button"
              onClick={() => openPurchase({ balance: tenantCoins })}
              className={`flex h-9 items-center gap-1 rounded-full px-1.5 transition hover:scale-[1.02] sm:gap-1.5 sm:px-2.5 ${
                tenantCoins > 0 ? 'bg-amber-500/15' : 'bg-rose-500/15'
              }`}
            >
              {tenantCoins > 0 ? (
                <TokenCoinIcon className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4 text-rose-400" />
              )}
              <span
                className={`text-xs font-bold tabular-nums ${
                  tenantCoins > 0 ? 'text-amber-300' : 'text-rose-300'
                }`}
              >
                {tenantCoins.toLocaleString()}
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Notifications">
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(true)}
              className="relative grid h-9 w-9 place-items-center text-rose-400/90 transition-colors hover:text-rose-300"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : null}
            </button>
          </Tooltip>
          <Tooltip content="What's New">
            <button type="button" className="hidden h-9 w-9 place-items-center text-violet-400/90 transition-colors hover:text-violet-300 sm:grid">
              <Gift className="h-5 w-5" />
            </button>
          </Tooltip>
          <Tooltip content="Help Center">
            <Link
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-9 w-9 place-items-center text-cyan-400/90 transition-colors hover:text-cyan-300 sm:grid"
              aria-label="Open Help Center"
            >
              <HelpCircle className="h-5 w-5" />
            </Link>
          </Tooltip>
        </div>

        <UserDropdown
          avatarUrl={profile.avatarUrl}
          userName={profile.name}
          userRole={profile.role}
          companyName={profile.companyName}
          placement="bottom"
          align="right"
        />
      </div>
    </nav>
  );
}
