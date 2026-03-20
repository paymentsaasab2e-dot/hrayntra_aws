import React from 'react';
import { 
  Users, 
  UserCheck, 
  CalendarClock, 
  CheckCircle2, 
  DollarSign 
} from 'lucide-react';

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

const SummaryCard = ({ label, value, icon: Icon, color }: SummaryCardProps) => (
  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4 flex-1 min-w-[200px]">
    <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export const PlacementSummaryCards = () => {
  const stats = [
    { label: 'Total Placements', value: '124', icon: Users, color: 'bg-blue-600' },
    { label: 'Placements This Month', value: '12', icon: CalendarClock, color: 'bg-indigo-600' },
    { label: 'Joining Pending', value: '8', icon: UserCheck, color: 'bg-amber-500' },
    { label: 'Joined', value: '116', icon: CheckCircle2, color: 'bg-emerald-600' },
    { label: 'Revenue Generated', value: '$240,000', icon: DollarSign, color: 'bg-violet-600' },
  ];

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {stats.map((stat, idx) => (
        <SummaryCard key={idx} {...stat} />
      ))}
    </div>
  );
};
