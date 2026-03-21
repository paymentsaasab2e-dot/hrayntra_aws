'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Target,
  Users, 
  Briefcase, 
  UserRound, 
  GitBranch, 
  Zap, 
  Calendar, 
  Award, 
  CheckSquare, 
  Mail, 
  Contact, 
  BarChart3, 
  CreditCard, 
  UserPlus, 
  Settings, 
  ShieldCheck,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { motion } from 'motion/react';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  collapsed: boolean;
}

const NavItem = ({ icon: Icon, label, active, collapsed }: NavItemProps) => {
  return (
    <div 
      className={`relative flex items-center h-10 px-3 my-1 cursor-pointer transition-all duration-200 group
        ${active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
      )}
      
      <div className={`flex items-center justify-center ${collapsed ? 'w-full' : 'mr-3'}`}>
        <Icon size={20} strokeWidth={1.5} />
      </div>

      {!collapsed && (
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
          {label}
        </span>
      )}

      {collapsed && (
        <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
          {label}
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ label, collapsed }: { label: string; collapsed: boolean }) => {
  if (collapsed) return <div className="h-px bg-white/10 my-4 mx-4" />;
  
  return (
    <div className="px-3 mt-6 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </span>
    </div>
  );
};

const Divider = () => <div className="h-px bg-white/10 my-2 mx-3" />;

export const Sidebar = ({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapse) onCollapse(newState);
  };

  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-[calc(100vh-64px)] bg-[#0F2A44] flex flex-col fixed left-0 top-16 border-r border-white/5 shadow-2xl z-40 overflow-hidden"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 shrink-0">
        <div className="flex items-center overflow-hidden">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-3 font-bold text-white tracking-tight text-lg whitespace-nowrap"
            >
              SAASA B2E
            </motion.span>
          )}
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
        <NavItem icon={LayoutDashboard} label="Dashboard" active collapsed={isCollapsed} />
        <NavItem icon={Target} label="Leads" collapsed={isCollapsed} />
        <NavItem icon={Users} label="Clients" collapsed={isCollapsed} />
        <NavItem icon={Briefcase} label="Jobs" collapsed={isCollapsed} />
        <NavItem icon={UserRound} label="Candidates" collapsed={isCollapsed} />

        <SectionLabel label="Recruitment Hub" collapsed={isCollapsed} />
        
        <NavItem icon={GitBranch} label="Pipeline" collapsed={isCollapsed} />
        <NavItem icon={Zap} label="Matches" collapsed={isCollapsed} />
        <NavItem icon={Calendar} label="Interviews" collapsed={isCollapsed} />
        <NavItem icon={Award} label="Placements" collapsed={isCollapsed} />

        <Divider />

        <NavItem icon={CheckSquare} label="Tasks & Activities" collapsed={isCollapsed} />
        <NavItem icon={Mail} label="Inbox" collapsed={isCollapsed} />
        <NavItem icon={Contact} label="Contacts" collapsed={isCollapsed} />

        <Divider />

        <NavItem icon={BarChart3} label="Reports" collapsed={isCollapsed} />
        <NavItem icon={CreditCard} label="Billing" collapsed={isCollapsed} />

        {/* Push remaining items to bottom */}
        <div className="mt-auto pt-6">
          <NavItem icon={UserPlus} label="Team" collapsed={isCollapsed} />
          <NavItem icon={Settings} label="Settings" collapsed={isCollapsed} />
          <NavItem icon={ShieldCheck} label="Administration" collapsed={isCollapsed} />
        </div>
      </div>

      {/* Footer Area */}
      <div className="p-4 bg-black/10 shrink-0">
        {!isCollapsed ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 mb-4">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-emerald-400 font-medium uppercase tracking-wider">Free Trial</span>
              <span className="text-emerald-400/80">12 days left</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[70%]" />
            </div>
          </div>
        ) : (
           <div className="flex justify-center mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Free Trial Active" />
           </div>
        )}

        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-gray-700 flex-shrink-0 border-2 border-white/10 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">Alex Thompson</p>
              <p className="text-xs text-gray-400 truncate">HR Manager</p>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </motion.div>
  );
};
