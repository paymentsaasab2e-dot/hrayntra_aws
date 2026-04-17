import React from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';

interface FilterDropdownProps {
  label: string;
  value?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, value }) => (
  <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors">
    <span className="text-slate-400 font-normal">{label}:</span>
    <span className="text-slate-900">{value || 'All'}</span>
    <ChevronDown size={14} className="text-slate-400" />
  </button>
);

export const ContactFilterBar: React.FC = () => {
  return (
    <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-slate-400 mr-2">
            <Filter size={14} className="text-slate-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Filter By:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FilterDropdown label="Company / Client" value="All Companies" />
            <FilterDropdown label="Contact Type" value="Hiring Manager" />
            <FilterDropdown label="Role / Designation" value="Engineering" />
            <FilterDropdown label="Location" value="Global" />
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
            <span className="text-slate-900">148</span> Contacts Found
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-50 pt-2">
        <div className="flex items-center gap-2 pl-[84px]">
          <FilterDropdown label="Owner" value="Alex Rivera" />
          <FilterDropdown label="Status" value="Active" />
          <FilterDropdown label="Recently Contacted" value="All Time" />
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all">
          <X size={14} />
          Clear All
        </button>
      </div>
    </div>
  );
};
