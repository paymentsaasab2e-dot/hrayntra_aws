import React from 'react';
import { Calendar, ChevronDown, Filter, X, PlayCircle, Briefcase, User, Users, Video } from 'lucide-react';

export function InterviewHorizontalFilterBar() {
  const filters = [
    { label: 'Date', icon: Calendar, value: 'This Week' },
    { label: 'Status', icon: PlayCircle, value: 'All Status' },
    { label: 'Interview Round', icon: Briefcase, value: 'All Rounds' },
    { label: 'Mode', icon: Video, value: 'All Modes' },
    { label: 'Interviewer', icon: User, value: 'All Interviewers' },
    { label: 'Client / Job', icon: Users, value: 'All Clients' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Filter className="size-3.5 text-slate-500" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Quick Filters</span>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {filters.map((filter) => (
            <button
              key={filter.label}
              className="group flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
            >
              <filter.icon className="size-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-slate-500">{filter.label}:</span>
              <span className="text-slate-900 font-semibold">{filter.value}</span>
              <ChevronDown className="size-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
          ))}
          
          <div className="h-6 w-px bg-slate-200 mx-1 hidden lg:block"></div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-auto">
            <X className="size-3.5" />
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}
