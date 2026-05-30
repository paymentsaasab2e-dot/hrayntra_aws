'use client';

import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  Database,
  DollarSign,
  LayoutDashboard,
  Star,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import type { ReportSection, SavedReport } from './types';
import { SECTION_LABELS } from './types';

const NAV_ITEMS: Array<{ key: ReportSection; icon: React.ReactNode }> = [
  { key: 'executive', icon: <LayoutDashboard size={16} strokeWidth={2.2} /> },
  { key: 'recruitment', icon: <BarChart3 size={16} strokeWidth={2.2} /> },
  { key: 'clients', icon: <Building2 size={16} strokeWidth={2.2} /> },
  { key: 'candidates', icon: <Users size={16} strokeWidth={2.2} /> },
  { key: 'interviews', icon: <Video size={16} strokeWidth={2.2} /> },
  { key: 'placements', icon: <UserCheck size={16} strokeWidth={2.2} /> },
  { key: 'revenue', icon: <DollarSign size={16} strokeWidth={2.2} /> },
  { key: 'team', icon: <Briefcase size={16} strokeWidth={2.2} /> },
  { key: 'activity', icon: <Activity size={16} strokeWidth={2.2} /> },
  { key: 'raw', icon: <Database size={16} strokeWidth={2.2} /> },
];

type ReportsSidebarProps = {
  section: ReportSection;
  onSectionChange: (section: ReportSection) => void;
  savedReports: SavedReport[];
  onLoadSavedReport: (report: SavedReport) => void;
};

export function ReportsSidebar({ section, onSectionChange, savedReports, onLoadSavedReport }: ReportsSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-indigo-100/60 bg-white/90 lg:flex xl:w-60">
      <div className="border-b border-indigo-100/50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-900/60">Reports</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = section === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSectionChange(item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 hover:bg-indigo-50/80 hover:text-indigo-900'
                  }`}
                >
                  <span className={active ? 'text-white/95' : 'text-indigo-500'}>{item.icon}</span>
                  <span className="flex-1 leading-snug">{SECTION_LABELS[item.key]}</span>
                  {active ? <ChevronRight size={14} className="opacity-80" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-indigo-100/50 px-3 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-900/60">
          <Star size={11} className="text-amber-500" fill="currentColor" />
          My Reports
        </p>
        {savedReports.length ? (
          <ul className="space-y-1">
            {savedReports.slice(0, 6).map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  onClick={() => onLoadSavedReport(report)}
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                  title={report.name}
                >
                  {report.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-[11px] text-slate-400">Save filters to quick-access reports.</p>
        )}
      </div>
    </aside>
  );
}

export function ReportsMobileNav({ section, onSectionChange }: { section: ReportSection; onSectionChange: (s: ReportSection) => void }) {
  return (
    <div className="border-b border-indigo-100/50 bg-white/90 px-3 py-2 lg:hidden">
      <select
        value={section}
        onChange={(event) => onSectionChange(event.target.value as ReportSection)}
        className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs font-medium text-slate-800"
        aria-label="Report section"
      >
        {NAV_ITEMS.map((item) => (
          <option key={item.key} value={item.key}>
            {SECTION_LABELS[item.key]}
          </option>
        ))}
      </select>
    </div>
  );
}
