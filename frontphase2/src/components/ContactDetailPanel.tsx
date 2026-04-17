import React from 'react';
import { 
  X, Mail, Phone, MessageSquare, 
  Calendar, Paperclip, Plus, 
  ChevronRight, History, Briefcase, 
  UserCircle, CheckSquare, MoreHorizontal,
  Edit, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Contact } from './ContactMockData';
import { ImageWithFallback } from './ImageWithFallback';

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
}

export const ContactDetailPanel: React.FC<ContactDetailPanelProps> = ({ contact, onClose }) => {
  if (!contact) return null;

  return (
    <AnimatePresence>
      {contact && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 w-[500px] h-full bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <ImageWithFallback src={contact.avatar} alt={contact.name} className="w-16 h-16 rounded-2xl object-cover shadow-sm ring-4 ring-white" />
              <div>
                <h2 className="text-xl font-bold text-slate-900">{contact.name}</h2>
                <p className="text-sm font-medium text-slate-600">{contact.designation} @ <span className="text-blue-600">{contact.company.name}</span></p>
                <div className="flex items-center gap-2 mt-2">
                  {contact.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 shadow-sm uppercase tracking-wide">
                      {tag}
                    </span>
                  ))}
                  <button className="text-blue-600 hover:bg-blue-50 p-1 rounded-full transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                <Mail size={16} />
                Email
              </button>
              <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
                <Calendar size={16} />
                Schedule
              </button>
              <button className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                <Edit size={18} />
              </button>
              <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Archive">
                <Archive size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
              {/* Contact Info */}
              <section>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <UserCircle size={14} />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Email</p>
                    <p className="text-sm text-slate-900 flex items-center gap-2">
                      {contact.email}
                      <Mail size={14} className="text-slate-300" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Phone</p>
                    <p className="text-sm text-slate-900 flex items-center gap-2">
                      {contact.phone}
                      <MessageSquare size={14} className="text-emerald-500" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Preferred Channel</p>
                    <p className="text-sm text-slate-900">Email & WhatsApp</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Associated Owner</p>
                    <p className="text-sm text-slate-900 font-medium">{contact.owner}</p>
                  </div>
                </div>
              </section>

              {/* Linked Records */}
              <section>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layers size={14} />
                  Linked Records
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Open Jobs</p>
                        <p className="text-xs text-slate-500">{contact.associatedJobs} Active roles</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 translate-x-0 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                        <UserCircle size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Interview History</p>
                        <p className="text-xs text-slate-500">12 Candidates reviewed</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 translate-x-0 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </section>

              {/* Activity Timeline */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} />
                    Activity Timeline
                  </h3>
                  <button className="text-[11px] font-bold text-blue-600 uppercase hover:underline">Add Note</button>
                </div>
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-slate-200">
                  <TimelineItem 
                    icon={<Mail className="text-blue-500" size={12} />}
                    title="Sent interview follow-up email"
                    time="2 hours ago"
                    description="Sent the detailed feedback form to Sarah regarding the Senior Frontend Engineer interview."
                  />
                  <TimelineItem 
                    icon={<MessageSquare className="text-emerald-500" size={12} />}
                    title="Call with hiring manager"
                    time="Yesterday at 2:30 PM"
                    description="Discussed budget constraints for the upcoming DevOps role. Sarah approved the salary range."
                  />
                  <TimelineItem 
                    icon={<CheckSquare className="text-purple-500" size={12} />}
                    title="Task completed: Review LinkedIn profile"
                    time="Feb 8, 2026"
                  />
                  <TimelineItem 
                    icon={<Paperclip className="text-slate-500" size={12} />}
                    title="Updated Contract Agreement"
                    time="Feb 5, 2026"
                    description="NDA and updated service agreement signed and uploaded."
                  />
                </div>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Add a quick note..." 
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TimelineItem: React.FC<{ icon: React.ReactNode, title: string, time: string, description?: string }> = ({ icon, title, time, description }) => (
  <div className="relative">
    <div className="absolute -left-[19px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center z-10 shadow-sm">
      {icon}
    </div>
    <div>
      <p className="text-xs font-bold text-slate-900">{title}</p>
      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{time}</p>
      {description && (
        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed italic">"{description}"</p>
        </div>
      )}
    </div>
  </div>
);

const Layers: React.FC<{ size?: number, className?: string }> = ({ size = 20, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);
