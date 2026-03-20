'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Target, 
  Users, 
  Briefcase, 
  UserRound, 
  Calendar, 
  Award, 
  ClipboardList, 
  Mail, 
  Contact, 
  BarChart3, 
  CreditCard, 
  Users2, 
  Settings, 
  ShieldCheck,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { ImageWithFallback } from '../../components/ImageWithFallback';

// Mock Data
const kpiData = [
  { title: "Active Clients", count: "24", trend: "12%", up: true, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
  { title: "Open Jobs", count: "85", trend: "5%", up: true, icon: Briefcase, color: "text-purple-500", bg: "bg-purple-500/10" },
  { title: "Candidates in Pipeline", count: "1,240", trend: "18%", up: true, icon: UserRound, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { title: "Interviews Scheduled", count: "42", trend: "2%", up: false, icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
  { title: "Offers Sent", count: "18", trend: "8%", up: true, icon: ClipboardList, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { title: "Placements Completed", count: "12", trend: "15%", up: true, icon: Award, color: "text-pink-500", bg: "bg-pink-500/10" },
];

const jobsByClientData = [
  { name: 'TechCorp', jobs: 12 },
  { name: 'FinEdge', jobs: 19 },
  { name: 'HealthPlus', jobs: 8 },
  { name: 'RetailX', jobs: 15 },
  { name: 'LogiFlow', jobs: 11 },
  { name: 'MediCare', jobs: 20 },
];

const jobStatusData = [
  { name: 'Open', value: 65, color: '#3b82f6' },
  { name: 'Closed', value: 35, color: '#e2e8f0' },
];

const recruiterPerformance = [
  { name: 'Sarah Jenkins', cvs: 45, interviews: 12, offers: 5, placements: 3, img: 'https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?auto=format&fit=crop&q=80&w=100' },
  { name: 'Mike Ross', cvs: 38, interviews: 10, offers: 4, placements: 2, img: 'https://images.unsplash.com/photo-1652471943570-f3590a4e52ed?auto=format&fit=crop&q=80&w=100' },
  { name: 'Emily Blunt', cvs: 52, interviews: 15, offers: 7, placements: 4, img: 'https://images.unsplash.com/photo-1459499362902-55a20553e082?auto=format&fit=crop&q=80&w=100' },
  { name: 'David Gandy', cvs: 29, interviews: 8, offers: 3, placements: 1, img: 'https://images.unsplash.com/photo-1718220216044-006f43e3a9b1?auto=format&fit=crop&q=80&w=100' },
];

const todayInterviews = [
  { candidate: 'Alex Rivera', client: 'TechCorp', role: 'Sr. Frontend Dev', type: 'Technical', time: '10:00 AM', status: 'Upcoming' },
  { candidate: 'Jordan Smith', client: 'FinEdge', role: 'Product Manager', type: 'HR Round', time: '11:30 AM', status: 'In Progress' },
  { candidate: 'Maria Garcia', client: 'HealthPlus', role: 'UI Designer', type: 'Final Round', time: '02:00 PM', status: 'Upcoming' },
  { candidate: 'Sam Wilson', client: 'RetailX', role: 'Sales Lead', type: 'First Intro', time: '04:00 PM', status: 'Completed' },
];

const pipelineStages = [
  { label: 'Applied', count: 450, color: 'bg-blue-50 text-blue-600 border-blue-100' },
  { label: 'Shortlisted', count: 180, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { label: 'Interviewed', count: 95, color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { label: 'Selected', count: 42, color: 'bg-pink-50 text-pink-600 border-pink-100' },
  { label: 'Offer Signed', count: 18, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  { label: 'BGV', count: 12, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  { label: 'Joined', count: 12, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
];

const revenueTrend = [
  { month: 'Sep', revenue: 45000 },
  { month: 'Oct', revenue: 52000 },
  { month: 'Nov', revenue: 48000 },
  { month: 'Dec', revenue: 61000 },
  { month: 'Jan', revenue: 55000 },
  { month: 'Feb', revenue: 68000 },
];

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Agency Dashboard</h2>
          <p className="text-slate-500 font-medium text-sm">Overview of clients, jobs, candidates, and placements</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-900">This Month</button>
          <button className="px-4 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-900">Last Month</button>
          <button className="px-4 py-1.5 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-900 flex items-center gap-2">
            Custom <Filter size={12} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiData.map((kpi, i) => (
          <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-blue-200 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 ${kpi.bg} ${kpi.color} rounded-xl group-hover:scale-110 transition-transform`}>
                <kpi.icon size={20} />
              </div>
              <div className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-lg ${kpi.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {kpi.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {kpi.trend}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{kpi.title}</p>
              <p className="text-xl font-black text-slate-900 mt-1">{kpi.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recruitment Pipeline (Global View)</h3>
          <div className="flex gap-4 text-[10px] font-bold text-slate-400">
            <span className="cursor-pointer hover:text-blue-600">CLIENT: ALL</span>
            <span className="cursor-pointer hover:text-blue-600">JOB: ALL</span>
            <span className="cursor-pointer hover:text-blue-600">RECRUITER: ALL</span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center w-full gap-2 overflow-x-auto pb-2 no-scrollbar">
            {pipelineStages.map((stage, i) => (
              <React.Fragment key={i}>
                <div className={`flex-1 min-w-[130px] p-4 rounded-xl border flex flex-col items-center text-center transition-all hover:shadow-md ${stage.color}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{stage.label}</span>
                  <span className="text-xl font-black">{stage.count}</span>
                </div>
                {i < pipelineStages.length - 1 && (
                  <div className="flex items-center shrink-0">
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Open Jobs by Client</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobsByClientData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} 
                />
                <RechartsTooltip 
                  cursor={{fill: '#f8fafc', radius: 4}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="jobs" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Status (Open vs Closed)</h3>
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Avg. Job Aging</p>
              <p className="text-lg font-black text-slate-900">18 Days</p>
            </div>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jobStatusData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {jobStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900 tracking-tighter">100</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total Jobs</span>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {jobStatusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}}></div>
                <span className="text-[11px] font-bold text-slate-500">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">My Pending Tasks</h3>
            <button className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="p-6 space-y-4">
            {[
              { task: "Follow up with Jordan Smith on technical assessment", date: "Today, 4:00 PM", priority: "High", color: "red" },
              { task: "Review 15 new CVs for TechCorp Backend Role", date: "Today, 5:30 PM", priority: "Medium", color: "orange" },
              { task: "Prepare offer letter for Sam Rivera (RetailX)", date: "Tomorrow, 10:00 AM", priority: "High", color: "red" },
              { task: "Weekly sync with HR Team - FinEdge", date: "Tomorrow, 2:00 PM", priority: "Low", color: "blue" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group border border-transparent hover:border-slate-100">
                <div className="w-5 h-5 border-2 border-slate-200 rounded flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-50 transition-all">
                  <div className="w-2 h-2 bg-blue-500 rounded-sm opacity-0 group-hover:opacity-100 transition-all" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 tracking-tight">{item.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.date}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-${item.color}-50 text-${item.color}-600 border border-${item.color}-100`}>
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recruiter Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="px-6 py-4">Recruiter</th>
                  <th className="py-4 text-center">CVs</th>
                  <th className="py-4 text-center">Intv</th>
                  <th className="py-4 text-center">Offers</th>
                  <th className="px-6 py-4 text-center">Plcmt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recruiterPerformance.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ImageWithFallback src={item.img} className="w-8 h-8 rounded-lg shadow-sm" alt={item.name} />
                        <span className="text-sm font-bold text-slate-800">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center text-sm font-bold text-slate-600">{item.cvs}</td>
                    <td className="py-4 text-center text-sm font-bold text-slate-600">{item.interviews}</td>
                    <td className="py-4 text-center text-sm font-bold text-slate-600">{item.offers}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-blue-50 text-blue-600 text-sm font-black px-2 py-1 rounded-lg border border-blue-100 shadow-sm">
                        {item.placements}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Today's Interviews</h3>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} /> Feb 5, 2026
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todayInterviews.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-800">{item.candidate}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{item.client}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase tracking-wider">{item.role}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-xl uppercase tracking-widest border ${
                      item.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      item.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risks & Activity & Revenue */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-8">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Alerts & Risks</h3>
          <div className="space-y-3">
            {[
              { title: "Salary Mismatch", desc: "Jordan Smith (FinEdge) expected 15% more than budget.", icon: AlertCircle, color: "text-red-600 bg-red-50", border: "border-red-100" },
              { title: "BV Pending", desc: "Background verification for Alex Rivera delayed by 3 days.", icon: Clock, color: "text-orange-600 bg-orange-50", border: "border-orange-100" },
              { title: "Offer Delayed", desc: "TechCorp hasn't responded to Sarah Ross's offer in 48h.", icon: AlertCircle, color: "text-pink-600 bg-pink-50", border: "border-pink-100" },
            ].map((alert, i) => (
              <div key={i} className={`flex gap-4 p-4 bg-white border ${alert.border} rounded-2xl shadow-sm hover:translate-x-1 transition-transform cursor-pointer`}>
                <div className={`shrink-0 w-10 h-10 rounded-xl ${alert.color} flex items-center justify-center`}>
                  <alert.icon size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">{alert.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{alert.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Recent Activity Feed</h3>
          <div className="relative space-y-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
            {[
              { event: "Candidate submitted", user: "Sarah J.", target: "TechCorp - Sr. Dev", time: "2h ago", icon: UserRound, iconColor: "bg-blue-600" },
              { event: "Interview scheduled", user: "Mike R.", target: "Alex Rivera", time: "4h ago", icon: Calendar, iconColor: "bg-purple-600" },
              { event: "Offer accepted", user: "Emily B.", target: "Sam Wilson", time: "1d ago", icon: ClipboardList, iconColor: "bg-emerald-600" },
              { event: "Candidate joined", user: "David G.", target: "Jordan Smith", time: "1d ago", icon: CheckCircle, iconColor: "bg-pink-600" },
            ].map((item, i) => (
              <div key={i} className="relative flex gap-5 pl-7">
                <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-lg ${item.iconColor} flex items-center justify-center text-white z-10 shadow-sm ring-4 ring-white`}>
                  <item.icon size={10} />
                </div>
                <div>
                  <p className="text-[13px] text-slate-600 leading-snug">
                    <span className="font-black text-slate-900">{item.user}</span> {item.event} for <span className="font-bold text-slate-800">{item.target}</span>
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 font-black uppercase tracking-widest">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Revenue Snapshot (Agency Only)</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
                <p className="text-xl font-black text-slate-900 mt-1">$68,400</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                <p className="text-xl font-black text-slate-900 mt-1">$22,150</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Collection progress</span>
                <span className="text-[10px] font-black text-blue-600">75%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                <div className="bg-blue-600 h-full w-3/4 shadow-[0_0_10px_rgba(59,130,246,0.2)]"></div>
              </div>
            </div>

            <div className="h-[120px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
