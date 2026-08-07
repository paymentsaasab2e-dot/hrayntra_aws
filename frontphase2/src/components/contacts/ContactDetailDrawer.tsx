'use client';

import React, { useState } from 'react';
import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';
import { AnimatePresence, motion } from 'motion/react';
import { DetailsModalShell } from '../drawers/DetailsModalShell';
import { X, Mail, Phone, MapPin, Linkedin, Edit, Trash2 } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import type { BackendContact } from '../../lib/api';
import { ContactTypeBadge } from './ContactTypeBadge';
import { OwnerAvatar } from './OwnerAvatar';
import { formatDirectorDisplay } from '../../constants/salutations';
import { formatDateTimeDMY } from '../../utils/dateDisplay';
import { extractAuditMeta } from '../../utils/auditMeta';
import { EntityAuditSummary } from '../table/TableAuditCell';
import { DrawerEntityChatTab } from '../drawers/DrawerEntityChatTab';

interface ContactDetailDrawerProps {
  contact: BackendContact | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (contactId: string) => void;
}

export function ContactDetailDrawer({ contact, isOpen, onClose, onEdit, onDelete }: ContactDetailDrawerProps) {
  usePageDrawerLifecycle(isOpen && Boolean(contact));
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'communication' | 'jobs' | 'chat'>('overview');

  if (!contact) return null;

  const openWhatsApp = () => {
    const rawPhone = contact.phone?.replace(/[^\d+]/g, '').trim();
    if (!rawPhone) {
      window.alert('No phone number is available for this contact.');
      return;
    }

    const phone = rawPhone.startsWith('+') ? rawPhone.slice(1) : rawPhone;
    const message = encodeURIComponent(
      `Hi ${formatDirectorDisplay(contact.salutation, `${contact.firstName} ${contact.lastName}`.trim())},`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const getInitials = () => {
    return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <DetailsModalShell
            onBackdropClick={onClose}
            size="lg"
            zIndexClass="z-[100]"
            dialogTitleId="contact-detail-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="contact-detail-modal-title" className="text-lg font-semibold text-gray-900">Contact Details</h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Contact Header */}
              <div className="flex items-start gap-4 mb-6">
                <ImageWithFallback
                  src={contact.avatarUrl}
                  alt={`${contact.firstName} ${contact.lastName}`}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                  fallback={
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xl">
                      {getInitials()}
                    </div>
                  }
                />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {formatDirectorDisplay(contact.salutation, `${contact.firstName} ${contact.lastName}`.trim())}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{contact.designation || 'No designation'}</p>
                  {contact.company && (
                    <p className="text-sm text-blue-600 font-medium mt-1">{contact.company.companyName}</p>
                  )}
                  <div className="mt-2">
                    <ContactTypeBadge type={contact.contactType} />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
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
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">Owner:</span>
                    <OwnerAvatar owner={contact.owner} />
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 gap-2 mb-6">
                <button
                  onClick={openWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100"
                >
                  <WhatsAppIcon size={16} />
                  Send WhatsApp
                </button>
              </div>

              {/* Tabs */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-1 mb-4">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'activity', label: 'Activity' },
                    { id: 'communication', label: 'Communication' },
                    { id: 'chat', label: 'Chat' },
                    { id: 'jobs', label: 'Jobs' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="mt-4">
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {contact.tags.length > 0 ? (
                            contact.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">No tags</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</h4>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              contact.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-sm text-gray-700 capitalize">{contact.status.toLowerCase()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="space-y-3">
                      <EntityAuditSummary audit={extractAuditMeta(contact as Record<string, unknown>)} />
                      {contact.activities && contact.activities.length > 0 ? (
                        contact.activities.map((activity) => (
                          <div key={activity.id} className="border-l-2 border-blue-200 pl-4 py-2">
                            <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTimeDMY(activity.timestamp)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">No activity yet</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'communication' && (
                    <div className="space-y-3">
                      {contact.communications && contact.communications.length > 0 ? (
                        contact.communications.map((comm) => (
                          <div key={comm.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-700 uppercase">
                                {comm.type} • {comm.direction}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDateTimeDMY(comm.timestamp)}
                              </span>
                            </div>
                            {comm.subject && (
                              <p className="text-sm font-medium text-gray-900 mb-1">{comm.subject}</p>
                            )}
                            <p className="text-sm text-gray-600">{comm.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">No communications yet</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'chat' && (
                    <DrawerEntityChatTab
                      entityType="CONTACT"
                      entityId={contact.id}
                      entityLabel={`${contact.firstName} ${contact.lastName}`.trim()}
                      isActive={activeTab === 'chat'}
                      isOpen={isOpen}
                    />
                  )}

                  {activeTab === 'jobs' && (
                    <div className="space-y-2">
                      {contact.associatedJobs && contact.associatedJobs.length > 0 ? (
                        contact.associatedJobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <span className="text-sm font-medium text-gray-900">{job.title}</span>
                            <span className="text-xs text-gray-500 capitalize">{job.status.toLowerCase()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">No associated jobs</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={() => onDelete(contact.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </DetailsModalShell>
        </>
      )}
    </AnimatePresence>
  );
}
