'use client';

import React, { useState } from 'react';
import { Star, Paperclip, Circle, Reply, ReplyAll, Forward, MoreHorizontal, Download, User, Briefcase, Building, Tag, StickyNote, BellRing, UserPlus, PauseCircle, Search, Filter, RefreshCcw, Bell, UserCircle } from 'lucide-react';
import { ImageWithFallback } from '../../components/ImageWithFallback';

// --- Types ---

export interface Email {
  id: string;
  sender: string;
  email: string;
  avatar?: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  candidate: string;
  job: string;
  client: string;
  type: 'Interview' | 'Offer' | 'Follow-up' | 'General';
}

// --- Mock Data ---

const MOCK_EMAILS: Email[] = [
  {
    id: '1',
    sender: 'Sarah Jenkins',
    email: 's.jenkins@candidate.com',
    subject: 'Interview Availability - Senior Product Designer',
    preview: 'Thank you for reaching out about the position. I would love to discuss this further. My availability for next week is...',
    timestamp: '10:42 AM',
    unread: true,
    starred: false,
    hasAttachment: true,
    candidate: 'Sarah Jenkins',
    job: 'Senior Product Designer',
    client: 'Stripe',
    type: 'Interview'
  },
  {
    id: '2',
    sender: 'Michael Chen',
    email: 'm.chen@recruitment.com',
    subject: 'Feedback on candidate: David Miller',
    preview: 'Hi Alex, we just finished the technical round with David. The team was very impressed with his system design skills.',
    timestamp: 'Yesterday',
    unread: false,
    starred: true,
    hasAttachment: false,
    candidate: 'David Miller',
    job: 'Full Stack Engineer',
    client: 'Airbnb',
    type: 'Follow-up'
  },
  {
    id: '3',
    sender: 'HR - Global Tech',
    email: 'hr@globaltech.io',
    subject: 'Signed Offer Letter - Emma Watson',
    preview: 'Great news! Emma has signed the offer letter. I have attached the signed document for your records.',
    timestamp: 'Yesterday',
    unread: false,
    starred: false,
    hasAttachment: true,
    candidate: 'Emma Watson',
    job: 'Sales Executive',
    client: 'Global Tech',
    type: 'Offer'
  },
  {
    id: '4',
    sender: 'Robert Fox',
    email: 'robert.fox@gmail.com',
    subject: 'Question regarding benefits package',
    preview: 'Thanks for sending over the details. I had one quick question about the health insurance plan and the 401k match...',
    timestamp: 'Feb 8',
    unread: false,
    starred: false,
    hasAttachment: false,
    candidate: 'Robert Fox',
    job: 'DevOps Lead',
    client: 'Vercel',
    type: 'General'
  },
  {
    id: '5',
    sender: 'Jessica Wong',
    email: 'j.wong@startup.co',
    subject: 'Next steps for the Marketing role',
    preview: 'We have reviewed the latest batch of candidates you sent over. We would like to proceed with 3 of them.',
    timestamp: 'Feb 7',
    unread: true,
    starred: true,
    hasAttachment: false,
    candidate: 'Multiple Candidates',
    job: 'Marketing Manager',
    client: 'Startup Co',
    type: 'Follow-up'
  }
];

// --- Components ---

function InboxHeader() {
  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900 mr-4">Inbox</h1>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by candidate, job, client or email"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCcw className="w-3 h-3 animate-spin-slow" />
          <span>Last synced 2 mins ago</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:bg-gray-50 rounded-full relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Alex Thompson</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recruitment Lead</p>
            </div>
            <UserCircle className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>
    </header>
  );
}

interface InboxListProps {
  emails: Email[];
  selectedId?: string;
  onSelect: (email: Email) => void;
}

function InboxList({ emails, selectedId, onSelect }: InboxListProps) {
  return (
    <div className="w-[400px] border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All Messages ({emails.length})</span>
        <select className="text-xs bg-transparent border-none focus:ring-0 text-blue-600 font-medium cursor-pointer">
          <option>Newest First</option>
          <option>Oldest First</option>
          <option>Unread Only</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => (
          <div
            key={email.id}
            onClick={() => onSelect(email)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-blue-50/30 relative group ${
              selectedId === email.id ? 'bg-blue-50' : email.unread ? 'bg-white font-medium' : 'bg-white'
            }`}
          >
            {email.unread && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
            )}
            
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2 max-w-[70%]">
                <p className={`text-sm truncate ${email.unread ? 'text-gray-900 font-bold' : 'text-gray-700 font-semibold'}`}>
                  {email.sender}
                </p>
                {email.unread && <Circle className="w-2 h-2 fill-blue-600 text-blue-600 shrink-0" />}
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{email.timestamp}</span>
            </div>

            <div className="flex justify-between items-center mb-1">
              <h3 className={`text-sm truncate ${email.unread ? 'text-gray-900' : 'text-gray-600'}`}>
                {email.subject}
              </h3>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Star className={`w-3.5 h-3.5 ${email.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                {email.hasAttachment && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </div>

            <p className="text-xs text-gray-500 line-clamp-1 mb-3">
              {email.preview}
            </p>

            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 bg-gray-100 text-[#4B5563] text-[10px] rounded-full border border-gray-200">
                {email.candidate}
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full border border-blue-100">
                {email.job}
              </span>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-full border border-indigo-100">
                {email.client}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmailDetailProps {
  email: Email | null;
}

function EmailDetail({ email }: EmailDetailProps) {
  if (!email) {
    return (
      <div className="flex-1 bg-white flex flex-col items-center justify-center text-gray-400 p-8">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <Reply className="w-8 h-8 opacity-20" />
        </div>
        <p>Select an email to view the conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Detail Header */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{email.subject}</h2>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              email.type === 'Interview' ? 'bg-purple-100 text-purple-700' :
              email.type === 'Offer' ? 'bg-green-100 text-green-700' :
              email.type === 'Follow-up' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {email.type}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 border-l border-gray-200 pl-3">
              <span className="font-medium text-gray-700">{email.candidate}</span>
              <span className="text-gray-300">•</span>
              <span>{email.job}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <Star className={`w-5 h-5 ${email.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Email Content */}
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
            {email.sender[0]}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900">{email.sender} <span className="font-normal text-gray-500">&lt;{email.email}&gt;</span></p>
                <p className="text-xs text-gray-400 mt-0.5">To: Me &lt;alex@saasa.com&gt;</p>
              </div>
              <span className="text-xs text-gray-400">Feb 10, 2026, 10:42 AM</span>
            </div>
            
            <div className="text-gray-700 text-sm leading-relaxed space-y-4">
              <p>Hi Alex,</p>
              <p>{email.preview} I have attached the documents we discussed during our last call. Please let me know if there's anything else needed from my side before the final interview stage.</p>
              <p>Looking forward to hearing from you.</p>
              <p>Best regards,<br />{email.sender}</p>
            </div>

            {/* Attachments */}
            {email.hasAttachment && (
              <div className="mt-6">
                <p className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Paperclip className="w-3 h-3" />
                  Attachments (2)
                </p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group cursor-pointer">
                    <div className="w-8 h-8 bg-red-50 text-red-600 flex items-center justify-center rounded font-bold text-[10px]">PDF</div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">CV_Updated_2026.pdf</p>
                      <p className="text-[10px] text-gray-400">1.2 MB</p>
                    </div>
                    <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-500 ml-2" />
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group cursor-pointer">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 flex items-center justify-center rounded font-bold text-[10px]">DOC</div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">Cover_Letter.docx</p>
                      <p className="text-[10px] text-gray-400">450 KB</p>
                    </div>
                    <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-500 ml-2" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Link Section */}
        <div className="pt-8 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">Related ATS Records</p>
          <div className="grid grid-cols-3 gap-3">
            <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Open Candidate Profile
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              Open Job
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Building className="w-3.5 h-3.5 text-purple-500" />
              Open Client
            </button>
          </div>
        </div>

        {/* Productivity Tools */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700">Workflow & Collaboration</h4>
            <span className="text-[10px] text-gray-400">Team visibility: Internal only</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:border-blue-400">
              <Tag className="w-3 h-3 text-blue-400" />
              Apply Label
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:border-yellow-400">
              <StickyNote className="w-3 h-3 text-yellow-500" />
              Add Note
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:border-purple-400">
              <BellRing className="w-3 h-3 text-purple-500" />
              Follow-up
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:border-green-400">
              <UserPlus className="w-3 h-3 text-green-500" />
              Assign To
            </button>
          </div>
        </div>
      </div>

      {/* Detail Footer - Reply Actions */}
      <div className="p-6 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
            <ReplyAll className="w-4 h-4" />
            Reply All
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
            <Forward className="w-4 h-4" />
            Forward
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Connected via Gmail (alex@saasa.com)
          </div>
          <button className="flex items-center gap-1.5 text-[10px] text-red-400 hover:text-red-600 font-medium">
            <PauseCircle className="w-3 h-3" />
            Pause Sync
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>(MOCK_EMAILS);
  const [selectedId, setSelectedId] = useState<string | undefined>(MOCK_EMAILS[0].id);

  const selectedEmail = emails.find(e => e.id === selectedId) || null;

  const handleSelect = (email: Email) => {
    setSelectedId(email.id);
    if (email.unread) {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, unread: false } : e));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F3F4F6] text-gray-900 font-sans overflow-hidden">
      {/* Header */}
      <InboxHeader />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Inbox List */}
        <InboxList 
          emails={emails} 
          selectedId={selectedId} 
          onSelect={handleSelect} 
        />

        {/* Email Detail */}
        <EmailDetail email={selectedEmail} />
      </div>
    </div>
  );
}
