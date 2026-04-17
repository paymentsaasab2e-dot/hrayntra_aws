'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Video, Phone, Users, ExternalLink, Calendar, MapPin, MessageSquare, RotateCcw } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

const INTERVIEWS = [
  {
    id: 1,
    candidate: {
      name: 'Sarah Jenkins',
      email: 'sarah.j@example.com',
      avatar: 'https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90JTIwcHJvZmlsZXxlbnwxfHx8fDE3NzA1MzYzMTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    },
    job: 'Senior UX Designer',
    client: 'Fintech Solutions',
    round: 'Technical',
    mode: 'Video',
    dateTime: 'Feb 10, 2026 - 10:00 AM',
    interviewers: ['Mike Ross', 'Harvey Specter'],
    status: 'Scheduled',
    feedback: 'Pending'
  },
  {
    id: 2,
    candidate: {
      name: 'David Chen',
      email: 'd.chen@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1652471943570-f3590a4e52ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHByb2ZpbGV8ZW58MXx8fHwxNzcwNTM2MzE1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    },
    job: 'Fullstack Engineer',
    client: 'EcoStream',
    round: 'HR Round',
    mode: 'Telephonic',
    dateTime: 'Feb 10, 2026 - 02:30 PM',
    interviewers: ['Jessica Pearson'],
    status: 'Completed',
    feedback: 'Submitted'
  },
  {
    id: 3,
    candidate: {
      name: 'Emma Watson',
      email: 'emma.w@outlook.com',
      avatar: 'https://images.unsplash.com/photo-1701463387028-3947648f1337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdCUyMGF2YXRhciUyMGNhbmRpZGF0ZXxlbnwxfHx8fDE3NzA1MzYzMDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    },
    job: 'Product Manager',
    client: 'Global Logistics',
    round: 'Client Round',
    mode: 'In-Person',
    dateTime: 'Feb 11, 2026 - 11:00 AM',
    interviewers: ['Louis Litt', 'Donna Paulsen'],
    status: 'Scheduled',
    feedback: 'Pending'
  },
  {
    id: 4,
    candidate: {
      name: 'Michael Brown',
      email: 'm.brown@tech.com',
      avatar: ''
    },
    job: 'Backend Lead',
    client: 'CloudScale',
    round: 'Final Round',
    mode: 'Video',
    dateTime: 'Feb 12, 2026 - 04:00 PM',
    interviewers: ['Rachel Zane'],
    status: 'Rescheduled',
    feedback: 'Pending'
  },
  {
    id: 5,
    candidate: {
      name: 'Sophia Miller',
      email: 'sophia.m@creative.com',
      avatar: 'https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90JTIwcHJvZmlsZXxlbnwxfHx8fDE3NzA1MzYzMTN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    },
    job: 'Content Strategist',
    client: 'MediaHub',
    round: 'Technical',
    mode: 'Video',
    dateTime: 'Feb 08, 2026 - 09:00 AM',
    interviewers: ['Robert Zane'],
    status: 'Cancelled',
    feedback: '-'
  }
];

interface InterviewTableProps {
  onAddFeedback: (interview: any) => void;
  onReschedule?: (interview: any) => void;
  searchQuery: string;
}

export function InterviewTable({ onAddFeedback, onReschedule, searchQuery }: InterviewTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [selectedInterviews, setSelectedInterviews] = useState<Set<number>>(new Set());
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const filteredInterviews = INTERVIEWS.filter(item => 
    item.candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.job.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId !== null) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Rescheduled': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getFeedbackStyle = (status: string) => {
    switch (status) {
      case 'Submitted': return 'text-emerald-600 font-semibold';
      case 'Pending': return 'text-amber-600 font-medium';
      default: return 'text-slate-400';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'Video': return <Video className="size-3.5" />;
      case 'Telephonic': return <Phone className="size-3.5" />;
      case 'In-Person': return <MapPin className="size-3.5" />;
      default: return null;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInterviews(new Set(filteredInterviews.map(interview => interview.id)));
    } else {
      setSelectedInterviews(new Set());
    }
  };

  const handleSelectInterview = (interviewId: number, checked: boolean) => {
    const newSelected = new Set(selectedInterviews);
    if (checked) {
      newSelected.add(interviewId);
    } else {
      newSelected.delete(interviewId);
    }
    setSelectedInterviews(newSelected);
  };

  const isAllSelected = filteredInterviews.length > 0 && selectedInterviews.size === filteredInterviews.length;
  const isIndeterminate = selectedInterviews.size > 0 && selectedInterviews.size < filteredInterviews.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40px]">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                />
              </th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[20%]">Candidate</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[18%]">Job / Client</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Round / Mode</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Interviewer(s)</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Feedback</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInterviews.map((interview) => (
              <tr key={interview.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedInterviews.has(interview.id)}
                    onChange={(e) => handleSelectInterview(interview.id, e.target.checked)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full overflow-hidden shrink-0 border border-slate-200">
                      <ImageWithFallback 
                        src={interview.candidate.avatar} 
                        alt={interview.candidate.name}
                        className="size-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{interview.candidate.name}</p>
                      <p className="text-xs text-slate-500">{interview.candidate.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{interview.job}</p>
                    <p className="text-xs text-slate-500">{interview.client}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">{interview.round}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      {getModeIcon(interview.mode)}
                      {interview.mode}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Calendar className="size-3.5 text-slate-400" />
                      {interview.dateTime.split(' - ')[0]}
                    </div>
                    <div className="text-xs text-slate-500 font-medium pl-[22px]">
                      {interview.dateTime.split(' - ')[1]}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    {interview.interviewers.map((name, i) => (
                      <div 
                        key={i} 
                        title={name}
                        className="size-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600 cursor-help"
                      >
                        {name.split(' ').map(n => n[0]).join('')}
                      </div>
                    ))}
                    {interview.interviewers.length > 2 && (
                      <div className="size-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                        +{interview.interviewers.length - 2}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusStyle(interview.status)}`}>
                    {interview.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className={`text-xs ${getFeedbackStyle(interview.feedback)}`}>
                    {interview.feedback}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 relative">
                    <button 
                      onClick={() => onAddFeedback(interview)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
                      title="Add Feedback"
                    >
                      <MessageSquare className="size-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors" title="View Details">
                      <ExternalLink className="size-4" />
                    </button>
                    <div className="relative" ref={(el) => { menuRefs.current[interview.id] = el; }}>
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === interview.id ? null : interview.id)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
                        title="More Options"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {openMenuId === interview.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                          {onReschedule && (
                            <button
                              onClick={() => {
                                onReschedule(interview);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                            >
                              <RotateCcw className="size-4 text-amber-600" />
                              Reschedule
                            </button>
                          )}
                          <button
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                          >
                            <ExternalLink className="size-4 text-blue-600" />
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">1-5</span> of <span className="text-slate-900 font-bold">48</span> interviews
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold bg-white text-slate-400 cursor-not-allowed">Previous</button>
          <button className="px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50">Next</button>
        </div>
      </div>
    </div>
  );
}
