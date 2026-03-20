import React from 'react';
import { Mail, MessageSquare, Calendar, Globe, CheckCircle2, Link2, ExternalLink } from 'lucide-react';

export function CommunicationSettings() {
  return (
    <div className="space-y-6">
      {/* Email Integration */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6 text-[#2b7fff]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Email Integration</h2>
              <p className="text-sm text-slate-500">Sync your business email to track communications.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-4">
            <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors flex items-center gap-2">
              <ImageWithFallback src="https://www.gstatic.com/images/branding/product/1x/gmail_32dp.png" alt="Gmail" className="w-5 h-5" />
              Connect Gmail
            </button>
            <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors flex items-center gap-2">
              <ImageWithFallback src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Outlook" className="w-5 h-5" />
              Connect Outlook
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Default Sending Email</label>
              <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/20 text-sm">
                <option>recruiting@globalrecruiters.com</option>
                <option>hr@globalrecruiters.com</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <button className="text-sm font-medium text-[#2b7fff] hover:underline flex items-center gap-1">
                Manage Email Templates
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SMS / WhatsApp */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex gap-3 mb-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900">SMS & WhatsApp</h3>
            </div>
            <p className="text-sm text-slate-500">Send automated text notifications.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Twilio API Key</label>
              <input type="password" value="••••••••••••••••" readOnly className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Auto Notifications</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <button className="w-full px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors">
              Template Management
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex gap-3 mb-2">
              <Calendar className="w-5 h-5 text-rose-500" />
              <h3 className="font-semibold text-slate-900">Calendar Sync</h3>
            </div>
            <p className="text-sm text-slate-500">Auto-schedule interviews based on availability.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Google Calendar Sync</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2b7fff]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-600">Interview Auto Scheduling</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2b7fff]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Job Boards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex gap-3 mb-2">
            <Globe className="w-5 h-5 text-sky-500" />
            <h3 className="font-semibold text-slate-900">Job Board Integrations</h3>
          </div>
          <p className="text-sm text-slate-500">Post jobs automatically to major platforms.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'LinkedIn', color: 'bg-[#0077b5]' },
            { name: 'Indeed', color: 'bg-[#003A9B]' },
            { name: 'Naukri', color: 'bg-[#ff7555]' }
          ].map((board) => (
            <div key={board.name} className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">{board.name}</span>
                <div className={`w-2 h-2 rounded-full ${board.name === 'Indeed' ? 'bg-slate-300' : 'bg-green-500'}`} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">API Key / Client ID</label>
                <input type="password" value="••••••••••" readOnly className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
              </div>
              <button className="w-full py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
                {board.name === 'Indeed' ? 'Connect' : 'Settings'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageWithFallback({ src, alt, className }: { src: string, alt: string, className?: string }) {
  return <img src={src} alt={alt} className={className} onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32' }} />;
}
