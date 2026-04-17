import React from 'react';
import { Calendar, Clock, MessageSquare, CheckCircle } from 'lucide-react';

export function InterviewSummaryCards() {
  const cards = [
    {
      title: "Today's Interviews",
      count: 8,
      icon: Calendar,
      color: "bg-blue-500",
      lightColor: "bg-blue-50",
      textColor: "text-blue-600"
    },
    {
      title: "Upcoming Interviews",
      count: 24,
      icon: Clock,
      color: "bg-amber-500",
      lightColor: "bg-amber-50",
      textColor: "text-amber-600"
    },
    {
      title: "Pending Feedback",
      count: 12,
      icon: MessageSquare,
      color: "bg-purple-500",
      lightColor: "bg-purple-50",
      textColor: "text-purple-600"
    },
    {
      title: "Completed Interviews",
      count: 156,
      icon: CheckCircle,
      color: "bg-emerald-500",
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div 
          key={card.title}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group cursor-default"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{card.count}</h3>
            </div>
            <div className={`p-2 rounded-lg ${card.lightColor} group-hover:scale-110 transition-transform`}>
              <card.icon className={`size-5 ${card.textColor}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              +12%
            </span>
            <span className="text-[10px] text-slate-400 font-medium">vs last month</span>
          </div>
        </div>
      ))}
    </div>
  );
}
