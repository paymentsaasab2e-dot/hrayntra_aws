import React from 'react';
import { 
  Users, 
  UserCheck, 
  ShieldCheck, 
  Trophy, 
  DollarSign, 
  Clock, 
  TrendingUp,
  Search,
  Filter,
  Download,
  MoreVertical,
  Eye,
  Edit,
  Key,
  UserX,
  ChevronLeft,
  ChevronRight,
  Plus,
  BarChart3,
  Briefcase,
  Target,
  FileText,
  Mail,
  Phone,
  Calendar,
  Settings,
  Menu,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { ImageWithFallback } from './ImageWithFallback';

// --- Types ---

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string;
  department: string;
  joiningDate: string;
  manager: string;
  status: 'Active' | 'Suspended';
  lastLogin: string;
  assignedClients: number;
  assignedJobs: number;
  activeCandidates: number;
  placements: number;
  commissionEarned: number;
  revenueGenerated: number;
  performanceData: { month: string; value: number }[];
  monthlyTarget: number;
  revenueTarget: number;
  activityTarget: number;
};

// --- Mock Data ---

export const MOCK_TEAM: TeamMember[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    role: 'Senior Recruiter',
    email: 'sarah.j@saasa.com',
    phone: '+1 (555) 123-4567',
    avatar: 'https://images.unsplash.com/photo-1712168567859-e24cbc155219?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    department: 'Tech Recruitment',
    joiningDate: '2023-01-15',
    manager: 'Alex Thompson',
    status: 'Active',
    lastLogin: '2 mins ago',
    assignedClients: 12,
    assignedJobs: 8,
    activeCandidates: 45,
    placements: 28,
    commissionEarned: 14500,
    revenueGenerated: 85000,
    performanceData: [
      { month: 'Jan', value: 4 },
      { month: 'Feb', value: 6 },
      { month: 'Mar', value: 5 },
      { month: 'Apr', value: 8 },
    ],
    monthlyTarget: 10,
    revenueTarget: 30000,
    activityTarget: 100
  },
  {
    id: '2',
    name: 'Marcus Chen',
    role: 'Account Manager',
    email: 'm.chen@saasa.com',
    phone: '+1 (555) 987-6543',
    avatar: 'https://images.unsplash.com/photo-1544723495-432537d12f6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    department: 'Client Success',
    joiningDate: '2022-11-10',
    manager: 'Alex Thompson',
    status: 'Active',
    lastLogin: '1 hour ago',
    assignedClients: 25,
    assignedJobs: 4,
    activeCandidates: 12,
    placements: 15,
    commissionEarned: 9200,
    revenueGenerated: 62000,
    performanceData: [
      { month: 'Jan', value: 2 },
      { month: 'Feb', value: 3 },
      { month: 'Mar', value: 4 },
      { month: 'Apr', value: 3 },
    ],
    monthlyTarget: 5,
    revenueTarget: 20000,
    activityTarget: 50
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    role: 'Recruiter',
    email: 'elena.r@saasa.com',
    phone: '+1 (555) 456-7890',
    avatar: 'https://images.unsplash.com/photo-1688997794202-e53ca1356ea0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    department: 'Healthcare',
    joiningDate: '2023-06-20',
    manager: 'Sarah Jenkins',
    status: 'Active',
    lastLogin: 'Yesterday',
    assignedClients: 8,
    assignedJobs: 15,
    activeCandidates: 62,
    placements: 12,
    commissionEarned: 7800,
    revenueGenerated: 45000,
    performanceData: [
      { month: 'Jan', value: 1 },
      { month: 'Feb', value: 4 },
      { month: 'Mar', value: 3 },
      { month: 'Apr', value: 4 },
    ],
    monthlyTarget: 12,
    revenueTarget: 25000,
    activityTarget: 120
  },
  {
    id: '4',
    name: 'James Wilson',
    role: 'Finance',
    email: 'j.wilson@saasa.com',
    phone: '+1 (555) 222-3333',
    avatar: 'https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    department: 'Finance',
    joiningDate: '2022-01-05',
    manager: 'Alex Thompson',
    status: 'Suspended',
    lastLogin: '2 weeks ago',
    assignedClients: 0,
    assignedJobs: 0,
    activeCandidates: 0,
    placements: 0,
    commissionEarned: 0,
    revenueGenerated: 0,
    performanceData: [],
    monthlyTarget: 0,
    revenueTarget: 0,
    activityTarget: 0
  }
];

export const ROLES = [
  'Super Admin',
  'Admin',
  'Senior Recruiter',
  'Recruiter',
  'Account Manager',
  'Finance',
  'Viewer'
];

export const PERMISSIONS = [
  'Create Job',
  'Edit Job',
  'Delete Job',
  'View All Candidates',
  'View Assigned Candidates Only',
  'Access Billing',
  'Access Reports',
  'Export Data',
  'Manage Team',
  'Manage Settings'
];

// --- Components ---

export const StatCard = ({ title, value, icon: Icon, trend, color }: { title: string, value: string | number, icon: any, trend?: string, color: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
    <div className="flex items-center justify-between mb-2">
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={`size-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend}
        </span>
      )}
    </div>
    <span className="text-slate-500 text-sm font-medium">{title}</span>
    <span className="text-2xl font-bold text-slate-900">{value}</span>
  </div>
);

export const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'active' | 'suspended' | 'role' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-600',
    active: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    suspended: 'bg-rose-50 text-rose-600 border border-rose-100',
    role: 'bg-blue-50 text-blue-600 border border-blue-100'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${styles[variant]}`}>
      {children}
    </span>
  );
};

export const IconButton = ({ icon: Icon, onClick, className = '' }: { icon: any, onClick?: () => void, className?: string }) => (
  <button 
    onClick={onClick}
    className={`p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-900 transition-colors ${className}`}
  >
    <Icon className="size-4" />
  </button>
);
