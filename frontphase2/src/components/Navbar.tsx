'use client';

import React from 'react';
import { Search, Calendar, Mail, Bell, Gift, HelpCircle, Box } from 'lucide-react';
import { QuickActionPopover } from './QuickActionPopover';
import { UserDropdown } from './UserDropdown';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

const Tooltip = ({ children, content }: TooltipProps) => {
  return (
    <div className="group relative flex items-center justify-center">
      {children}
      <div className="absolute top-full mt-2 hidden group-hover:block z-50">
        <div className="bg-slate-800 text-white text-[11px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
        </div>
      </div>
    </div>
  );
};

interface NavbarProps {
  avatarUrl: string;
}

export function Navbar({ avatarUrl }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-[#1A365D] border-b border-white/10 flex items-center justify-between px-6 z-50 shadow-md">
      {/* Left Section */}
      <div className="flex items-center gap-8">
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center group-hover:bg-blue-50 transition-colors">
            <Box className="w-5 h-5 text-[#1A365D]" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Saasab2E</span>
        </a>

        <div className="relative w-[420px]">
          <input
            type="text"
            placeholder="Search by Candidate, Job, Client or Email"
            className="w-full bg-white/10 border-none rounded-full py-2 pl-4 pr-10 text-sm text-white placeholder:text-white/60 focus:ring-2 focus:ring-teal-400 focus:bg-white/20 transition-all outline-none"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
        </div>
      </div>

      {/* Center Section */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Tooltip content="Quick Create">
          <QuickActionPopover />
        </Tooltip>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-5 border-r border-white/10 pr-6">
          <Tooltip content="Calendar">
            <button className="text-white/80 hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Inbox">
            <button className="relative text-white/80 hover:text-white transition-colors">
              <Mail className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-[#1A365D]">
                3
              </span>
            </button>
          </Tooltip>

          <Tooltip content="Notifications">
            <button className="relative text-white/80 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#1A365D]" />
            </button>
          </Tooltip>

          <Tooltip content="What's New">
            <button className="text-white/80 hover:text-white transition-colors">
              <Gift className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Help Center">
            <button className="text-white/80 hover:text-white transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <UserDropdown avatarUrl={avatarUrl} />
      </div>
    </nav>
  );
}
