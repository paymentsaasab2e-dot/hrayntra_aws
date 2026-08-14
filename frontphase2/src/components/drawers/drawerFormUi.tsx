'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type DrawerFormAccent = 'blue' | 'violet' | 'emerald' | 'amber' | 'sky' | 'rose' | 'indigo';

export const DRAWER_FORM_SCROLL_BG = 'bg-gradient-to-b from-slate-50 via-[#f8fafc] to-blue-50/30';

export const DRAWER_FORM_CONTENT_CLASS =
  `flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG}`;

export const DRAWER_FORM_PANEL_CLASS =
  'pointer-events-auto relative flex h-[min(92vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5';

export const DRAWER_FORM_HEADER_CLASS =
  'flex shrink-0 items-start justify-between gap-3 border-b border-blue-100/70 bg-gradient-to-r from-blue-50/95 via-indigo-50/50 to-white px-6 py-5';

export const DRAWER_FORM_FOOTER_CLASS =
  'flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4';

export const DRAWER_FORM_ACCENT_STYLES: Record<
  DrawerFormAccent,
  { card: string; headerBg: string; icon: string; bar: string }
> = {
  blue: {
    card: 'border-blue-100/90 bg-white shadow-sm shadow-blue-500/5 ring-1 ring-blue-50/80',
    headerBg: 'bg-gradient-to-r from-blue-50/90 via-white to-white',
    icon: 'bg-blue-100 text-blue-600 ring-1 ring-blue-200/80',
    bar: 'bg-gradient-to-b from-blue-400 to-blue-600',
  },
  violet: {
    card: 'border-violet-100/90 bg-white shadow-sm shadow-violet-500/5 ring-1 ring-violet-50/80',
    headerBg: 'bg-gradient-to-r from-violet-50/90 via-white to-white',
    icon: 'bg-violet-100 text-violet-600 ring-1 ring-violet-200/80',
    bar: 'bg-gradient-to-b from-violet-400 to-violet-600',
  },
  emerald: {
    card: 'border-emerald-100/90 bg-white shadow-sm shadow-emerald-500/5 ring-1 ring-emerald-50/80',
    headerBg: 'bg-gradient-to-r from-emerald-50/90 via-white to-white',
    icon: 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200/80',
    bar: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
  },
  amber: {
    card: 'border-amber-100/90 bg-white shadow-sm shadow-amber-500/5 ring-1 ring-amber-50/80',
    headerBg: 'bg-gradient-to-r from-amber-50/90 via-white to-white',
    icon: 'bg-amber-100 text-amber-600 ring-1 ring-amber-200/80',
    bar: 'bg-gradient-to-b from-amber-400 to-amber-600',
  },
  sky: {
    card: 'border-sky-100/90 bg-white shadow-sm shadow-sky-500/5 ring-1 ring-sky-50/80',
    headerBg: 'bg-gradient-to-r from-sky-50/90 via-white to-white',
    icon: 'bg-sky-100 text-sky-600 ring-1 ring-sky-200/80',
    bar: 'bg-gradient-to-b from-sky-400 to-sky-600',
  },
  rose: {
    card: 'border-rose-100/90 bg-white shadow-sm shadow-rose-500/5 ring-1 ring-rose-50/80',
    headerBg: 'bg-gradient-to-r from-rose-50/90 via-white to-white',
    icon: 'bg-rose-100 text-rose-600 ring-1 ring-rose-200/80',
    bar: 'bg-gradient-to-b from-rose-400 to-rose-600',
  },
  indigo: {
    card: 'border-indigo-100/90 bg-white shadow-sm shadow-indigo-500/5 ring-1 ring-indigo-50/80',
    headerBg: 'bg-gradient-to-r from-indigo-50/90 via-white to-white',
    icon: 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200/80',
    bar: 'bg-gradient-to-b from-indigo-400 to-indigo-600',
  },
};

export const DRAWER_FORM_INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const DRAWER_FORM_INPUT_WITH_ICON =
  'w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const DRAWER_FORM_SELECT = `${DRAWER_FORM_INPUT} appearance-none bg-white`;

/** @deprecated Use DRAWER_FORM_INPUT */
export const ADD_LEAD_INPUT = DRAWER_FORM_INPUT;
/** @deprecated Use DRAWER_FORM_INPUT_WITH_ICON */
export const ADD_LEAD_INPUT_WITH_ICON = DRAWER_FORM_INPUT_WITH_ICON;

export function DrawerSectionCard({
  title,
  subtitle,
  icon: Icon,
  accent = 'blue',
  children,
  collapsible = false,
  open = true,
  onOpenChange,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: DrawerFormAccent;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: () => void;
}) {
  const styles = DRAWER_FORM_ACCENT_STYLES[accent];
  const isOpen = collapsible ? open : true;

  const headerContent = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );

  return (
    <section className={`relative overflow-visible rounded-2xl border ${styles.card}`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${styles.bar}`} />
      <div className={`${isOpen ? 'border-b border-slate-100/80' : ''} ${styles.headerBg}`}>
        {collapsible ? (
          <button
            type="button"
            onClick={onOpenChange}
            aria-expanded={isOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 pl-7 text-left transition-colors hover:bg-white/70"
          >
            {headerContent}
            <ChevronDown
              size={18}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
              aria-hidden
            />
          </button>
        ) : (
          <div className="flex items-center gap-3 px-5 py-4 pl-7">{headerContent}</div>
        )}
      </div>
      {isOpen ? <div className="space-y-4 px-5 py-4 pl-6">{children}</div> : null}
    </section>
  );
}

/** @deprecated Use DrawerSectionCard */
export const AddLeadSectionCard = DrawerSectionCard;

export function DrawerFieldLabel({
  label,
  icon: Icon,
  iconClassName = 'text-slate-400',
  required,
}: {
  label: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  iconClassName?: string;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      {Icon ? <Icon size={12} className={iconClassName} /> : null}
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
    </label>
  );
}

/** @deprecated Use DrawerFieldLabel */
export const AddLeadFieldLabel = DrawerFieldLabel;

export function DrawerIconInput({
  icon: Icon,
  iconClassName,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <div className="relative">
      <Icon
        size={16}
        className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${iconClassName}`}
      />
      <input className={className || DRAWER_FORM_INPUT_WITH_ICON} {...props} />
    </div>
  );
}

/** @deprecated Use DrawerIconInput */
export const AddLeadIconInput = DrawerIconInput;

const DROPDOWN_MENU_GAP = 6;
const DROPDOWN_MENU_MAX_HEIGHT = 256;

type DrawerDropdownMenuPosition = {
  left: number;
  width: number;
  placement: 'top' | 'bottom';
  top?: number;
  bottom?: number;
};

export function useDrawerPortalDropdownPosition(open: boolean, preferUpward: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<DrawerDropdownMenuPosition | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward =
      preferUpward ||
      (spaceBelow < DROPDOWN_MENU_MAX_HEIGHT + DROPDOWN_MENU_GAP && spaceAbove > spaceBelow);

    if (openUpward) {
      setMenuPosition({
        left: rect.left,
        width: rect.width,
        placement: 'top',
        bottom: window.innerHeight - rect.top + DROPDOWN_MENU_GAP,
      });
      return;
    }

    setMenuPosition({
      left: rect.left,
      width: rect.width,
      placement: 'bottom',
      top: rect.bottom + DROPDOWN_MENU_GAP,
    });
  }, [preferUpward]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, onClose]);

  return { triggerRef, menuRef, menuPosition };
}

/** @deprecated Use useDrawerPortalDropdownPosition */
export const useLeadPortalDropdownPosition = useDrawerPortalDropdownPosition;

export function DrawerSelectDropdown({
  value,
  options,
  onChange,
  preferUpward = false,
  triggerClassName,
  leadingIcon: LeadingIcon,
  leadingIconClassName,
  placeholder,
  error,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  preferUpward?: boolean;
  triggerClassName?: string;
  leadingIcon?: LucideIcon;
  leadingIconClassName?: string;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { triggerRef, menuRef, menuPosition } = useDrawerPortalDropdownPosition(open, preferUpward, closeMenu);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? (value || placeholder || 'Select…');

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1200] max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              left: menuPosition.left,
              width: menuPosition.width,
              ...(menuPosition.placement === 'top'
                ? { bottom: menuPosition.bottom }
                : { top: menuPosition.top }),
            }}
          >
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {LeadingIcon ? <LeadingIcon size={16} className={leadingIconClassName} /> : null}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          triggerClassName ||
          `flex w-full items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-left text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
            error ? 'border-red-300' : 'border-slate-200'
          }`
        }
      >
        <span className={`flex items-center gap-2 ${!value && placeholder ? 'text-slate-400' : ''}`}>
          {LeadingIcon ? <LeadingIcon size={16} className={leadingIconClassName} /> : null}
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform ${open && menuPosition?.placement === 'top' ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  );
}

/** @deprecated Use DrawerSelectDropdown */
export const AddLeadSelectDropdown = DrawerSelectDropdown;
