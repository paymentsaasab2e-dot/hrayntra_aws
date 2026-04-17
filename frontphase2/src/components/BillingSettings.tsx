import React from 'react';
import { CreditCard, Percent, FileText, Info } from 'lucide-react';

export function BillingSettings() {
  return (
    <div className="space-y-6">
      {/* Commission Structure */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <Percent className="w-5 h-5 text-[#2b7fff]" />
          <h2 className="text-lg font-semibold text-slate-900">Commission & Tax Settings</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Default Commission (%)</label>
              <div className="relative">
                <input type="number" defaultValue="15" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 pr-10" />
                <span className="absolute right-3 top-2 text-slate-400 font-medium">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Calculation Type</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20">
                <option>Percentage of Annual CTC</option>
                <option>Fixed Fee per Placement</option>
                <option>Retainer + Success Fee</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Invoice Prefix</label>
              <input type="text" defaultValue="INV-RA-" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Payment Terms</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20">
                <option>Net 30</option>
                <option>Net 15</option>
                <option>Due on Receipt</option>
                <option>Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tax Percentage (%)</label>
              <input type="number" defaultValue="18" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-sm font-medium text-slate-900">Late Fee Rules</span>
                <p className="text-xs text-slate-500">Auto-add 2% after 7 days overdue</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2b7fff]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plan */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden text-white">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-[#2b7fff]" />
            <h2 className="text-lg font-semibold">Subscription Plan</h2>
          </div>
          <span className="px-3 py-1 bg-[#2b7fff]/20 text-[#2b7fff] text-xs font-bold rounded-full border border-[#2b7fff]/30">ACTIVE</span>
        </div>
        <div className="p-6 flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="text-slate-400 text-sm mb-1">Current Plan</p>
            <h3 className="text-2xl font-bold">Enterprise Pro</h3>
            <p className="text-slate-400 text-xs mt-1">Next billing: March 15, 2026 ($299.00)</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 border border-white/20 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">
              Manage Billing
            </button>
            <button className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors">
              Upgrade Plan
            </button>
          </div>
        </div>
        <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#2b7fff]" />
          <p className="text-xs text-slate-300">Your organization has used 85% of its candidate storage limit.</p>
        </div>
      </div>
    </div>
  );
}
