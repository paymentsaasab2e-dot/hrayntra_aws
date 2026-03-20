'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Linkedin, Edit, Tag, Calendar, MessageSquare, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetContact, apiAddContactNote, apiAddContactActivity, apiAddContactCommunication, type BackendContact } from '../../../lib/api';
import { ImageWithFallback } from '../../../components/ImageWithFallback';
import { ContactTypeBadge } from '../../../components/contacts/ContactTypeBadge';
import { OwnerAvatar } from '../../../components/contacts/OwnerAvatar';

export default function ContactProfilePage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<BackendContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'communication' | 'tasks' | 'interviews'>('activity');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const fetchContact = async () => {
      try {
        setLoading(true);
        const response = await apiGetContact(contactId);
        if (response.data) {
          setContact(response.data as BackendContact);
        }
      } catch (error: any) {
        console.error('Failed to fetch contact:', error);
        toast.error(error.message || 'Failed to load contact');
      } finally {
        setLoading(false);
      }
    };

    if (contactId) {
      fetchContact();
    }
  }, [contactId]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !contact) return;

    try {
      await apiAddContactNote(contact.id, noteText);
      toast.success('Note added successfully');
      setNoteText('');
      // Refresh contact
      const response = await apiGetContact(contactId);
      if (response.data) {
        setContact(response.data as BackendContact);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add note');
    }
  };

  const getInitials = (contact: BackendContact) => {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-gray-500">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Contact not found</div>
          <button
            onClick={() => router.push('/contacts')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
          >
            Back to Contacts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <button
          onClick={() => router.push('/contacts')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Contacts</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Contact Profile</h1>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Avatar & Basic Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-center mb-6">
                <ImageWithFallback
                  src={contact.avatarUrl}
                  alt={`${contact.firstName} ${contact.lastName}`}
                  className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-white shadow-lg"
                  fallback={
                    <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-2xl mx-auto ring-4 ring-white shadow-lg">
                      {getInitials(contact)}
                    </div>
                  }
                />
                <h2 className="text-xl font-bold text-gray-900 mt-4">
                  {contact.firstName} {contact.lastName}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{contact.designation || 'No designation'}</p>
                {contact.company && (
                  <p className="text-sm text-blue-600 font-medium mt-1">{contact.company.companyName}</p>
                )}
                <div className="mt-3">
                  <ContactTypeBadge type={contact.contactType} />
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                {contact.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${contact.email}`} className="text-gray-700 hover:text-blue-600">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-gray-400" />
                    <a href={`tel:${contact.phone}`} className="text-gray-700 hover:text-blue-600">
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-gray-400" />
                    <span className="text-gray-700">{contact.location}</span>
                  </div>
                )}
                {contact.linkedinUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Linkedin size={16} className="text-gray-400" />
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                {contact.owner && (
                  <div className="flex items-center gap-3 text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-400">Owner:</span>
                    <OwnerAvatar owner={contact.owner} />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag size={16} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.tags && contact.tags.length > 0 ? (
                    contact.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">No tags</span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
                <div className="space-y-3">
                  {contact.notes && contact.notes.length > 0 ? (
                    contact.notes.map((note: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          {typeof note === 'string' ? note : note.note}
                        </p>
                        {typeof note === 'object' && note.author && (
                          <p className="text-xs text-gray-500 mt-2">
                            {note.author.name} • {new Date(note.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No notes yet</p>
                  )}
                </div>
                <div className="mt-4">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Associated Jobs */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Associated Jobs</h3>
                <div className="space-y-2">
                  {contact.associatedJobs && contact.associatedJobs.length > 0 ? (
                    contact.associatedJobs.map((job) => (
                      <a
                        key={job.id}
                        href={`/job/${job.id}`}
                        className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <p className="text-sm font-medium text-gray-900">{job.title}</p>
                        <p className="text-xs text-gray-500 capitalize mt-1">{job.status.toLowerCase()}</p>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">No associated jobs</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Activity & Communication */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                {[
                  { id: 'activity', label: 'Activity', icon: Calendar },
                  { id: 'communication', label: 'Communication', icon: MessageSquare },
                  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
                  { id: 'interviews', label: 'Interviews', icon: Calendar },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    {contact.activities && contact.activities.length > 0 ? (
                      contact.activities.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-4 border-l-2 border-blue-200 pl-4 py-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Calendar size={16} className="text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {activity.user?.name} • {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'communication' && (
                  <div className="space-y-4">
                    {contact.communications && contact.communications.length > 0 ? (
                      contact.communications.map((comm) => (
                        <div key={comm.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-700 uppercase">
                              {comm.type} • {comm.direction}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comm.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {comm.subject && (
                            <p className="text-sm font-medium text-gray-900 mb-1">{comm.subject}</p>
                          )}
                          <p className="text-sm text-gray-600">{comm.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">No communications yet</p>
                    )}
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">Tasks feature coming soon</p>
                  </div>
                )}

                {activeTab === 'interviews' && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">Interviews feature coming soon</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
