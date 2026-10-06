'use client';

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { NAV_ICON_ACCENTS } from '../../lib/navConfig';

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
  /** Renders the row indented as a child of a collapsible group */
  nested?: boolean;
}

export const NavItem = ({ icon: Icon, label, href, active, collapsed, badge, onNavigate, accent = 'sky', nested = false }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = active || (href && pathname === href);
  const tone = NAV_ICON_ACCENTS[accent] || NAV_ICON_ACCENTS.sky;

  const content = (
    <div
      data-sidenav-nav-item="true"
      data-active={isActive ? 'true' : 'false'}
      className={`relative flex items-center ${nested ? 'h-10' : 'h-11'} rounded-xl ${nested ? (collapsed ? 'mx-2.5' : 'ml-6 mr-2.5') : 'mx-2.5'} my-0.5 ${collapsed ? 'px-2 justify-center' : 'pl-2.5 pr-2.5'} cursor-pointer transition-all duration-150 group
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
          isActive ? tone.activeWrap : `${tone.activeWrap} opacity-70`
        }`}
      >
        <Icon
          size={17}
          strokeWidth={isActive ? 2 : 1.6}
          className={isActive ? tone.activeIcon : tone.idle}
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
// ─── Collapsible Nav Group ────────────────────────────────────────────────────
interface NavFlyoutItemConfig {
  icon: React.ElementType;
  label: string;
  href: string;
  accent?: keyof typeof NAV_ICON_ACCENTS;
}

interface NavGroupFlyoutProps {
  icon: React.ElementType;
  /** Optional PNG/SVG from `/public` — used instead of the Lucide icon when set. */
  imageSrc?: string;
  label: string;
  collapsed: boolean;
  accent?: keyof typeof NAV_ICON_ACCENTS;
  active?: boolean;
  items: NavFlyoutItemConfig[];
  onNavigate?: () => void;
  /** Mobile overlay: expand children in the drawer instead of a side flyout. */
  expandInline?: boolean;
}

const FLYOUT_PANEL_WIDTH = 188;
const FLYOUT_GAP = 12;

export const NavGroupFlyout = ({
  icon: Icon,
  imageSrc,
  label,
  collapsed,
  accent = 'sky',
  active = false,
  items,
  onNavigate,
  expandInline = false,
}: NavGroupFlyoutProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tone = NAV_ICON_ACCENTS[accent] || NAV_ICON_ACCENTS.sky;

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const estimatedHeight = Math.max(items.length * 48 + 16, 100);
    const viewportW = window.innerWidth;
    const top = Math.max(8, Math.min(rect.top, viewportH - estimatedHeight - 8));
    const left = Math.max(8, Math.min(rect.right + FLYOUT_GAP, viewportW - FLYOUT_PANEL_WIDTH - 8));
    setPanelStyle({ top, left });
  }, [items.length]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openFlyout = () => {
    if (!items.length) return;
    clearCloseTimer();
    computePosition();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
  }, [open, computePosition, collapsed]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => computePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, computePosition]);

  useEffect(() => () => clearCloseTimer(), []);

  const flyoutPanel =
    open && typeof window !== 'undefined' && panelStyle && items.length
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: panelStyle.top,
              left: panelStyle.left,
              width: FLYOUT_PANEL_WIDTH,
              zIndex: 1000,
            }}
            className="relative rounded-2xl border border-white/[0.08] bg-[#0d1a2d]/95 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl ring-1 ring-white/[0.04]"
            onMouseEnter={openFlyout}
            onMouseLeave={scheduleClose}
          >
            {/* Arrow pointing to sidebar */}
            <div
              className="pointer-events-none absolute -left-1.5 top-4 h-3 w-3 rotate-45 border-b border-l border-white/[0.08] bg-[#0d1a2d]/95"
              aria-hidden
            />
            <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                const ItemIcon = item.icon;
                const itemTone = NAV_ICON_ACCENTS[item.accent || accent] || tone;
                const [itemPath, itemQuery] = item.href.split('?');
                const pathActive =
                  pathname === itemPath || (pathname || '').startsWith(`${itemPath}/`);
                const wantedParams = new URLSearchParams(itemQuery || '');
                const currentParams = searchParams;
                const wantedMailbox = wantedParams.get('mailbox');
                const wantedScope = wantedParams.get('scope');
                const currentMailbox = currentParams.get('mailbox');
                const currentScope = currentParams.get('scope');
                const isActive = wantedMailbox
                  ? pathActive && (currentMailbox || 'gmail') === wantedMailbox
                  : wantedScope
                    ? pathActive && currentScope === wantedScope
                    : pathActive &&
                      (itemPath === '/client' ? currentScope !== 'recruitment' : true);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      onNavigate?.();
                      setOpen(false);
                    }}
                    className={`group/item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-150 ${
                      isActive
                        ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-[#94a3b8] hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                    )}
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
                        isActive
                          ? itemTone.activeWrap
                          : `${itemTone.activeWrap} opacity-70`
                      }`}
                    >
                      <ItemIcon
                        size={16}
                        strokeWidth={isActive ? 2 : 1.75}
                        className={
                          isActive
                            ? itemTone.activeIcon
                            : itemTone.idle
                        }
                      />
                    </span>
                    <span className={isActive ? 'font-semibold tracking-tight' : 'font-medium'}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={expandInline ? undefined : openFlyout}
        onMouseLeave={expandInline ? undefined : scheduleClose}
        onClick={() => {
          if (expandInline) {
            setOpen((prev) => !prev);
            return;
          }
          if (open) {
            setOpen(false);
          } else {
            openFlyout();
          }
        }}
        className="relative"
      >
        <div
          className={`relative mx-2.5 my-0.5 flex h-11 cursor-pointer items-center rounded-xl transition-all duration-150 group ${
            collapsed ? 'justify-center px-2' : 'pl-2.5 pr-2.5'
          } ${
            active || open
              ? 'border border-white/20 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
              : 'border border-transparent text-[#8899AA] hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          {(active || open) && (
            <div className="absolute -left-[3px] top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
          )}

          <div
            className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
              collapsed ? 'h-8 w-8' : 'mr-2.5 h-8 w-8'
            } ${
              active || open ? tone.activeWrap : `${tone.activeWrap} opacity-70`
            }`}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt=""
                aria-hidden
                className="h-[18px] w-[18px] object-contain"
              />
            ) : (
              <Icon
                size={17}
                strokeWidth={active || open ? 2 : 1.6}
                className={active || open ? tone.activeIcon : tone.idle}
              />
            )}
          </div>

          {!collapsed && (
            <span className={`overflow-hidden whitespace-nowrap text-[13px] ${active || open ? 'font-semibold text-white' : 'font-medium'}`}>
              {label}
            </span>
          )}

          {collapsed && !open && (
            <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-white/10 bg-[#0A1929] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0A1929]" />
            </div>
          )}
        </div>
      </div>
      {expandInline && open
        ? items.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              collapsed={false}
              onNavigate={onNavigate}
              accent={item.accent || accent}
              nested
            />
          ))
        : flyoutPanel}
    </>
  );
};
interface NavGroupProps {
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  accent?: keyof typeof NAV_ICON_ACCENTS;
  /** Opens the group automatically when one of its routes is active */
  forceOpen?: boolean;
  children: React.ReactNode;
}

export const NavGroup = ({ icon: Icon, label, collapsed, accent = 'sky', forceOpen = false, children }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const tone = NAV_ICON_ACCENTS[accent] || NAV_ICON_ACCENTS.sky;

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="block w-full text-left focus:outline-none"
      >
        <div
          className={`relative flex items-center h-11 rounded-xl mx-2.5 my-0.5 ${collapsed ? 'px-2 justify-center' : 'pl-2.5 pr-2.5'} cursor-pointer transition-all duration-150 group
            ${isOpen
              ? 'bg-white/[0.05] text-white border border-white/10'
              : 'text-[#8899AA] border border-transparent hover:bg-white/[0.04] hover:text-white'
            }`}
        >
          <div
            className={`flex items-center justify-center shrink-0 rounded-lg transition-all duration-150 ${collapsed ? 'h-8 w-8' : 'mr-2.5 h-8 w-8'} ${
              isOpen ? tone.activeWrap : `${tone.activeWrap} opacity-70`
            }`}
          >
            <Icon
              size={17}
              strokeWidth={isOpen ? 2 : 1.6}
              className={isOpen ? tone.activeIcon : tone.idle}
            />
          </div>

          {!collapsed && (
            <>
              <span className={`text-[13px] whitespace-nowrap overflow-hidden ${isOpen ? 'font-semibold text-white' : 'font-medium'}`}>
                {label}
              </span>
              <ChevronDown
                size={14}
                className={`ml-auto shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-0 text-white' : '-rotate-90 text-[#4A6070]'}`}
              />
            </>
          )}

          {collapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0A1929] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 whitespace-nowrap shadow-xl border border-white/10">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0A1929]" />
            </div>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

