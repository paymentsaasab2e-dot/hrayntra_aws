import React, { useState } from 'react';
import { GripVertical, Plus, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, Reorder } from 'motion/react';

const initialStages = [
  { id: '1', name: 'Sourced', color: '#6366f1' },
  { id: '2', name: 'Applied', color: '#2b7fff' },
  { id: '3', name: 'Interview', color: '#f59e0b' },
  { id: '4', name: 'Technical Test', color: '#8b5cf6' },
  { id: '5', name: 'Offer', color: '#10b981' },
  { id: '6', name: 'Hired', color: '#059669' },
];

export function WorkflowSettings() {
  const [stages, setStages] = useState(initialStages);

  return (
    <div className="space-y-6 pb-20">
      {/* Pipeline Stages */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Pipeline Stages</h2>
            <p className="text-sm text-slate-500">Define and order your recruitment process stages.</p>
          </div>
          <button className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
        </div>
        <div className="p-6">
          <Reorder.Group axis="y" values={stages} onReorder={setStages} className="space-y-3">
            {stages.map((stage) => (
              <Reorder.Item 
                key={stage.id} 
                value={stage}
                className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 group cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-4 h-4 text-slate-400" />
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-sm font-medium text-slate-700 flex-1">{stage.name}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </div>

      {/* Status Management */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Status Management</h2>
          <p className="text-sm text-slate-500">Configure rejection reasons and offer status labels.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Rejection Reasons
              </h3>
              <button className="text-xs font-medium text-[#2b7fff] hover:underline">Add New</button>
            </div>
            <div className="space-y-2">
              {['Lacks experience', 'Salary mismatch', 'Culture fit', 'Better offer elsewhere', 'Failed tech assessment'].map((reason) => (
                <div key={reason} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex justify-between group">
                  {reason}
                  <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                Offer Status Labels
              </h3>
              <button className="text-xs font-medium text-[#2b7fff] hover:underline">Add New</button>
            </div>
            <div className="space-y-2">
              {['Draft', 'Sent', 'Accepted', 'Declined', 'Negotiating'].map((status) => (
                <div key={status} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex justify-between group">
                  {status}
                  <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Automation Rules */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Automation Rules</h2>
          <p className="text-sm text-slate-500">Streamline your workflow with automatic actions.</p>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Auto move stage', desc: 'Move candidates automatically when criteria are met' },
            { label: 'Auto send email on stage change', desc: 'Trigger template emails when moving candidates' },
            { label: 'Interview reminder rules', desc: 'Notify interviewers and candidates 24h before' },
            { label: 'SLA reminders', desc: 'Alert team if a candidate is stuck in a stage too long' },
          ].map((rule) => (
            <div key={rule.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">{rule.label}</p>
                <p className="text-xs text-slate-500">{rule.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2b7fff]"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
