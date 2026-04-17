import React from 'react';
import { Palette, Layers, Layout, FileText, Settings2, ExternalLink } from 'lucide-react';

export function CustomizationSettings() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branding */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <Palette className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-semibold text-slate-900">Branding & Theme</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-medium text-slate-700 block">Primary Brand Color</label>
              <div className="flex flex-wrap gap-3">
                {['#2b7fff', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#000000'].map((color) => (
                  <button 
                    key={color} 
                    className={`w-8 h-8 rounded-full border-2 ${color === '#2b7fff' ? 'border-slate-900 ring-2 ring-[#2b7fff]/20' : 'border-transparent hover:scale-110'} transition-all`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <button className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  +
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 block">Dashboard Layout</label>
              <div className="grid grid-cols-2 gap-3">
                <button className="p-3 border-2 border-[#2b7fff] rounded-lg bg-blue-50/50">
                  <div className="w-full aspect-video bg-white border border-slate-200 rounded mb-2 overflow-hidden flex">
                    <div className="w-1/4 h-full bg-slate-100 border-r border-slate-200" />
                    <div className="flex-1 p-1 space-y-1">
                      <div className="h-1 w-full bg-slate-100 rounded" />
                      <div className="h-4 w-full bg-slate-50 rounded" />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Standard Sidebar</span>
                </button>
                <button className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="w-full aspect-video bg-white border border-slate-200 rounded mb-2 overflow-hidden">
                    <div className="h-1/4 w-full bg-slate-100 border-b border-slate-200" />
                    <div className="p-1 space-y-1">
                      <div className="h-4 w-full bg-slate-50 rounded" />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">Top Navigation</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Fields */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <Layers className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Custom Fields</h2>
          </div>
          <div className="p-6">
            <div className="flex border-b border-slate-100 mb-6">
              {['Candidate', 'Client', 'Job'].map((tab, idx) => (
                <button 
                  key={tab} 
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${idx === 0 ? 'border-[#2b7fff] text-[#2b7fff]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {['Expected Salary', 'Notice Period', 'Current Location', 'Preferred Stack'].map((field) => (
                <div key={field} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg group">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">{field}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 text-slate-400 hover:text-slate-600"><FileText className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              <button className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                + Add Custom Field
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates & Builders */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <Layout className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-900">Advanced Customization</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Form Builder', desc: 'Create custom application forms', icon: Layout },
            { name: 'Email Designer', desc: 'Visual editor for email templates', icon: Palette },
            { name: 'Offer Template Editor', desc: 'Customize PDF offer letters', icon: FileText },
          ].map((tool) => (
            <button key={tool.name} className="p-5 border border-slate-200 rounded-xl hover:border-[#2b7fff] hover:bg-blue-50/20 transition-all text-left group">
              <tool.icon className="w-6 h-6 text-slate-400 group-hover:text-[#2b7fff] mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">{tool.name}</h3>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{tool.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
