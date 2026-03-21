import React from 'react';
import { MoreHorizontal, Eye, FileUp, CheckCircle, FileText, RefreshCw, ArrowUpDown, ReceiptText } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

interface Placement {
  id: string;
  candidateName: string;
  avatar: string;
  company: string;
  jobTitle: string;
  recruiter: string;
  offerDate: string;
  joiningDate: string;
  employmentType: 'Permanent' | 'Contract';
  status: 'Offer Accepted' | 'Joining Scheduled' | 'Joined' | 'No-Show' | 'Dropped';
  billingStatus: 'Pending' | 'Invoiced' | 'Paid';
}

const mockPlacements: Placement[] = [
  {
    id: '1',
    candidateName: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1762522921456-cdfe882d36c3',
    company: 'TechFlow Solutions',
    jobTitle: 'Senior Product Designer',
    recruiter: 'Michael Chen',
    offerDate: 'Jan 15, 2026',
    joiningDate: 'Feb 20, 2026',
    employmentType: 'Permanent',
    status: 'Joining Scheduled',
    billingStatus: 'Pending',
  },
  {
    id: '2',
    candidateName: 'David Miller',
    avatar: 'https://images.unsplash.com/photo-1651684215020-f7a5b6610f23',
    company: 'CloudScale Inc.',
    jobTitle: 'Backend Engineer (Go)',
    recruiter: 'Jessica Wong',
    offerDate: 'Jan 10, 2026',
    joiningDate: 'Feb 1, 2026',
    employmentType: 'Permanent',
    status: 'Joined',
    billingStatus: 'Paid',
  },
  {
    id: '3',
    candidateName: 'Emily Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1758599543120-4e462429a4d7',
    company: 'Fintech Hub',
    jobTitle: 'Fullstack Developer',
    recruiter: 'Michael Chen',
    offerDate: 'Jan 28, 2026',
    joiningDate: 'Mar 1, 2026',
    employmentType: 'Contract',
    status: 'Offer Accepted',
    billingStatus: 'Pending',
  },
  {
    id: '4',
    candidateName: 'Marcus Thompson',
    avatar: 'https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a',
    company: 'Global Retail',
    jobTitle: 'Marketing Manager',
    recruiter: 'Emma Davis',
    offerDate: 'Dec 15, 2025',
    joiningDate: 'Jan 15, 2026',
    employmentType: 'Permanent',
    status: 'Joined',
    billingStatus: 'Invoiced',
  },
  {
    id: '5',
    candidateName: 'Olivia Chen',
    avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337',
    company: 'NextGen AI',
    jobTitle: 'Data Scientist',
    recruiter: 'Jessica Wong',
    offerDate: 'Feb 2, 2026',
    joiningDate: 'Mar 15, 2026',
    employmentType: 'Permanent',
    status: 'Offer Accepted',
    billingStatus: 'Pending',
  }
];

const StatusTag = ({ status }: { status: Placement['status'] }) => {
  const styles = {
    'Offer Accepted': 'bg-blue-50 text-blue-700 border-blue-100',
    'Joining Scheduled': 'bg-amber-50 text-amber-700 border-amber-100',
    'Joined': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'No-Show': 'bg-red-50 text-red-700 border-red-100',
    'Dropped': 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
};

const BillingTag = ({ status }: { status: Placement['billingStatus'] }) => {
  const styles = {
    'Pending': 'bg-slate-100 text-slate-600',
    'Invoiced': 'bg-indigo-50 text-indigo-700 border-indigo-100 border',
    'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-100 border',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
};

export const PlacementsTable = ({ onSelect }: { onSelect: (p: Placement) => void }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-b-lg overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-200">
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidate</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client / Job</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recruiter</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer group/header">
              <div className="flex items-center gap-1">
                Offer Date
                <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover/header:text-slate-600 transition-colors" />
              </div>
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer group/header">
              <div className="flex items-center gap-1">
                Joining Date
                <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover/header:text-slate-600 transition-colors" />
              </div>
            </th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Type</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {mockPlacements.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer" 
                  onClick={() => onSelect(p)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200">
                    <ImageWithFallback src={p.avatar} alt={p.candidateName} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-600 hover:underline">{p.candidateName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <BillingTag status={p.billingStatus} />
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.company}</p>
                  <p className="text-xs text-slate-500">{p.jobTitle}</p>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">{p.recruiter}</td>
              <td className="px-6 py-4 text-sm text-slate-600 font-medium">{p.offerDate}</td>
              <td className="px-6 py-4 text-sm text-slate-600 font-medium">{p.joiningDate}</td>
              <td className="px-6 py-4 text-center">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-tighter">
                  {p.employmentType}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <StatusTag status={p.status} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                   <button title="View Details" onClick={() => onSelect(p)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button title="Upload Documents" className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                    <FileUp className="w-4 h-4" />
                  </button>
                  <button title="Mark as Joined" className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button title="Raise Invoice" className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors">
                    <ReceiptText className="w-4 h-4" />
                  </button>
                  <button title="More Options" className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
        <p className="text-sm text-slate-500 font-medium">Showing 5 of 124 placements</p>
        <div className="flex gap-2">
          <button className="px-3 py-1 border border-slate-200 rounded text-sm bg-white hover:bg-slate-50 disabled:opacity-50 font-medium">Previous</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium">Next</button>
        </div>
      </div>
    </div>
  );
};
