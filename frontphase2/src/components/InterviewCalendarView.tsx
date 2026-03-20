import React from 'react';
import { ChevronLeft, ChevronRight, Video, Phone, MapPin, MoreHorizontal, Users } from 'lucide-react';

export function InterviewCalendarView() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dates = Array.from({ length: 35 }, (_, i) => i - 3); // Simple mock for Feb

  const interviews = [
    { day: 10, time: '10:00 AM', name: 'Sarah Jenkins', type: 'Technical', mode: 'video', status: 'scheduled' },
    { day: 10, time: '02:30 PM', name: 'David Chen', type: 'HR', mode: 'phone', status: 'completed' },
    { day: 11, time: '11:00 AM', name: 'Emma Watson', type: 'Client', mode: 'office', status: 'scheduled' },
    { day: 12, time: '04:00 PM', name: 'Michael Brown', type: 'Final', mode: 'video', status: 'rescheduled' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
      {/* Calendar Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-slate-900">February 2026</h3>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft className="size-5" /></button>
            <button className="px-2 py-1 hover:bg-slate-100 rounded text-xs font-bold text-slate-600">Today</button>
            <button className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight className="size-5" /></button>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button className="px-3 py-1 text-xs font-bold text-slate-600">Month</button>
          <button className="px-3 py-1 text-xs font-bold text-slate-900 bg-white shadow-sm rounded-md">Week</button>
          <button className="px-3 py-1 text-xs font-bold text-slate-600">Day</button>
        </div>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
        {days.map(day => (
          <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid (Week View for better detail) */}
      <div className="flex-1 min-h-[600px] overflow-y-auto relative bg-slate-50">
        <div className="grid grid-cols-7 h-full">
          {days.map((_, dayIndex) => (
            <div key={dayIndex} className="border-r border-slate-100 last:border-0 relative">
              {/* Time Slots */}
              {Array.from({ length: 12 }).map((_, timeIndex) => {
                const hour = timeIndex + 8;
                return (
                  <div key={timeIndex} className="h-16 border-b border-slate-100 px-2 pt-1">
                    {dayIndex === 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Interviews on this day */}
              {/* This is a simplified positioning for demo */}
              {dayIndex === 2 && ( // Wednesday Feb 11
                <div 
                  className="absolute top-48 left-1 right-1 bg-blue-600 text-white p-2 rounded-lg shadow-md z-10 cursor-pointer hover:scale-105 transition-transform group"
                  title="Emma Watson - Client Round"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold opacity-80">11:00 AM</span>
                    <Video className="size-3" />
                  </div>
                  <p className="text-[11px] font-bold truncate">Emma Watson</p>
                  <p className="text-[10px] opacity-80 truncate">Client Round</p>
                  
                  {/* Tooltip detail (CSS only for demo) */}
                  <div className="absolute left-full ml-2 top-0 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-slate-900 hidden group-hover:block z-50">
                    <p className="font-bold text-sm mb-1">Emma Watson</p>
                    <p className="text-xs text-slate-500 mb-2">Global Logistics - PM</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 mb-1">
                      <Users className="size-3" /> Louis Litt, Donna Paulsen
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600">
                      <MapPin className="size-3" /> Conference Room B
                    </div>
                  </div>
                </div>
              )}
              
              {dayIndex === 1 && ( // Tuesday Feb 10
                <>
                  <div className="absolute top-32 left-1 right-1 bg-emerald-600 text-white p-2 rounded-lg shadow-md z-10 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold opacity-80">10:00 AM</span>
                      <Video className="size-3" />
                    </div>
                    <p className="text-[11px] font-bold truncate">Sarah Jenkins</p>
                  </div>
                  <div className="absolute top-[320px] left-1 right-1 bg-amber-600 text-white p-2 rounded-lg shadow-md z-10 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold opacity-80">02:30 PM</span>
                      <Phone className="size-3" />
                    </div>
                    <p className="text-[11px] font-bold truncate">David Chen</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
