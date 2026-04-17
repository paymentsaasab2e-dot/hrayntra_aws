import React from 'react';
import { Search, ChevronDown, Filter, Calendar } from 'lucide-react';

export const PlacementFiltersBar = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-t-lg p-4 flex flex-wrap items-center gap-4">
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search candidate, company or job..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[140px]">
            <option>All Status</option>
            <option>Offer Accepted</option>
            <option>Joining Scheduled</option>
            <option>Joined</option>
            <option>No-Show</option>
            <option>Dropped</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[140px]">
            <option>All Clients</option>
            <option>Google</option>
            <option>Meta</option>
            <option>Amazon</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[160px]">
            <option>Employment Type</option>
            <option>Permanent</option>
            <option>Contract</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>

        <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <Calendar className="w-4 h-4" />
          <span>Date Range</span>
        </button>

        <button className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200 transition-colors">
          <Filter className="w-4 h-4" />
          <span>More Filters</span>
        </button>
      </div>
    </div>
  );
};
