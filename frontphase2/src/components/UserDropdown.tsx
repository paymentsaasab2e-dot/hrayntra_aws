'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { ImageWithFallback } from './ImageWithFallback';
import { apiLogout } from '../lib/api';

import { useUser } from '../hooks/useUser';

interface UserDropdownProps {
  avatarUrl?: string;
}

type MenuItem = {
  icon: typeof User;
  label: string;
  action: 'profile' | 'switch' | 'settings' | 'logout';
  color?: string;
};

export function UserDropdown({ avatarUrl: propAvatarUrl }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useUser();

  const userName = user?.name || 'User';
  const userRole = user?.role || '';
  const avatarUrl = user?.avatar || propAvatarUrl || '';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Profile + Settings are accessible to every signed-in user. Confidential
  // tabs inside `/setting` are gated by permission within the settings UI.
  const menuItems: MenuItem[] = [
    { icon: User, label: 'My Profile', action: 'profile' },
    { icon: Repeat, label: 'Switch Workspace', action: 'switch' },
    { icon: Settings, label: 'Settings', action: 'settings' },
    { icon: LogOut, label: 'Logout', action: 'logout', color: 'text-red-500 hover:bg-red-50' },
  ];

  async function handleMenuClick(item: MenuItem) {
    if (item.action === 'profile') {
      setIsOpen(false);
      router.push('/setting?section=profile');
      return;
    }
    if (item.action === 'settings') {
      setIsOpen(false);
      router.push('/setting');
      return;
    }
    if (item.action === 'switch') {
      setIsOpen(false);
      return;
    }
    if (item.action !== 'logout' || isLoggingOut) {
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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/50 transition-all">
          <ImageWithFallback
            src={avatarUrl}
            alt="User Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50"
          >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
              <p className="text-sm font-semibold text-slate-800">{userName}</p>
              <p className="text-xs text-slate-500">{userRole}</p>
            </div>
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMenuClick(item)}
                disabled={item.action === 'logout' && isLoggingOut}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  item.color || 'text-slate-600 hover:bg-slate-50'
                } ${item.action === 'logout' && isLoggingOut ? 'opacity-70 cursor-not-allowed' : ''}`}
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
}
