'use client';

import { useState } from 'react';
import { X, ChevronDown, Plus, Sparkles, ChevronLeft, ChevronRight, Video, MapPin, Copy, Mail, MessageCircle, Calendar, Clock, Info, Check, CheckCircle2 } from 'lucide-react';

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleInterviewModal({ isOpen, onClose }: ScheduleInterviewModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRound, setSelectedRound] = useState('Technical Round');
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>(['1', '2']);
  const [notes, setNotes] = useState('');
  const [showConflict, setShowConflict] = useState(false);
  const [isRoundDropdownOpen, setIsRoundDropdownOpen] = useState(false);

  // Step 2 states
  const [selectedDate, setSelectedDate] = useState(new Date(2024, 6, 20)); // July 20, 2024
  const [currentMonth, setCurrentMonth] = useState(new Date(2024, 6, 1));
  const [selectedTimezone, setSelectedTimezone] = useState('IST GMT+5:30');
  const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState('60 min');
  const [isDurationDropdownOpen, setIsDurationDropdownOpen] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>(['02:00 PM']);
  const [allowMultipleSlots, setAllowMultipleSlots] = useState(false);
  const [showTimeConflict, setShowTimeConflict] = useState(false);

  // Step 3 states
  const [interviewMode, setInterviewMode] = useState<'online' | 'walk-in' | null>('online');
  const [selectedPlatform, setSelectedPlatform] = useState('Zoom');
  const [meetingLink, setMeetingLink] = useState('');
  const [onlineInstructions, setOnlineInstructions] = useState('Join 5 minutes early. Ensure microphone and camera are working.');
  const [selectedOffice, setSelectedOffice] = useState('Head Office');
  const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
  const [walkInInstructions, setWalkInInstructions] = useState('Report to reception 15 minutes early.');

  // Step 4 states
  const [allowEditEmail, setAllowEditEmail] = useState(false);
  const [allowEditWhatsApp, setAllowEditWhatsApp] = useState(false);
  const [emailMessage, setEmailMessage] = useState(`Dear Candidate,

We are pleased to invite you for an interview for the position of Senior Software Engineer at SAASA B2E.

Interview Details:
• Date: 20 July 2024
• Time: 02:00 PM IST
• Duration: 60 minutes
• Mode: Online Interview (Zoom)
• Meeting Link: https://zoom.us/j/123456789

Please join 5 minutes early and ensure your microphone and camera are working properly.

We look forward to meeting you.

Best regards,
SAASA B2E Recruitment Team`);
  
  const [whatsappMessage, setWhatsappMessage] = useState(`Hi! 👋

Your interview is scheduled:
📅 20 July 2024
🕐 02:00 PM IST
⏱️ 60 minutes
💻 Online (Zoom)

Join here: https://zoom.us/j/123456789

Good luck! 🎯`);

  // Step 5 states
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const steps = [
    'Select Round & Panel',
    'Date & Time',
    'Interview Mode',
    'Notification Preview',
    'Confirm'
  ];

  const interviewRounds = [
    'Screening',
    'Technical Round',
    'Final Round',
    'HR Round'
  ];

  const timezones = [
    'IST GMT+5:30',
    'EST GMT-5:00',
    'PST GMT-8:00',
    'CST GMT-6:00',
    'GMT GMT+0:00'
  ];

  const durations = ['30 min', '45 min', '60 min'];

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
  ];

  const mockInterviewers = [
    { id: '1', name: 'Sarah Chen', role: 'Senior Engineer', avatar: 'SC' },
    { id: '2', name: 'Michael Kumar', role: 'Tech Lead', avatar: 'MK' },
    { id: '3', name: 'Emily Rodriguez', role: 'Engineering Manager', avatar: 'ER' },
  ];

  const toggleInterviewer = (id: string) => {
    setSelectedInterviewers(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleTimeSlot = (slot: string) => {
    if (allowMultipleSlots) {
      setSelectedTimeSlots(prev => {
        if (prev.includes(slot)) {
          return prev.filter(s => s !== slot);
        } else if (prev.length < 3) {
          return [...prev, slot];
        }
        return prev;
      });
    } else {
      setSelectedTimeSlots([slot]);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const formatDate = (date: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const changeMonth = (direction: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1));
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const days = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isToday = new Date().toDateString() === date.toDateString();

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white'
              : isToday
              ? 'bg-blue-50 text-blue-600'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h4 className="font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-20">
          <h2 className="text-2xl font-semibold text-gray-900">Schedule Interview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="sticky top-[89px] px-8 py-4 bg-gray-50 border-b border-gray-200 z-10">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {/* Steps */}
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === currentStep;
              const isCompleted = stepNumber < currentStep;

              return (
                <div key={index} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-400 border-2 border-gray-200'
                    }`}
                  >
                    {stepNumber}
                  </div>
                  <p
                    className={`mt-1.5 text-[10px] font-medium text-center max-w-[100px] leading-tight ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {step}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {currentStep === 1 && (
            <div className="space-y-8">
              {/* Section A: Interview Round */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Round</h3>
                <div className="relative">
                  <button
                    onClick={() => setIsRoundDropdownOpen(!isRoundDropdownOpen)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-blue-500 transition-colors"
                  >
                    <span className={selectedRound ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedRound || 'Select Interview Round'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isRoundDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isRoundDropdownOpen && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {interviewRounds.map((round) => (
                        <button
                          key={round}
                          onClick={() => {
                            setSelectedRound(round);
                            setIsRoundDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors text-gray-900"
                        >
                          {round}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Section B: Assign Interview Panel */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Interview Panel</h3>

                {/* Multi-select employee field with avatar preview */}
                <div className="space-y-4 mb-4">
                  {mockInterviewers.map((interviewer) => (
                    <label
                      key={interviewer.id}
                      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInterviewers.includes(interviewer.id)}
                        onChange={() => toggleInterviewer(interviewer.id)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                        {interviewer.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{interviewer.name}</p>
                        <p className="text-sm text-gray-500">{interviewer.role}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                    <Plus className="w-5 h-5" />
                    Add Interviewer
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                    <Sparkles className="w-5 h-5" />
                    Suggest Best Interviewer (AI)
                  </button>
                </div>

                {/* Helper text */}
                <p className="mt-3 text-sm text-gray-500">
                  System will check interviewer availability
                </p>

                {/* Conflict indicator */}
                <div className="mt-4">
                  {showConflict ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm font-medium text-red-700">
                        Conflict Detected – 1 Interviewer Busy
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-700">
                        All Interviewers Available
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setShowConflict(!showConflict)}
                    className="ml-4 text-sm text-blue-600 hover:underline"
                  >
                    Toggle conflict state
                  </button>
                </div>
              </div>

              {/* Section C: Internal Notes */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Internal Notes <span className="text-gray-400 font-normal">(Optional)</span>
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any internal notes or special instructions for the interview panel..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Select Date & Time</h3>
              
              {/* 2-Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT COLUMN: Calendar */}
                <div>
                  {renderCalendar()}
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Selected Date:</span> {formatDate(selectedDate)}
                    </p>
                  </div>
                </div>

                {/* RIGHT COLUMN: Timezone, Duration, Time Slots */}
                <div className="space-y-6">
                  {/* Section A: Timezone */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">Timezone</h4>
                    <div className="relative">
                      <button
                        onClick={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left flex items-center justify-between hover:border-blue-500 transition-colors text-sm"
                      >
                        <span className="text-gray-900">{selectedTimezone}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isTimezoneDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isTimezoneDropdownOpen && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          {timezones.map((tz) => (
                            <button
                              key={tz}
                              onClick={() => {
                                setSelectedTimezone(tz);
                                setIsTimezoneDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-gray-900 text-sm"
                            >
                              {tz}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section B: Duration */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">Duration</h4>
                    <div className="relative">
                      <button
                        onClick={() => setIsDurationDropdownOpen(!isDurationDropdownOpen)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left flex items-center justify-between hover:border-blue-500 transition-colors text-sm"
                      >
                        <span className="text-gray-900">{selectedDuration}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDurationDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDurationDropdownOpen && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          {durations.map((dur) => (
                            <button
                              key={dur}
                              onClick={() => {
                                setSelectedDuration(dur);
                                setIsDurationDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-gray-900 text-sm"
                            >
                              {dur}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section C: Available Time Slots */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">Available Time Slots</h4>
                    
                    {/* Time Slots Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTimeSlots.includes(slot);
                        return (
                          <button
                            key={slot}
                            onClick={() => toggleTimeSlot(slot)}
                            className={`px-3 py-2 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-500'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>

                    {/* Availability Indicator */}
                    <div className="mb-4">
                      {showTimeConflict ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          <span className="text-xs font-medium text-red-700">
                            Conflict – 1 Interviewer Unavailable
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs font-medium text-green-700">
                            All Panel Members Available
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => setShowTimeConflict(!showTimeConflict)}
                        className="ml-3 text-xs text-blue-600 hover:underline"
                      >
                        Toggle
                      </button>
                    </div>

                    {/* Multiple Slots Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowMultipleSlots}
                        onChange={(e) => {
                          setAllowMultipleSlots(e.target.checked);
                          if (!e.target.checked && selectedTimeSlots.length > 1) {
                            setSelectedTimeSlots([selectedTimeSlots[0]]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Allow Candidate to Choose from Multiple Slots
                      </span>
                    </label>
                    {allowMultipleSlots && (
                      <p className="mt-2 text-xs text-gray-500">
                        You can select up to 3 time slots ({selectedTimeSlots.length}/3 selected)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Interview Mode</h3>
              
              {/* Interview Mode Selection Cards */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Card 1: Online Interview */}
                <button
                  onClick={() => setInterviewMode('online')}
                  className={`bg-white border-2 rounded-xl p-8 text-left transition-all hover:shadow-lg ${
                    interviewMode === 'online' ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                      interviewMode === 'online' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Video className={`w-8 h-8 ${interviewMode === 'online' ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Online Interview</h4>
                    <p className="text-sm text-gray-600">
                      Use integrated platforms like Zoom, Google Meet, or Teams
                    </p>
                  </div>
                </button>

                {/* Card 2: Walk-In Interview */}
                <button
                  onClick={() => setInterviewMode('walk-in')}
                  className={`bg-white border-2 rounded-xl p-8 text-left transition-all hover:shadow-lg ${
                    interviewMode === 'walk-in' ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                      interviewMode === 'walk-in' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <MapPin className={`w-8 h-8 ${interviewMode === 'walk-in' ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Walk-In Interview</h4>
                    <p className="text-sm text-gray-600">
                      Invite candidate to office or venue
                    </p>
                  </div>
                </button>
              </div>

              {/* Conditional Content Based on Selection */}
              {interviewMode === 'online' && (
                <div className="space-y-6">
                  {/* Platform Selection */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Platform Selection</h4>
                    <div className="flex gap-3">
                      {['Zoom', 'Google Meet', 'Microsoft Teams'].map((platform) => (
                        <button
                          key={platform}
                          onClick={() => setSelectedPlatform(platform)}
                          className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                            selectedPlatform === platform
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-500'
                          }`}
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meeting Link */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Meeting Link</h4>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="Enter or paste meeting link"
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                      />
                      <button className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm">
                        Generate Auto-Link
                      </button>
                      <button className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Candidate Instructions */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Candidate Instructions</h4>
                    <textarea
                      value={onlineInstructions}
                      onChange={(e) => setOnlineInstructions(e.target.value)}
                      placeholder="Join 5 minutes early. Ensure microphone and camera are working."
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                    />
                    <p className="mt-3 text-xs text-gray-500">
                      Instructions will be sent via Email and WhatsApp.
                    </p>
                  </div>
                </div>
              )}

              {interviewMode === 'walk-in' && (
                <div className="space-y-6">
                  {/* Office Location */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Office Location</h4>
                    <div className="relative">
                      <button
                        onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left flex items-center justify-between hover:border-blue-500 transition-colors text-sm"
                      >
                        <span className="text-gray-900">{selectedOffice}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOfficeDropdownOpen && (
                        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          {['Head Office', 'Branch A', 'Branch B'].map((office) => (
                            <button
                              key={office}
                              onClick={() => {
                                setSelectedOffice(office);
                                setIsOfficeDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-gray-900 text-sm"
                            >
                              {office}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address Preview Card */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Address Preview</h4>
                    <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center border border-gray-300">
                      <div className="text-center">
                        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Map preview placeholder</p>
                        <p className="text-xs text-gray-500 mt-1">123 Business Street, Tech Park</p>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Instructions</h4>
                    <textarea
                      value={walkInInstructions}
                      onChange={(e) => setWalkInInstructions(e.target.value)}
                      placeholder="Report to reception 15 minutes early."
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Notification Preview</h3>
              
              {/* 2-Column Layout */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* LEFT SIDE: Email Preview */}
                <div>
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                      <Mail className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Email Preview</h4>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                      <p className="text-gray-900">Dear Candidate,</p>
                      
                      <p className="text-gray-700">
                        We are pleased to invite you for an interview for the position of{' '}
                        <span className="font-semibold">Senior Software Engineer</span> at SAASA B2E.
                      </p>
                      
                      <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                        <p className="font-semibold text-gray-900 mb-2">Interview Details:</p>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span>20 July 2024</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span>02:00 PM IST</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span>Duration: 60 minutes</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Video className="w-4 h-4 text-blue-600" />
                          <span>Online Interview (Zoom)</span>
                        </div>
                        <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                          <p className="text-xs text-gray-500 mb-1">Meeting Link:</p>
                          <p className="text-xs text-blue-600 break-all">https://zoom.us/j/123456789</p>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 text-xs">
                        Join 5 minutes early. Ensure microphone and camera are working.
                      </p>
                      
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                        Join Interview
                      </button>
                      
                      <p className="text-gray-700">We look forward to meeting you.</p>
                      <p className="text-gray-600 text-xs">Best regards,<br />SAASA B2E Recruitment Team</p>
                    </div>
                  </div>
                  
                  {/* Edit Email Toggle */}
                  <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowEditEmail}
                        onChange={(e) => setAllowEditEmail(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Allow editing email message</span>
                    </label>
                    
                    {allowEditEmail && (
                      <textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={8}
                        className="mt-3 w-full px-4 py-3 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                        placeholder="Edit email message..."
                      />
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: WhatsApp Preview */}
                <div>
                  <div className="bg-[#e5ddd5] rounded-lg p-4 shadow-sm" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3C/svg%3E")' }}>
                    <div className="flex items-center gap-2 mb-4 pb-3">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-gray-900">WhatsApp Preview</h4>
                    </div>
                    
                    {/* WhatsApp Chat Bubble */}
                    <div className="bg-white rounded-lg rounded-tl-none p-4 shadow-md relative">
                      {/* Bubble tail */}
                      <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-white border-r-[10px] border-r-transparent"></div>
                      
                      <div className="space-y-3 text-sm">
                        <p className="text-gray-900">Hi! 👋</p>
                        
                        <p className="text-gray-900">Your interview is scheduled:</p>
                        
                        <div className="space-y-1.5">
                          <p className="text-gray-800">📅 20 July 2024</p>
                          <p className="text-gray-800">🕐 02:00 PM IST</p>
                          <p className="text-gray-800">⏱️ 60 minutes</p>
                          <p className="text-gray-800">💻 Online (Zoom)</p>
                        </div>
                        
                        <div className="bg-blue-50 rounded p-2 border-l-4 border-blue-500">
                          <p className="text-xs text-gray-600 mb-1">Join here:</p>
                          <a href="#" className="text-xs text-blue-600 underline break-all">
                            https://zoom.us/j/123456789
                          </a>
                        </div>
                        
                        <p className="text-gray-900">Good luck! 🎯</p>
                        
                        <p className="text-xs text-gray-400 text-right">10:30 AM</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Edit WhatsApp Toggle */}
                  <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowEditWhatsApp}
                        onChange={(e) => setAllowEditWhatsApp(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Allow editing WhatsApp message</span>
                    </label>
                    
                    {allowEditWhatsApp && (
                      <textarea
                        value={whatsappMessage}
                        onChange={(e) => setWhatsappMessage(e.target.value)}
                        rows={6}
                        className="mt-3 w-full px-4 py-3 bg-white border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                        placeholder="Edit WhatsApp message..."
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900">
                  Notifications will be sent immediately after confirmation.
                </p>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              {!showSuccess ? (
                <>
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Review & Confirm</h3>
                  
                  {/* 2-Column Layout */}
                  <div className="grid grid-cols-[1fr_280px] gap-6">
                    {/* LEFT: Structured Summary Card */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
                      {/* Candidate Section */}
                      <div className="pb-5 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Candidate</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                              JD
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">John Doe</p>
                              <p className="text-sm text-gray-500">Senior Software Engineer</p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Round:</span> {selectedRound}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Schedule Section */}
                      <div className="py-5 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Schedule</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">{formatDate(selectedDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">{selectedTimeSlots[0]}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-sm">Duration: {selectedDuration}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <span className="text-sm font-medium">Timezone:</span>
                            <span className="text-sm">{selectedTimezone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mode Section */}
                      <div className="py-5 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Mode</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-700">
                            {interviewMode === 'online' ? (
                              <>
                                <Video className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">Online Interview</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium">Walk-In Interview</span>
                              </>
                            )}
                          </div>
                          {interviewMode === 'online' ? (
                            <div className="ml-6">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Platform:</span> {selectedPlatform}
                              </p>
                            </div>
                          ) : (
                            <div className="ml-6">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Location:</span> {selectedOffice}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Panel Section */}
                      <div className="py-5 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Panel</h4>
                        <div className="space-y-3">
                          {mockInterviewers
                            .filter((interviewer) => selectedInterviewers.includes(interviewer.id))
                            .map((interviewer) => (
                              <div key={interviewer.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                                  {interviewer.avatar}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{interviewer.name}</p>
                                  <p className="text-xs text-gray-500">{interviewer.role}</p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Notifications Section */}
                      <div className="pt-5">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Notifications</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-600" />
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-gray-700">Email: Enabled</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-600" />
                            <MessageCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-700">WhatsApp: Enabled</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Analytics Box */}
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">Today's Stats</h5>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Interview Load Today</p>
                            <p className="text-2xl font-bold text-blue-600">4</p>
                          </div>
                          <div className="pt-3 border-t border-blue-200">
                            <p className="text-xs text-gray-600 mb-1">Panel Availability</p>
                            <div className="inline-flex items-center gap-2 px-2 py-1 bg-green-100 rounded-full">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-xs font-semibold text-green-700">Confirmed</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Final Confirmation Checkbox */}
                  <div className="mt-6 bg-gray-50 border-2 border-gray-300 rounded-lg p-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmationChecked}
                        onChange={(e) => setConfirmationChecked(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">I confirm all details are correct.</span>
                    </label>
                  </div>
                </>
              ) : (
                /* Success State */
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <CheckCircle2 className="w-16 h-16 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Interview Scheduled Successfully!</h3>
                  <p className="text-gray-600 mb-6 text-center max-w-md">
                    Notifications have been sent to the candidate via Email and WhatsApp. The interview panel has been notified.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setShowSuccess(false);
                        setCurrentStep(1);
                        setConfirmationChecked(false);
                      }}
                      className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Schedule Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 flex items-center justify-between">
          {currentStep === 1 ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Next: Date & Time
              </button>
            </>
          ) : currentStep === 2 ? (
            <>
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Next: Interview Mode
              </button>
            </>
          ) : currentStep === 3 ? (
            <>
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Next: Notification Preview
              </button>
            </>
          ) : currentStep === 4 ? (
            <>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Confirm
              </button>
            </>
          ) : currentStep === 5 ? (
            <>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (confirmationChecked) {
                    setShowSuccess(true);
                    // Add logic to send notifications here
                  }
                }}
                disabled={!confirmationChecked}
                className={`px-8 py-3 font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl text-base ${
                  confirmationChecked
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirm & Schedule Interview
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}