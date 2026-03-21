import React from 'react';
import { ShieldAlert, Download, Upload, History, Clock, KeyRound, Database } from 'lucide-react';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      {/* Data Management */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900">Data Management</h2>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <button className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center gap-2">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Automated Backups</p>
                <p className="text-xs text-slate-500">Perform daily encrypted backups of all recruitment data</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Security & Access */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-semibold text-slate-900">Security & Access</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">Two-Factor Auth (2FA)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2b7fff]"></div>
                </label>
              </div>
              <p className="text-xs text-slate-500">Add an extra layer of security to all team accounts.</p>
            </div>
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">Audit Logs</span>
                </div>
                <button className="text-xs font-medium text-[#2b7fff] hover:underline">View Logs</button>
              </div>
              <p className="text-xs text-slate-500">Track all administrative changes and sensitive operations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Password Policy</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                <option>Standard (Min 8 chars)</option>
                <option>Strict (Uppercase, Special Char)</option>
                <option>Enterprise (Min 12 chars, No common words)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Data Retention Period</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                <option>1 Year</option>
                <option>3 Years</option>
                <option>7 Years (Compliance standard)</option>
                <option>Indefinite</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
