'use client';

import React, { useState } from 'react';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Search, 
  Bell, 
  ChevronDown, 
  Filter, 
  Download, 
  Mail, 
  Clock, 
  Target, 
  Phone, 
  FileText,
  ChevronRight,
  Menu,
  MoreVertical,
  Plus,
  Briefcase,
  Users,
  UserPlus,
  Settings
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  AreaChart, 
  Area,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Funnel,
  FunnelChart,
  LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../../components/ImageWithFallback';

// --- Types ---
type ReportTab = 
  | 'Recruitment Performance'
  | 'Pipeline & Funnel'
  | 'Jobs & Clients'
  | 'Candidates'
  | 'Interviews'
  | 'Placements & Revenue'
  | 'Team Performance'
  | 'Activity & Productivity'
  | 'Custom Reports';

// --- Mock Data ---

const PERFORMANCE_DATA = [
  { name: 'Jan', openJobs: 40, placements: 24, candidates: 240 },
  { name: 'Feb', openJobs: 45, placements: 28, candidates: 280 },
  { name: 'Mar', openJobs: 52, placements: 32, candidates: 320 },
  { name: 'Apr', openJobs: 48, placements: 30, candidates: 300 },
  { name: 'May', openJobs: 60, placements: 38, candidates: 380 },
  { name: 'Jun', openJobs: 65, placements: 42, candidates: 420 },
];

const FUNNEL_DATA = [
  { value: 1000, name: 'Applied', fill: '#94a3b8' },
  { value: 600, name: 'Shortlisted', fill: '#64748b' },
  { value: 400, name: 'Submitted', fill: '#475569' },
  { value: 200, name: 'Interviewed', fill: '#334155' },
  { value: 80, name: 'Offered', fill: '#1e293b' },
  { value: 65, name: 'Joined', fill: '#0f172a' },
];

const CLIENT_DATA = [
  { name: 'TechCorp', volume: 45 },
  { name: 'FinFlow', volume: 32 },
  { name: 'HealthNet', volume: 28 },
  { name: 'RetailX', volume: 25 },
  { name: 'EduSmart', volume: 18 },
];

const SOURCE_DATA = [
  { name: 'LinkedIn', value: 450 },
  { name: 'Referral', value: 200 },
  { name: 'Job Board', value: 300 },
  { name: 'Direct', value: 150 },
];

const REVENUE_DATA = [
  { month: 'Jan', revenue: 120000 },
  { month: 'Feb', revenue: 145000 },
  { month: 'Mar', revenue: 132000 },
  { month: 'Apr', revenue: 158000 },
  { month: 'May', revenue: 185000 },
  { month: 'Jun', revenue: 210000 },
];

const TEAM_PERFORMANCE = [
  { id: 1, name: 'Sarah Miller', jobs: 12, submissions: 45, interviews: 18, placements: 5, rank: 1 },
  { id: 2, name: 'James Wilson', jobs: 10, submissions: 38, interviews: 15, placements: 4, rank: 2 },
  { id: 3, name: 'Emily Chen', jobs: 15, submissions: 52, interviews: 22, placements: 4, rank: 3 },
  { id: 4, name: 'Michael Ross', jobs: 8, submissions: 30, interviews: 12, placements: 3, rank: 4 },
  { id: 5, name: 'Anna Taylor', jobs: 14, submissions: 48, interviews: 20, placements: 3, rank: 5 },
];

const ACTIVITY_DATA = [
  { day: 'Mon', calls: 120, emails: 340, tasks: 45 },
  { day: 'Tue', calls: 150, emails: 380, tasks: 52 },
  { day: 'Wed', calls: 140, emails: 360, tasks: 48 },
  { day: 'Thu', calls: 160, emails: 400, tasks: 55 },
  { day: 'Fri', calls: 130, emails: 320, tasks: 42 },
];

// --- Components ---

const Card = ({ title, children, className = "" }: { title?: string, children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const KPICard = ({ label, value, trend, icon: Icon, color }: { label: string, value: string | number, trend?: string, icon: any, color: string }) => (
  <Card className="flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
        <Icon size={20} className={color.replace('bg-', 'text-')} />
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {trend}
        </span>
      )}
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
    <div className="text-sm text-slate-500 mt-1">{label}</div>
  </Card>
);

const SectionHeader = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

// --- Sub-Views ---

const RecruitmentPerformance = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard label="Total Open Jobs" value="156" trend="+12%" icon={Briefcase} color="bg-blue-600" />
      <KPICard label="Active Candidates" value="2,845" trend="+5%" icon={Users} color="bg-purple-600" />
      <KPICard label="Interviews" value="48" trend="+18%" icon={Calendar} color="bg-orange-600" />
      <KPICard label="Offers Released" value="12" trend="+2%" icon={FileText} color="bg-indigo-600" />
      <KPICard label="Placements" value="8" trend="+14%" icon={CheckCircle2} color="bg-green-600" />
      <KPICard label="Conversion %" value="15.4%" trend="+1.2%" icon={TrendingUp} color="bg-pink-600" />
    </div>

    <Card title="Recruitment Activity Overview">
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={PERFORMANCE_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" />
            <Line type="monotone" dataKey="openJobs" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Open Jobs" />
            <Line type="monotone" dataKey="placements" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Placements" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
);

const PipelineFunnel = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Hiring Funnel (Aggregated)">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Funnel dataKey="value" data={FUNNEL_DATA} isAnimationActive>
                <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </Card>
      
      <Card title="Stage-wise Candidate Distribution">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={FUNNEL_DATA} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32}>
                {FUNNEL_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  </div>
);

const JobsClients = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Active Job Status">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Job Title</th>
                <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Client</th>
                <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Status</th>
                <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Candidates</th>
                <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { title: 'Senior React Developer', client: 'TechCorp', status: 'Active', count: 24, aging: '12 days', color: 'bg-green-100 text-green-700' },
                { title: 'Product Manager', client: 'FinFlow', status: 'Urgent', count: 18, aging: '45 days', color: 'bg-red-100 text-red-700' },
                { title: 'Data Scientist', client: 'HealthNet', status: 'On Hold', count: 8, aging: '62 days', color: 'bg-slate-100 text-slate-700' },
                { title: 'UI/UX Designer', client: 'RetailX', status: 'Active', count: 32, aging: '5 days', color: 'bg-green-100 text-green-700' },
                { title: 'DevOps Engineer', client: 'EduSmart', status: 'Active', count: 14, aging: '28 days', color: 'bg-green-100 text-green-700' },
              ].map((job, idx) => (
                <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-slate-900">{job.title}</td>
                  <td className="py-4 text-sm text-slate-600">{job.client}</td>
                  <td className="py-4 text-xs">
                    <span className={`px-2 py-1 rounded-full font-medium ${job.color}`}>{job.status}</span>
                  </td>
                  <td className="py-4 text-sm text-slate-600">{job.count}</td>
                  <td className="py-4 text-sm text-slate-600">{job.aging}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      <Card title="Top Clients by Volume">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CLIENT_DATA}>
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="volume" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {CLIENT_DATA.map((client, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{client.name}</span>
              <span className="font-semibold text-slate-900">{client.volume} Jobs</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

const CandidateReports = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Candidate Sourcing Channels">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={SOURCE_DATA}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {SOURCE_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#2563eb', '#8b5cf6', '#f59e0b', '#10b981'][index % 4]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="bottom" align="center" />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Skill Distribution">
        <div className="space-y-4">
          {[
            { skill: 'React.js', count: 450, percentage: 85 },
            { skill: 'Node.js', count: 320, percentage: 65 },
            { skill: 'Python', count: 280, percentage: 55 },
            { skill: 'AWS', count: 210, percentage: 45 },
            { skill: 'Figma', count: 180, percentage: 35 },
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">{item.skill}</span>
                <span className="text-slate-500">{item.count} Candidates</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

const InterviewReports = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Scheduled vs Completed Interviews">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PERFORMANCE_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar dataKey="candidates" name="Scheduled" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="placements" name="Completed" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      
      <Card title="Interviewer Feedback Pending">
        <div className="space-y-4">
          {[
            { name: 'John Doe', pending: 5, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=faces' },
            { name: 'Jane Smith', pending: 3, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=faces' },
            { name: 'Robert Fox', pending: 2, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=faces' },
            { name: 'Alice Wong', pending: 2, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop&crop=faces' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-3">
                <ImageWithFallback src={item.avatar} alt={item.name} className="w-8 h-8 rounded-full" />
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
              <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded-md">
                {item.pending} Pending
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

const PlacementsRevenue = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <KPICard label="Total Placements" value="48" trend="+15%" icon={Target} color="bg-green-600" />
      <KPICard label="Total Revenue" value="$842,500" trend="+22%" icon={TrendingUp} color="bg-blue-600" />
      <KPICard label="Avg. Billing" value="$17,552" trend="+4%" icon={BarChart3} color="bg-indigo-600" />
    </div>

    <Card title="Revenue Trend (Last 6 Months)">
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={REVENUE_DATA}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
            <Tooltip 
               contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
               formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
            />
            <Area type="monotone" dataKey="revenue" stroke="#2563eb" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
);

const TeamPerformanceView = () => (
  <Card title="Recruiter Leaderboard">
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Rank</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Recruiter</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Jobs Handled</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Submissions</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Interviews</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Placements</th>
            <th className="pb-4 pt-0 text-sm font-semibold text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {TEAM_PERFORMANCE.map((recruiter) => (
            <tr key={recruiter.id} className="group hover:bg-slate-50 transition-colors">
              <td className="py-4 text-sm">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                  recruiter.rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
                  recruiter.rank === 2 ? 'bg-slate-200 text-slate-700' : 
                  recruiter.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {recruiter.rank}
                </span>
              </td>
              <td className="py-4 text-sm font-medium text-slate-900">{recruiter.name}</td>
              <td className="py-4 text-sm text-slate-600">{recruiter.jobs}</td>
              <td className="py-4 text-sm text-slate-600">{recruiter.submissions}</td>
              <td className="py-4 text-sm text-slate-600">{recruiter.interviews}</td>
              <td className="py-4 text-sm font-semibold text-blue-600">{recruiter.placements}</td>
              <td className="py-4">
                <button className="text-slate-400 hover:text-blue-600 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ActivityProductivity = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <KPICard label="Calls Made" value="1,240" trend="+8%" icon={Phone} color="bg-blue-600" />
      <KPICard label="Emails Sent" value="4,820" trend="+12%" icon={Mail} color="bg-purple-600" />
      <KPICard label="Tasks Completed" value="385" trend="+5%" icon={CheckCircle2} color="bg-green-600" />
      <KPICard label="Overdue Tasks" value="12" trend="-4%" icon={Clock} color="bg-red-600" />
    </div>

    <Card title="Daily Activity Trend">
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ACTIVITY_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip 
               contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            />
            <Legend />
            <Bar dataKey="calls" name="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="emails" name="Emails" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="tasks" name="Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
);

const CustomReports = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <Card className="lg:col-span-1" title="Report Builder">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Data Source</label>
          <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
            <option>Jobs</option>
            <option>Candidates</option>
            <option>Interviews</option>
            <option>Placements</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Columns</label>
          <div className="space-y-2">
            {['ID', 'Title', 'Client', 'Status', 'Date Created', 'Owner', 'Hiring Manager'].map((col) => (
              <label key={col} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                <span className="text-sm text-slate-600">{col}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
          Generate Report
        </button>
      </div>
    </Card>

    <Card className="lg:col-span-2" title="Report Preview">
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <div className="p-4 bg-slate-50 rounded-full mb-4">
          <FileText size={48} className="text-slate-300" />
        </div>
        <h4 className="font-semibold text-slate-800">No Custom Data Selected</h4>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">Select a data source and columns on the left to generate a preview of your custom report.</p>
        
        <div className="mt-8 flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
            <Download size={16} /> Save Template
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
            <Plus size={16} /> Create New
          </button>
        </div>
      </div>
    </Card>
  </div>
);

// --- Main Application ---

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('Recruitment Performance');

  const tabs: ReportTab[] = [
    'Recruitment Performance',
    'Pipeline & Funnel',
    'Jobs & Clients',
    'Candidates',
    'Interviews',
    'Placements & Revenue',
    'Team Performance',
    'Activity & Productivity',
    'Custom Reports'
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Recruitment Performance': return <RecruitmentPerformance />;
      case 'Pipeline & Funnel': return <PipelineFunnel />;
      case 'Jobs & Clients': return <JobsClients />;
      case 'Candidates': return <CandidateReports />;
      case 'Interviews': return <InterviewReports />;
      case 'Placements & Revenue': return <PlacementsRevenue />;
      case 'Team Performance': return <TeamPerformanceView />;
      case 'Activity & Productivity': return <ActivityProductivity />;
      case 'Custom Reports': return <CustomReports />;
      default: return <RecruitmentPerformance />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Filters Sticky Bar */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-10 px-8 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <Calendar size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Last 30 Days</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
          
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all">
            <option>All Clients</option>
            <option>TechCorp</option>
            <option>FinFlow</option>
          </select>

          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all">
            <option>All Jobs</option>
            <option>Developer</option>
            <option>Manager</option>
          </select>

          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all">
            <option>All Recruiters</option>
            <option>Sarah Miller</option>
            <option>James Wilson</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all shadow-sm">
              Apply Filters
            </button>
            <button className="px-4 py-2 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-8 flex overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all relative ${
              activeTab === tab 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTab" 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" 
              />
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <SectionHeader 
            title={activeTab} 
            subtitle={`Detailed insights and performance data for ${activeTab.toLowerCase()}.`} 
          />
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <Download size={16} /> Export CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <FileText size={16} /> PDF Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <Mail size={16} /> Schedule
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
