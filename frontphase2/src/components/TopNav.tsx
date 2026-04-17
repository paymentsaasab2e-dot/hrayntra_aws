import React from 'react';
import { Search, Bell, HelpCircle, Plus, Mail, Settings } from 'lucide-react';

export function TopNav() {
  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search across the system..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
          <Mail className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white"></span>
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 pr-2 rounded-lg transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
            JS
          </div>
          <span className="text-sm font-medium text-slate-700">James Smith</span>
        </div>
      </div>
    </div>
  );
}
