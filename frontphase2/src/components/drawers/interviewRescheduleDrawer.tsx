'use client';

import { useState } from "react";
import { X, CheckCircle2, AlertTriangle, Copy, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface RescheduleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RescheduleDrawer({ isOpen, onClose }: RescheduleDrawerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date(2024, 6, 26)); // July 26, 2024
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("10:00 AM");
  const [timezone, setTimezone] = useState("IST GMT+5:30");
  const [duration, setDuration] = useState("60");
  const [keepSameMode, setKeepSameMode] = useState(true);
  const [interviewMode, setInterviewMode] = useState("online");
  const [platform, setPlatform] = useState("Google Meet");
  const [meetingLink, setMeetingLink] = useState("https://meet.google.com/xyz-abc-def");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [notifyPanel, setNotifyPanel] = useState(true);
  const [message, setMessage] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2024, 6, 1)); // July 2024
  const [isExpanded, setIsExpanded] = useState(false);

  const timeSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM",
    "10:30 AM", "11:00 AM", "11:30 AM",
    "01:00 PM", "01:30 PM", "02:00 PM"
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isDatePast = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateToCheck < today;
  };

  const isDateSelected = (day: number) => {
    return selectedDate.getDate() === day && 
           selectedDate.getMonth() === month && 
           selectedDate.getFullYear() === year;
  };

  const handleDateClick = (day: number) => {
    if (!isDatePast(day)) {
      setSelectedDate(new Date(year, month, day));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingLink);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right"
        style={{
          animation: 'slideInRight 0.3s ease-out'
        }}
      >
        {/* Header Section */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Reschedule Interview</h2>
              <p className="text-sm text-gray-600">Update the date, time or mode of this interview.</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Interview Summary Card */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 relative">
            {/* Toggle Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute top-3 right-3 p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>

            {isExpanded ? (
              /* Expanded View */
              <div className="space-y-2 pr-8">
                <div>
                  <span className="text-xs font-medium text-gray-500">Candidate:</span>
                  <p className="text-sm font-semibold text-gray-900">Alice Johnson</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Role:</span>
                  <p className="text-sm font-semibold text-gray-900">Senior Software Engineer</p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2">Current Schedule:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><strong>Date:</strong> July 20, 2024</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><strong>Time:</strong> 10:00 AM – 11:00 AM</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><strong>Mode:</strong> Online (Google Meet)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><strong>Round:</strong> Technical Round 2</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Compact View */
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-8">
                <div>
                  <span className="text-xs font-medium text-gray-500">Candidate:</span>
                  <p className="text-sm font-semibold text-gray-900">Alice Johnson</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Role:</span>
                  <p className="text-sm font-semibold text-gray-900">Senior Software Engineer</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Current: Jul 20, 2024 • 10:00-11:00 AM • Online (Google Meet) • Tech Round 2</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Section 1: New Date Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">New Date Selection</h3>
            
            {/* Mini Calendar */}
            <div className="border border-gray-200 rounded-lg p-4">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPreviousMonth}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h4 className="text-sm font-semibold text-gray-900">
                  {monthNames[month]} {year}
                </h4>
                <button
                  onClick={goToNextMonth}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day Headers */}
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells for days before month starts */}
                {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}

                {/* Calendar days */}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const isPast = isDatePast(day);
                  const isSelected = isDateSelected(day);

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(day)}
                      disabled={isPast}
                      className={`
                        aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
                        ${isPast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}
                        ${isSelected ? 'bg-[#2b7fff] text-white hover:bg-[#2470ed]' : ''}
                      `}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Selected Date Label */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>New Selected Date:</strong> {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Time & Duration */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Time & Duration</h3>
            
            {/* Timezone */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent"
              >
                <option>IST GMT+5:30</option>
                <option>EST GMT-5:00</option>
                <option>PST GMT-8:00</option>
                <option>UTC GMT+0:00</option>
              </select>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>

            {/* Time Slots */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Time Slots</label>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`
                      px-3 py-2 text-sm rounded-lg border transition-colors
                      ${selectedTimeSlot === slot 
                        ? 'bg-[#2b7fff] text-white border-[#2b7fff]' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#2b7fff]'
                      }
                    `}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Panel Availability Status */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Panel Availability Status</h3>
            
            {!hasConflict ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-800">All Interviewers Available</span>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-red-800">
                    1 Interviewer has conflict at selected time.
                  </span>
                </div>
                <button className="text-sm text-red-700 font-medium hover:underline">
                  View Conflict Details
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Mode Update */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Mode Update (Optional)</h3>
            
            {/* Keep Same Mode Toggle */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={keepSameMode}
                onChange={(e) => setKeepSameMode(e.target.checked)}
                className="w-4 h-4 text-[#2b7fff] border-gray-300 rounded focus:ring-[#2b7fff]"
              />
              <span className="text-sm text-gray-700">Keep same interview mode</span>
            </label>

            {!keepSameMode && (
              <div className="space-y-4">
                {/* Mode Selection */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setInterviewMode("online")}
                    className={`
                      flex-1 px-4 py-2 text-sm rounded-lg border transition-colors
                      ${interviewMode === "online" 
                        ? 'bg-[#2b7fff] text-white border-[#2b7fff]' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#2b7fff]'
                      }
                    `}
                  >
                    Online
                  </button>
                  <button
                    onClick={() => setInterviewMode("walkin")}
                    className={`
                      flex-1 px-4 py-2 text-sm rounded-lg border transition-colors
                      ${interviewMode === "walkin" 
                        ? 'bg-[#2b7fff] text-white border-[#2b7fff]' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#2b7fff]'
                      }
                    `}
                  >
                    Walk-In
                  </button>
                </div>

                {/* Online Mode Options */}
                {interviewMode === "online" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent"
                      >
                        <option>Google Meet</option>
                        <option>Zoom</option>
                        <option>Microsoft Teams</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Link</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent"
                        />
                        <button
                          onClick={copyToClipboard}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Walk-In Mode Options */}
                {interviewMode === "walkin" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Office Location</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent">
                        <option>Mumbai Office - Andheri</option>
                        <option>Delhi Office - Connaught Place</option>
                        <option>Bangalore Office - Koramangala</option>
                      </select>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1">Address</p>
                      <p className="text-sm text-gray-700">
                        4th Floor, Tower A, Embassy Tech Village<br />
                        Outer Ring Road, Devarabisanahalli<br />
                        Bangalore - 560103, Karnataka
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Message & Notification */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Message & Notification</h3>
            
            {/* Message Textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Optional message to candidate explaining reason for reschedule
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b7fff] focus:border-transparent resize-none"
              />
            </div>

            {/* Notification Options */}
            <div className="space-y-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="w-4 h-4 text-[#2b7fff] border-gray-300 rounded focus:ring-[#2b7fff]"
                />
                <span className="text-sm text-gray-700">Notify Candidate via Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyWhatsApp}
                  onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                  className="w-4 h-4 text-[#2b7fff] border-gray-300 rounded focus:ring-[#2b7fff]"
                />
                <span className="text-sm text-gray-700">Notify Candidate via WhatsApp</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyPanel}
                  onChange={(e) => setNotifyPanel(e.target.checked)}
                  className="w-4 h-4 text-[#2b7fff] border-gray-300 rounded focus:ring-[#2b7fff]"
                />
                <span className="text-sm text-gray-700">Notify Interview Panel</span>
              </label>
            </div>

            {/* Helper Text */}
            <p className="text-xs text-gray-500 italic">
              Updated calendar invites will be sent automatically.
            </p>
          </div>
        </div>

        {/* Footer Actions (Sticky) */}
        <div className="border-t border-gray-200 p-6 bg-white">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={hasConflict}
              className={`
                px-6 py-2.5 text-sm font-medium rounded-lg transition-colors
                ${hasConflict 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-[#ff6b35] text-white hover:bg-[#e55a2b]'
                }
              `}
            >
              Confirm Reschedule
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}