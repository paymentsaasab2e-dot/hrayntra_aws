'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Download, 
  Search, 
  Filter, 
  ChevronRight, 
  MoreHorizontal, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  CreditCard,
  Users,
  Briefcase,
  PieChart,
  Settings,
  Send,
  ExternalLink,
  ChevronDown,
  Mail,
  Bell,
  Building2,
  FileCheck2,
  Receipt,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from '../../components/ImageWithFallback';

// --- Types ---

type PaymentStatus = 'Paid' | 'Partial' | 'Pending' | 'Overdue';

interface Invoice {
  id: string;
  clientName: string;
  jobReference: string;
  candidateName: string;
  date: string;
  dueDate: string;
  amount: number;
  tax: number;
  total: number;
  status: PaymentStatus;
}

interface Payment {
  id: string;
  clientName: string;
  invoiceId: string;
  amount: number;
  mode: string;
  transactionId: string;
  date: string;
  receivedBy: string;
  status: 'Confirmed' | 'Pending';
}

interface Placement {
  candidate: string;
  jobTitle: string;
  client: string;
  joiningDate: string;
  billingType: 'Fixed' | '% of CTC';
  fee: number;
  invoiceGenerated: boolean;
  status: string;
}

interface ClientContract {
  name: string;
  type: string;
  feeStructure: string;
  replacementPeriod: string;
  terms: number;
  taxDetails: string;
  currency: string;
}

interface Commission {
  recruiter: string;
  placement: string;
  percentage: number;
  amount: number;
  status: 'Paid' | 'Processing' | 'Pending';
  date: string;
}

// --- Mock Data ---

const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-2026-001', clientName: 'TechCorp Solutions', jobReference: 'SR-DEV-04', candidateName: 'Alex Rivera', date: '2026-02-01', dueDate: '2026-02-15', amount: 12000, tax: 2160, total: 14160, status: 'Paid' },
  { id: 'INV-2026-002', clientName: 'FinLeap Systems', jobReference: 'FIN-ANL-12', candidateName: 'Sarah Jenkins', date: '2026-02-03', dueDate: '2026-02-17', amount: 8500, tax: 1530, total: 10030, status: 'Pending' },
  { id: 'INV-2026-003', clientName: 'Innovate AI', jobReference: 'AI-ENG-09', candidateName: 'Michael Chen', date: '2026-01-20', dueDate: '2026-02-04', amount: 15000, tax: 2700, total: 17700, status: 'Overdue' },
  { id: 'INV-2026-004', clientName: 'Global Logistics', jobReference: 'LOG-OPS-22', candidateName: 'Elena Gilbert', date: '2026-02-05', dueDate: '2026-02-20', amount: 5000, tax: 900, total: 5900, status: 'Partial' },
  { id: 'INV-2026-005', clientName: 'BioHealth Research', jobReference: 'BIO-RES-01', candidateName: 'David Miller', date: '2026-02-07', dueDate: '2026-02-22', amount: 11000, tax: 1980, total: 12980, status: 'Pending' },
];

const MOCK_PAYMENTS: Payment[] = [
  { id: 'PAY-8821', clientName: 'TechCorp Solutions', invoiceId: 'INV-2026-001', amount: 14160, mode: 'Bank Transfer', transactionId: 'TXN-9928311', date: '2026-02-05', receivedBy: 'Admin Team', status: 'Confirmed' },
  { id: 'PAY-8822', clientName: 'Global Logistics', invoiceId: 'INV-2026-004', amount: 3000, mode: 'Online', transactionId: 'TXN-9928355', date: '2026-02-08', receivedBy: 'Auto-processor', status: 'Confirmed' },
  { id: 'PAY-8823', clientName: 'Innovate AI', invoiceId: 'INV-2026-003', amount: 5000, mode: 'Cheque', transactionId: 'CHQ-44512', date: '2026-02-09', receivedBy: 'Finance Dept', status: 'Pending' },
];

const MOCK_PLACEMENTS: Placement[] = [
  { candidate: 'James Wilson', jobTitle: 'Product Manager', client: 'RetailFlow', joiningDate: '2026-03-01', billingType: '% of CTC', fee: 18000, invoiceGenerated: false, status: 'Upcoming' },
  { candidate: 'Sophia Lee', jobTitle: 'UX Designer', client: 'CreativHaus', joiningDate: '2026-02-15', billingType: 'Fixed', fee: 7500, invoiceGenerated: true, status: 'Active' },
  { candidate: 'Robert Brown', jobTitle: 'DevOps Engineer', client: 'CloudScalers', joiningDate: '2026-02-01', billingType: 'Fixed', fee: 12500, invoiceGenerated: true, status: 'Active' },
];

const MOCK_CLIENTS: ClientContract[] = [
  { name: 'TechCorp Solutions', type: 'Premium', feeStructure: '20% of Annual CTC', replacementPeriod: '90 Days', terms: 15, taxDetails: 'VAT 18%', currency: 'USD' },
  { name: 'FinLeap Systems', type: 'Standard', feeStructure: '15% of Annual CTC', replacementPeriod: '60 Days', terms: 30, taxDetails: 'GST 12%', currency: 'EUR' },
  { name: 'Innovate AI', type: 'Enterprise', feeStructure: '$15,000 Fixed Fee', replacementPeriod: '120 Days', terms: 45, taxDetails: 'Tax Exempt', currency: 'USD' },
];

const MOCK_COMMISSIONS: Commission[] = [
  { recruiter: 'Jane Doe', placement: 'Alex Rivera (TechCorp)', percentage: 10, amount: 1200, status: 'Paid', date: '2026-02-06' },
  { recruiter: 'John Smith', placement: 'Michael Chen (Innovate AI)', percentage: 12, amount: 1800, status: 'Pending', date: '-' },
  { recruiter: 'Jane Doe', placement: 'Elena Gilbert (Global Log)', percentage: 10, amount: 500, status: 'Processing', date: '2026-02-09' },
];

// --- Sub-components ---

const Badge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    Paid: 'bg-green-50 text-green-700 border-green-200',
    Confirmed: 'bg-green-50 text-green-700 border-green-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Partial: 'bg-blue-50 text-blue-700 border-blue-200',
    Overdue: 'bg-red-50 text-red-700 border-red-200',
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Upcoming: 'bg-slate-50 text-slate-700 border-slate-200',
    Yes: 'bg-green-50 text-green-700 border-green-200',
    No: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${styles[status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
      {status}
    </span>
  );
};


const KPICard = ({ title, amount, subtext, trend, trendType }: { title: string, amount: string, subtext: string, trend?: string, trendType?: 'up' | 'down' }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 min-w-[180px] flex-1">
    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
    <div className="flex items-end justify-between">
      <span className="text-xl font-bold text-slate-900">{amount}</span>
      {trend && (
        <div className={`flex items-center text-[10px] font-bold ${trendType === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trendType === 'up' ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
          {trend}
        </div>
      )}
    </div>
    <span className="text-[10px] text-slate-400">{subtext}</span>
  </div>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap">
    {children}
  </th>
);

const TableCell = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <td className={`px-4 py-3 text-sm text-slate-600 border-b border-slate-50 ${className}`}>
    {children}
  </td>
);

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('Invoices');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { name: 'Invoices', icon: Receipt },
    { name: 'Payments', icon: CreditCard },
    { name: 'Placements Billing', icon: Briefcase },
    { name: 'Clients & Contracts', icon: Building2 },
    { name: 'Commission & Payouts', icon: Wallet },
    { name: 'Taxes & Compliance', icon: FileCheck2 },
    { name: 'Billing Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden font-['Inter',sans-serif]">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search invoices, clients, candidates..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="h-8 w-px bg-slate-200"></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
            <Plus size={18} />
            Create Invoice
          </button>
        </div>
      </header>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Page Title & Breadcrumbs */}
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Finance</span>
                <ChevronRight size={10} />
                <span className="text-blue-600">Billing Overview</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Billing</h1>
              <p className="text-sm text-slate-500">Track invoices, payments, placements revenue, and commissions</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
                <Calendar size={14} />
                Feb 01 - Feb 28, 2026
                <ChevronDown size={14} />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">
                <Download size={14} />
                Export
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard title="Total Billed" amount="$124,500" subtext="In 14 invoices" trend="+12%" trendType="up" />
            <KPICard title="Total Received" amount="$98,200" subtext="78.8% collected" trend="+5%" trendType="up" />
            <KPICard title="Pending" amount="$18,400" subtext="5 invoices pending" />
            <KPICard title="Overdue" amount="$7,900" subtext="3 invoices overdue" trend="-2%" trendType="down" />
            <KPICard title="This Month Revenue" amount="$42,100" subtext="Forecast: $55k" trend="+8%" trendType="up" />
            <KPICard title="Next Payout" amount="$12,400" subtext="Due on Feb 15" />
          </div>

          {/* Tabs Navigation */}
          <div className="border-b border-slate-200 flex items-center gap-8 overflow-x-auto no-scrollbar pt-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center gap-2 pb-4 text-sm font-bold transition-all border-b-2 relative whitespace-nowrap ${
                    isActive 
                      ? 'text-blue-600 border-blue-600' 
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Dynamic Content Based on Tabs */}
          <div className="space-y-6 pb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'Invoices' && <InvoicesView />}
                {activeTab === 'Payments' && <PaymentsView />}
                {activeTab === 'Placements Billing' && <PlacementsView />}
                {activeTab === 'Clients & Contracts' && <ClientsView />}
                {activeTab === 'Commission & Payouts' && <CommissionsView />}
                {activeTab === 'Taxes & Compliance' && <TaxesView />}
                {activeTab === 'Billing Settings' && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
    </div>
  );
}

// --- Tab Views ---

function InvoicesView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-50">
            <Filter size={14} />
            Filters
          </button>
          <div className="h-7 w-px bg-slate-200"></div>
          <select className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer">
            <option>All Statuses</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Overdue</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">Showing 1-10 of 124 invoices</span>
          <div className="flex gap-1">
            <button className="p-1 rounded hover:bg-slate-200 disabled:opacity-30" disabled><ChevronRight size={16} className="rotate-180" /></button>
            <button className="p-1 rounded hover:bg-slate-200"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <TableHeader>Invoice ID</TableHeader>
              <TableHeader>Client Name</TableHeader>
              <TableHeader>Job / Placement</TableHeader>
              <TableHeader>Candidate</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Due Date</TableHeader>
              <TableHeader>Amount</TableHeader>
              <TableHeader>Tax</TableHeader>
              <TableHeader>Total</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>{' '}</TableHeader>
            </tr>
          </thead>
          <tbody>
            {MOCK_INVOICES.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-bold text-blue-600">{inv.id}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{inv.clientName}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Client ID: TC-44</span>
                  </div>
                </TableCell>
                <TableCell>{inv.jobReference}</TableCell>
                <TableCell>{inv.candidateName}</TableCell>
                <TableCell>{inv.date}</TableCell>
                <TableCell>{inv.dueDate}</TableCell>
                <TableCell>${inv.amount.toLocaleString()}</TableCell>
                <TableCell className="text-slate-400">${inv.tax.toLocaleString()}</TableCell>
                <TableCell className="font-bold text-slate-900">${inv.total.toLocaleString()}</TableCell>
                <TableCell><Badge status={inv.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button title="Download" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Download size={14} /></button>
                    <button title="Send Reminder" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Send size={14} /></button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><MoreHorizontal size={14} /></button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <TableHeader>Payment ID</TableHeader>
              <TableHeader>Client Name</TableHeader>
              <TableHeader>Invoice ID</TableHeader>
              <TableHeader>Amount Received</TableHeader>
              <TableHeader>Mode</TableHeader>
              <TableHeader>Transaction ID</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Received By</TableHeader>
              <TableHeader>Status</TableHeader>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAYMENTS.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-bold text-slate-900">{p.id}</TableCell>
                <TableCell className="font-medium">{p.clientName}</TableCell>
                <TableCell className="text-blue-600 font-medium cursor-pointer hover:underline">{p.invoiceId}</TableCell>
                <TableCell className="font-bold text-green-600">${p.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-slate-400" />
                    {p.mode}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[11px] text-slate-500 uppercase">{p.transactionId}</TableCell>
                <TableCell>{p.date}</TableCell>
                <TableCell>{p.receivedBy}</TableCell>
                <TableCell><Badge status={p.status} /></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlacementsView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <TableHeader>Candidate</TableHeader>
              <TableHeader>Job Title</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Joining Date</TableHeader>
              <TableHeader>Billing Type</TableHeader>
              <TableHeader>Agreed Fee</TableHeader>
              <TableHeader>Invoice Generated</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Action</TableHeader>
            </tr>
          </thead>
          <tbody>
            {MOCK_PLACEMENTS.map((pl, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-medium text-slate-900">{pl.candidate}</TableCell>
                <TableCell>{pl.jobTitle}</TableCell>
                <TableCell>{pl.client}</TableCell>
                <TableCell>{pl.joiningDate}</TableCell>
                <TableCell>{pl.billingType}</TableCell>
                <TableCell className="font-bold">${pl.fee.toLocaleString()}</TableCell>
                <TableCell><Badge status={pl.invoiceGenerated ? 'Yes' : 'No'} /></TableCell>
                <TableCell><Badge status={pl.status} /></TableCell>
                <TableCell>
                  {!pl.invoiceGenerated && (
                    <button className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded">Generate Invoice</button>
                  )}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <TableHeader>Client Name</TableHeader>
              <TableHeader>Contract Type</TableHeader>
              <TableHeader>Fee Structure</TableHeader>
              <TableHeader>Replacement Period</TableHeader>
              <TableHeader>Payment Terms</TableHeader>
              <TableHeader>Tax Details</TableHeader>
              <TableHeader>Currency</TableHeader>
              <TableHeader>Actions</TableHeader>
            </tr>
          </thead>
          <tbody>
            {MOCK_CLIENTS.map((c, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-bold text-slate-900">{c.name}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.type === 'Premium' ? 'bg-amber-100 text-amber-700' : c.type === 'Enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                    {c.type}
                  </span>
                </TableCell>
                <TableCell>{c.feeStructure}</TableCell>
                <TableCell>{c.replacementPeriod}</TableCell>
                <TableCell>{c.terms} Days</TableCell>
                <TableCell>{c.taxDetails}</TableCell>
                <TableCell className="font-bold">{c.currency}</TableCell>
                <TableCell>
                  <button className="text-xs font-bold text-blue-600 hover:underline">Edit Contract</button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommissionsView() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white">
              <TableHeader>Recruiter Name</TableHeader>
              <TableHeader>Placement Reference</TableHeader>
              <TableHeader>Comm %</TableHeader>
              <TableHeader>Commission Amount</TableHeader>
              <TableHeader>Payout Status</TableHeader>
              <TableHeader>Payout Date</TableHeader>
              <TableHeader>Actions</TableHeader>
            </tr>
          </thead>
          <tbody>
            {MOCK_COMMISSIONS.map((com, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <TableCell className="font-medium text-slate-900">{com.recruiter}</TableCell>
                <TableCell className="text-xs">{com.placement}</TableCell>
                <TableCell>{com.percentage}%</TableCell>
                <TableCell className="font-bold text-slate-900">${com.amount.toLocaleString()}</TableCell>
                <TableCell><Badge status={com.status} /></TableCell>
                <TableCell>{com.date}</TableCell>
                <TableCell>
                  <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><MoreHorizontal size={14} /></button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxesView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider flex items-center gap-2">
          <Receipt size={18} className="text-blue-600" />
          Tax Summary (Current Qtr)
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-50">
            <span className="text-sm text-slate-500">Tax Collected (Output)</span>
            <span className="text-sm font-bold text-slate-900">$18,450.00</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-50">
            <span className="text-sm text-slate-500">Tax Paid (Input Credit)</span>
            <span className="text-sm font-bold text-green-600">-$2,120.00</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <span className="text-sm font-bold text-slate-900 uppercase">Net Payable Tax</span>
            <span className="text-lg font-black text-slate-900">$16,330.00</span>
          </div>
          <div className="pt-4 flex gap-3">
            <button className="flex-1 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800">
              Pay Tax Now
            </button>
            <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-50">
              Download Report
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 size={18} className="text-green-600" />
          Compliance Status
        </h3>
        <div className="space-y-4">
          <div className="p-3 bg-green-50 rounded-lg flex items-start gap-3 border border-green-100">
            <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-green-900 uppercase">Quarterly Filing (Q4 2025)</p>
              <p className="text-[11px] text-green-700">Successfully filed on Jan 15, 2026. Acknowledgement #ACK-98211</p>
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg flex items-start gap-3 border border-amber-100">
            <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900 uppercase">Annual Audit Reminder</p>
              <p className="text-[11px] text-amber-700">Financial year audit due in 45 days. Please prepare documents.</p>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg flex items-start gap-3 border border-slate-200">
            <AlertCircle size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase">Tax Configuration</p>
              <p className="text-[11px] text-slate-500">Review your 2026 tax rate updates for International clients.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Invoicing Configuration</h3>
          <p className="text-xs text-slate-500 leading-relaxed">Customize how your invoices are generated and numbered.</p>
        </div>
        <div className="md:col-span-2 space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Invoice Number Format</label>
            <div className="flex gap-2">
              <input type="text" value="INV-" className="w-20 p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" readOnly />
              <input type="text" value="YYYY-" className="w-20 p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" readOnly />
              <input type="text" placeholder="001" className="flex-1 p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Default Currency</label>
              <select className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                <option>USD ($)</option>
                <option>EUR (€)</option>
                <option>GBP (£)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Default Payment Terms</label>
              <select className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                <option>Net 15 Days</option>
                <option>Net 30 Days</option>
                <option>Net 45 Days</option>
                <option>Due on Receipt</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-slate-100">
        <div className="md:col-span-1">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Company & Bank Details</h3>
          <p className="text-xs text-slate-500 leading-relaxed">These details will appear on the footer of your invoices.</p>
        </div>
        <div className="md:col-span-2 space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Bank Name</label>
            <input type="text" placeholder="Global Trust Bank" className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Account Number</label>
              <input type="text" placeholder="**** **** 8822" className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">SWIFT/BIC Code</label>
              <input type="text" placeholder="GTB-US-99" className="w-full p-2 border border-slate-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-sm">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
