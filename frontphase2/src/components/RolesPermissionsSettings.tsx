import React from 'react';
import { Shield, Users, Edit2, Trash2, Plus, Check } from 'lucide-react';

const roles = [
  { name: 'Administrator', members: 3, type: 'Full Access' },
  { name: 'Senior Recruiter', members: 12, type: 'Module Specific' },
  { name: 'Junior Recruiter', members: 8, type: 'Restricted' },
  { name: 'Finance Admin', members: 2, type: 'Billing Only' },
];

const modules = ['Clients', 'Jobs', 'Candidates', 'Pipeline', 'Billing', 'Reports', 'Team'];
const permissions = ['View', 'Edit', 'Delete', 'Export'];

export function RolesPermissionsSettings() {
  return (
    <div className="space-y-6">
      {/* Role List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User Roles</h2>
            <p className="text-sm text-slate-500">Manage access levels and team permissions.</p>
          </div>
          <button className="px-3 py-1.5 bg-[#2b7fff] text-white rounded-lg text-sm font-medium hover:bg-[#1e6ae6] transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add New Role
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Members</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Access Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => (
                <tr key={role.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-[#2b7fff]" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{role.members} users</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{role.type}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Permission Matrix</h2>
          <p className="text-sm text-slate-500">Fine-tune module-level access for the selected role.</p>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-700 block mb-2">Configure for:</label>
            <select className="w-full md:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none">
              {roles.map(r => <option key={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">Modules</th>
                  {permissions.map(p => (
                    <th key={p} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 text-center">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modules.map((module) => (
                  <tr key={module}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{module}</td>
                    {permissions.map((p) => (
                      <td key={p} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <label className="relative flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked={p === 'View'} />
                            <div className="w-5 h-5 bg-white border-2 border-slate-200 rounded peer-checked:bg-[#2b7fff] peer-checked:border-[#2b7fff] transition-all flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform" />
                            </div>
                          </label>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
