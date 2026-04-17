import React from 'react';
import { 
  Search, 
  UserPlus, 
  Upload, 
  Sparkles, 
  SearchCode, 
  Filter, 
  RefreshCw, 
  Settings2,
  Bell
} from 'lucide-react';

export const TopHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex-1 max-w-2xl relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        </div>
        <input 
          type="text" 
          placeholder="Search by Name, Email, Phone, Job or LinkedIn URL"
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-200">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Settings2 size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Upload size={16} />
            Import
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Sparkles size={16} />
            AI Parser
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
            <SearchCode size={16} />
            AI Sourcing
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-200">
            <UserPlus size={16} />
            Add Candidate
          </button>
        </div>
      </div>
    </header>
  );
};
