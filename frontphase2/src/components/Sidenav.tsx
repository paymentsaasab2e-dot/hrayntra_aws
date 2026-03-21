'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '../hooks/usePermissions';
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
  ShieldCheck,
  ChevronLeft,
  Menu,
  FileUp,
  Building2,
  CalendarPlus,
  Plus,
  User,
  LogOut,
  Repeat,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  if (error || !src) {
    return (
      <div className={`${className} bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center`}>
        <User className="w-4 h-4 text-white" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
};

// ─── Quick Action Popover ─────────────────────────────────────────────────────
const actions = [
  { icon: FileUp,      label: 'Import Resume',      color: 'bg-blue-50 text-blue-600' },
  { icon: UserPlus,    label: 'Add Candidate',       color: 'bg-green-50 text-green-600' },
  { icon: Briefcase,   label: 'Add Job',             color: 'bg-purple-50 text-purple-600' },
  { icon: Building2,   label: 'Add Client',          color: 'bg-orange-50 text-orange-600' },
  { icon: CalendarPlus,label: 'Schedule Interview',  color: 'bg-pink-50 text-pink-600' },
  { icon: CheckSquare, label: 'Add Task / Activity', color: 'bg-indigo-50 text-indigo-600' },
  { icon: Zap,         label: 'Add Lead',            color: 'bg-yellow-50 text-yellow-600' },
];

const QuickActionPopover = () => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
          isOpen ? 'bg-teal-400 rotate-45' : 'bg-teal-500 hover:bg-teal-400'
        }`}
        title="Quick Create"
      >
        <Plus className="w-5 h-5 text-white" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 p-3 z-50"
          >
            <div className="grid grid-cols-3 gap-1.5">
              {actions.map((action, i) => (
                <button
                  key={i}
                  className="flex flex-col items-center justify-center p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className={`w-9 h-9 ${action.color} rounded-lg flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 leading-tight text-center">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── User Dropdown ────────────────────────────────────────────────────────────
const UserDropdown = ({ avatarUrl }: { avatarUrl: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-52 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50"
          >
            <div className="px-4 py-2 border-b border-slate-100 mb-1">
              <p className="text-sm font-semibold text-slate-800">John Doe</p>
              <p className="text-xs text-slate-500">Recruiter • SAASA B2E</p>
            </div>
            {menuItems.map((item, i) => (
              <button
                key={i}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  item.color || 'text-slate-600 hover:bg-slate-50'
                }`}
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
}

const NavItem = ({ icon: Icon, label, href, active, collapsed, badge }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = active || (href && pathname === href);
  
  const content = (
    <div
      className={`relative flex items-center h-9 rounded-md mx-2 my-0.5 px-2.5 cursor-pointer transition-all duration-150 group
        ${isActive
          ? 'bg-white/15 text-white'
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
    return <Link href={href}>{content}</Link>;
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

// ─── Main Sidenav ─────────────────────────────────────────────────────────────
interface SidenavProps {
  avatarUrl?: string;
  userProfile?: { name: string; role: string; avatarUrl: string };
  children?: React.ReactNode;
}

export function Sidenav({ avatarUrl = '', userProfile, children }: SidenavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { hasPermission, hasAnyPermission, isAdmin, isSuperAdmin } = usePermissions();
  
  // Ensure client-side only rendering to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Super Admin sees everything - bypass permission checks
  const showAll = mounted && isSuperAdmin();

  const profile = {
    name: userProfile?.name || 'Ulli Thumke',
    role: userProfile?.role || 'UI Designer',
    avatarUrl: userProfile?.avatarUrl || avatarUrl,
  };

  const SIDEBAR_W = isCollapsed ? 64 : 240;

  return (
    <>
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-50"
        style={{ backgroundColor: '#0F2A44', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo area — same width as sidebar so search starts after */}
        <div
          className="flex items-center gap-2 shrink-0 transition-all duration-300"
          style={{ width: SIDEBAR_W - 20 }}
        >
          <ImageWithFallback 
            src="/SAASA_Logo-removebg-preview 1.png" 
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

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 z-10" />
            <input
              type="text"
              placeholder="Search (e.g. 'Daily Tasks', 'UI Design')"
              className="w-full text-[12px] bg-white/10 backdrop-blur-md border border-white/20 rounded-full py-1.5 pl-8 pr-4 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 focus:border-white/30 transition-all shadow-lg shadow-black/10"
            />
          </div>
        </div>

        {/* Centre: Quick Create */}
        <div className="ml-[400px]">
          <QuickActionPopover />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 pr-4 border-r border-white/10">
            <Tooltip content="Calendar">
              <button className="text-white/60 hover:text-white transition-colors">
                <Calendar className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip content="Inbox">
              <button className="relative text-white/60 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">3</span>
              </button>
            </Tooltip>
            <Tooltip content="Notifications">
              <button className="relative text-white/60 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
            </Tooltip>
            <Tooltip content="What's New">
              <button className="text-white/60 hover:text-white transition-colors">
                <Gift className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip content="Help Center">
              <button className="text-white/60 hover:text-white transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          <UserDropdown avatarUrl={avatarUrl} />
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={{ scrollbarWidth: 'none' }}>
          {/* Dashboard - always show */}
          <NavItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" collapsed={isCollapsed} />
          
          {/* Leads - always show for all users including Super Admin */}
          <NavItem icon={Target} label="Leads" href="/leads" collapsed={isCollapsed} />
          
          {/* Clients - always show for all users including Super Admin */}
          <NavItem icon={Users} label="Clients" href="/client" collapsed={isCollapsed} />
          
          {/* Jobs - show if Super Admin or has view_jobs */}
          {(mounted && (showAll || hasPermission('view_jobs'))) && (
            <NavItem icon={Briefcase} label="Jobs" href="/job" collapsed={isCollapsed} />
          )}
          
          {/* Candidates - show if Super Admin or has view_assigned_candidates or view_all_candidates */}
          {(mounted && (showAll || hasAnyPermission(['view_assigned_candidates', 'view_all_candidates']))) && (
            <NavItem icon={UserRound} label="Candidates" href="/candidate" collapsed={isCollapsed} />
          )}
          
          {/* Pipeline - show if Super Admin or has move_pipeline */}
          {(mounted && (showAll || hasPermission('move_pipeline'))) && (
            <>
              <SectionLabel label="Recruitment Hub" collapsed={isCollapsed} />
              <NavItem icon={GitBranch} label="Pipeline" href="/pipeline" collapsed={isCollapsed} />
            </>
          )}
          
          {/* Matches - always show */}
          <NavItem icon={Zap} label="Matches" href="/matches" collapsed={isCollapsed} />
          
          {/* Interviews - show if Super Admin or has schedule_interview */}
          {(mounted && (showAll || hasPermission('schedule_interview'))) && (
            <NavItem icon={Calendar} label="Interviews" href="/interviews" collapsed={isCollapsed} />
          )}
          
          {/* Placements - show if Super Admin or has mark_placement or view_placement_revenue */}
          {(mounted && (showAll || hasAnyPermission(['mark_placement', 'view_placement_revenue']))) && (
            <NavItem icon={Award} label="Placements" href="/placement" collapsed={isCollapsed} />
          )}

          <Divider />

          {/* Tasks & Activities - always show */}
          <NavItem icon={CheckSquare} label="Tasks & Activities" href="/Task&Activites" collapsed={isCollapsed} />
          
          {/* Inbox - always show */}
          <NavItem icon={Mail} label="Inbox" href="/inbox" collapsed={isCollapsed} badge={3} />
          
          {/* Contacts - always show */}
          <NavItem icon={Contact} label="Contacts" href="/contacts" collapsed={isCollapsed} />

          <Divider />

          {/* Reports - show if Super Admin or has view_reports */}
          {(mounted && (showAll || hasPermission('view_reports'))) && (
            <NavItem icon={BarChart3} label="Reports" href="/reports" collapsed={isCollapsed} />
          )}
          
          {/* Billing - show if Super Admin or has access_billing */}
          {(mounted && (showAll || hasPermission('access_billing'))) && (
            <NavItem icon={CreditCard} label="Billing" href="/billing" collapsed={isCollapsed} />
          )}

          <div className="h-4" />

          {/* Team - show if Super Admin or has add_team_member or view_jobs */}
          {(mounted && (showAll || hasAnyPermission(['add_team_member', 'view_jobs']))) && (
            <>
              <SectionLabel label="Team Management" collapsed={isCollapsed} />
              <NavItem icon={UserPlus} label="Team" href="/team" collapsed={isCollapsed} />
            </>
          )}

          {/* Settings - show if Super Admin or has manage_settings */}
          {(mounted && (showAll || hasPermission('manage_settings'))) && (
            <NavItem icon={Settings} label="Settings" href="/setting" collapsed={isCollapsed} />
          )}
          
          {/* Administration - show for Admin and Super Admin */}
          {(mounted && (isAdmin() || isSuperAdmin())) && (
            <NavItem icon={ShieldCheck} label="Administration" href="/administration" collapsed={isCollapsed} />
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
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-white/10">
              <ImageWithFallback src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
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
    </>
  );
}

export default Sidenav;