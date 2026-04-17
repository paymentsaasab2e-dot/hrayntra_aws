import React from 'react';
import { DollarSign, CheckCircle2, Clock, Filter, Download, Search, MoreVertical } from 'lucide-react';
import { MOCK_TEAM, Badge, IconButton } from './TeamComponents';
import { ImageWithFallback } from './ImageWithFallback';

export const CommissionView = () => {
  const commissions = [
    { id: 'COM-101', recruiter: MOCK_TEAM[0], reference: 'JOB-9021 (Cloud Architect)', rate: '12%', amount: 1500, status: 'Pending', date: '2024-02-10' },
    { id: 'COM-102', recruiter: MOCK_TEAM[2], reference: 'JOB-8842 (Project Manager)', rate: '10%', amount: 850, status: 'Paid', date: '2024-02-08' },
    { id: 'COM-103', recruiter: MOCK_TEAM[0], reference: 'JOB-9105 (Frontend Dev)', rate: '15%', amount: 2200, status: 'Pending', date: '2024-02-05' },
    { id: 'COM-104', recruiter: MOCK_TEAM[1], reference: 'JOB-8731 (Sales lead)', rate: '8%', amount: 1100, status: 'Paid', date: '2024-01-28' },
    { id: 'COM-105', recruiter: MOCK_TEAM[2], reference: 'JOB-9004 (UX Designer)', rate: '10%', amount: 950, status: 'Paid', date: '2024-01-25' },
  ];

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by ID, recruiter or job..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all">
            <Filter className="size-4" /> Filter
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all">
            <Download className="size-4" /> Export
          </button>
        </div>
      </div>

      {/* Commission Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Recruiter</th>
                <th className="px-6 py-4">Placement Reference</th>
                <th className="px-6 py-4">Commission %</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full overflow-hidden">
                        <ImageWithFallback src={item.recruiter.avatar} alt={item.recruiter.name} className="size-full object-cover" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{item.recruiter.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {item.reference}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.rate}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    ${item.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'Paid' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {item.status === 'Paid' ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.status === 'Pending' ? (
                      <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">
                        Approve Payout
                      </button>
                    ) : (
                      <IconButton icon={MoreVertical} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
