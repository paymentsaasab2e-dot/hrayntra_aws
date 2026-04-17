import React from 'react';
import { Mail, Phone, MoreVertical, ExternalLink } from 'lucide-react';
import { Contact, MOCK_CONTACTS } from './ContactMockData';
import { ImageWithFallback } from './ImageWithFallback';

interface ContactsTableProps {
  onRowClick: (contact: Contact) => void;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({ onRowClick }) => {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left border-collapse min-w-[1200px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <th className="px-6 py-3 w-10">
              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
            </th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Name</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Company</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Designation</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact Type</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jobs</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Owner</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Contact</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {MOCK_CONTACTS.map((contact) => (
            <tr 
              key={contact.id} 
              className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
              onClick={() => onRowClick(contact)}
            >
              <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <ImageWithFallback src={contact.avatar} alt={contact.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{contact.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{contact.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1.5 text-blue-600 font-medium text-sm hover:underline">
                  {contact.company.name}
                  <ExternalLink size={12} />
                </div>
              </td>
              <td className="px-6 py-4">
                <p className="text-sm text-slate-600">{contact.designation}</p>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  getTypeStyles(contact.type)
                }`}>
                  {contact.type}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-full">
                  {contact.associatedJobs}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {contact.owner.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs text-slate-600">{contact.owner}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">
                {contact.lastContacted}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${contact.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className={`text-xs font-medium ${contact.status === 'Active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {contact.status}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Email">
                    <Mail size={16} />
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Call">
                    <Phone size={16} />
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function getTypeStyles(type: string) {
  switch (type) {
    case 'HR': return 'bg-purple-100 text-purple-700';
    case 'Hiring Manager': return 'bg-blue-100 text-blue-700';
    case 'Interviewer': return 'bg-orange-100 text-orange-700';
    case 'Vendor': return 'bg-amber-100 text-amber-700';
    case 'Partner': return 'bg-rose-100 text-rose-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}
