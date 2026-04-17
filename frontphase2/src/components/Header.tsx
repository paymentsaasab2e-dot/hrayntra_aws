import React from 'react';
import { Search, Plus, Upload, Download } from 'lucide-react';

interface HeaderProps {
  onAddContact: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAddContact }) => {
  return (
    <div className="flex items-center justify-between p-6 bg-white border-b border-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <p className="text-sm text-slate-500 mt-1">Manage client stakeholders, vendors, and hiring partners.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, company..." 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
        
        <div className="h-8 w-px bg-slate-200 mx-1" />

        <button className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
          <Upload size={16} />
          Import
        </button>
        <button className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
          <Download size={16} />
          Export
        </button>
        <button 
          onClick={onAddContact}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} />
          Add Contact
        </button>
      </div>
    </div>
  );
};
