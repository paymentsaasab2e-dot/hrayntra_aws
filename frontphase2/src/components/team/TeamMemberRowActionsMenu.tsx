'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Key, Lock, LogIn, Mail, MoreVertical, Trash2, Unlock, UserMinus, UserPlus } from 'lucide-react';
import type { TeamMember } from '../../types/team';

const MENU_WIDTH = 208;
const MENU_GAP = 8;

interface TeamMemberRowActionsMenuProps {
  member: TeamMember;
  open: boolean;
  canGenerateCredentials: boolean;
  canDeactivate: boolean;
  canOpenAccount?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenAccount?: (member: TeamMember) => void;
  onGenerateCredentials: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onLockToggle: (member: TeamMember) => void;
  onActivateDeactivate: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

function computeMenuPosition(trigger: HTMLElement, menuHeight: number) {
  const rect = trigger.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const height = menuHeight || 280;

  // Open above the ⋮ button by default so it clears rows below and the header.
  let top = rect.top - MENU_GAP - height;
  if (top < 8) {
    top = rect.bottom + MENU_GAP;
  }
  top = Math.max(8, Math.min(top, viewportH - 8));

  let left = rect.right - MENU_WIDTH;
  left = Math.max(8, Math.min(left, viewportW - MENU_WIDTH - 8));

  return { top, left };
}

export function TeamMemberRowActionsMenu({
  member,
  open,
  canGenerateCredentials,
  canDeactivate,
  canOpenAccount = false,
  onOpenChange,
  onOpenAccount,
  onGenerateCredentials,
  onResetPassword,
  onResendInvite,
  onLockToggle,
  onActivateDeactivate,
  onDelete,
}: TeamMemberRowActionsMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setMenuOpen = (next: boolean) => {
    onOpenChange?.(next);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const menuHeight = menuRef.current?.offsetHeight ?? 280;
      setPosition(computeMenuPosition(trigger, menuHeight));
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!canGenerateCredentials && !canDeactivate && !canOpenAccount) {
    return null;
  }

  const closeAnd = (fn: (member: TeamMember) => void) => () => {
    setMenuOpen(false);
    fn(member);
  };

  const menuContent = (
    <>
      {canOpenAccount && onOpenAccount ? (
        <>
          <button
            type="button"
            onClick={closeAnd(onOpenAccount)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <LogIn size={14} />
            Open account
          </button>
          {canGenerateCredentials || canDeactivate ? <div className="my-1 border-t border-slate-200" /> : null}
        </>
      ) : null}
      {canGenerateCredentials ? (
        <>
          <button
            type="button"
            onClick={closeAnd(onGenerateCredentials)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Key size={14} />
            Generate Credentials
          </button>
          <button
            type="button"
            onClick={closeAnd(onResetPassword)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Key size={14} />
            Reset Password
          </button>
          <button
            type="button"
            onClick={closeAnd(onResendInvite)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Mail size={14} />
            Resend Invite
          </button>
          <button
            type="button"
            onClick={closeAnd(onLockToggle)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {member.credential?.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
            {member.credential?.isLocked ? 'Unlock Account' : 'Lock Account'}
          </button>
        </>
      ) : null}
      {canDeactivate ? (
        <>
          {canGenerateCredentials ? <div className="my-1 border-t border-slate-200" /> : null}
          <button
            type="button"
            onClick={closeAnd(onActivateDeactivate)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {member.status === 'ACTIVE' ? <UserMinus size={14} /> : <UserPlus size={14} />}
            {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            onClick={closeAnd(onDelete)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete Member
          </button>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen(!open);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-white hover:text-slate-800 hover:shadow-sm"
        title="More options"
      >
        <MoreVertical size={16} strokeWidth={2.25} />
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              className="fixed z-[9999] max-h-[min(20rem,calc(100vh-16px))] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-slate-200/80"
              onClick={(event) => event.stopPropagation()}
            >
              {menuContent}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
