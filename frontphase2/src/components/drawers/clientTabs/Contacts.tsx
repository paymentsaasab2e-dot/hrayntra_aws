'use client';

import React from 'react';
import { ChevronRight, ChevronDown, UserPlus, Mail, Edit2, Trash2, X } from 'lucide-react';
import { requestWarning, requestError } from '../../../lib/appDialog';
import { CreateContactData, apiUpdateContact, apiCreateContact } from '../../../lib/api';
import { WhatsAppIcon } from '../../icons/WhatsAppIcon';
import { AnimatePresence, motion } from 'motion/react';
import { cleanDisplayText } from '../../../lib/sanitizeMojibake';
import { visiblePreferredChannel } from '../../../lib/contactEmail';

export function ClientContactsTab(props: any) {
  const {
    ADD_CONTACT_DEPARTMENTS,
    addContactDeptOpen,
    addContactForm,
    client,
    clientContacts,
    contactToDelete,
    deletingContact,
    editingContactId,
    handleDeleteContact,
    handleEditContactClick,
    handleEmailClick,
    handleWhatsAppClick,

    loadingContacts,
    openAddContactForm,
    refreshClientContacts,
    resetContactForm,
    selectedContact,
    setAddContactDeptOpen,
    setAddContactForm,
    setContactToDelete,
    setEditingContactId,
    setSelectedContact,
    setShowAddContactForm,
    showAddContactForm,
  } = props;

  return (
showAddContactForm ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={() => setShowAddContactForm(false)}
                          className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Back to Contacts"
                        >
                          <ChevronRight size={20} className="rotate-180" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900">{editingContactId ? 'Edit Contact' : 'Add Contact'}</h2>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                        <div>
                          <label htmlFor="add-contact-name" className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                          <input
                            id="add-contact-name"
                            type="text"
                            value={addContactForm.fullName}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Full name"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-contact-designation" className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                          <input
                            id="add-contact-designation"
                            type="text"
                            value={addContactForm.designation}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, designation: e.target.value }))}
                            placeholder="e.g. Head of Talent"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAddContactDeptOpen((v: any) => !v)}
                              className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-left text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <span className={addContactForm.department ? 'text-slate-900' : 'text-slate-400'}>
                                {addContactForm.department || 'Select department'}
                              </span>
                              <ChevronDown size={16} className="text-slate-400" />
                            </button>
                            {addContactDeptOpen && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddContactDeptOpen(false)} aria-hidden />
                                <ul className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  {ADD_CONTACT_DEPARTMENTS.map((d: any) => (
                                    <li key={d}>
                                      <button
                                        type="button"
                                        onClick={() => { setAddContactForm((p: any) => ({ ...p, department: d })); setAddContactDeptOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${addContactForm.department === d ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                                      >
                                        {d}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="add-contact-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                          <input
                            id="add-contact-email"
                            type="email"
                            value={addContactForm.email}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, email: e.target.value }))}
                            placeholder="email@company.com"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="add-contact-phone" className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                          <input
                            id="add-contact-phone"
                            type="tel"
                            value={addContactForm.phone}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, phone: e.target.value }))}
                            placeholder="+1 (555) 000-0000"
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            id="add-contact-whatsapp"
                            type="checkbox"
                            checked={addContactForm.whatsAppSameAsPhone}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, whatsAppSameAsPhone: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="add-contact-whatsapp" className="text-sm font-medium text-slate-700 cursor-pointer">
                            WhatsApp same as phone
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            id="add-contact-primary"
                            type="checkbox"
                            checked={addContactForm.isPrimary}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, isPrimary: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="add-contact-primary" className="text-sm font-medium text-slate-700 cursor-pointer">
                            Primary Contact
                          </label>
                        </div>
                        <div>
                          <label htmlFor="add-contact-notes" className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                          <textarea
                            id="add-contact-notes"
                            value={addContactForm.notes}
                            onChange={(e: any) => setAddContactForm((p: any) => ({ ...p, notes: e.target.value }))}
                            placeholder="Add notes..."
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddContactForm(false);
                            setEditingContactId(null);
                            resetContactForm();
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!client) return;
                            if (!addContactForm.fullName.trim()) {
                              void requestWarning('Full name is required');
                              return;
                            }
                             
                            try {
                              // Split fullName into firstName and lastName
                              const nameParts = addContactForm.fullName.trim().split(/\s+/);
                              const firstName = nameParts[0] || '';
                              const lastName = nameParts.slice(1).join(' ') || '';

                              const contactData: CreateContactData = {
                                firstName,
                                lastName,
                                email: addContactForm.email || undefined,
                                phone: addContactForm.phone || undefined,
                                designation: addContactForm.designation || undefined,
                                department: addContactForm.department || undefined,
                                clientId: client.id,
                                isPrimary: addContactForm.isPrimary,
                                notes: addContactForm.notes || undefined,
                                whatsAppSameAsPhone: addContactForm.whatsAppSameAsPhone,
                                preferredChannel: 'Email', // Default, can be enhanced later
                              };

                              if (editingContactId) {
                                await apiUpdateContact(editingContactId, contactData);
                              } else {
                                await apiCreateContact(contactData);
                              }
                              setShowAddContactForm(false);
                              setEditingContactId(null);
                              resetContactForm();
                              await refreshClientContacts();
                            } catch (error: any) {
                              console.error('Failed to save contact:', error);
                              void requestError(error.message || 'Failed to save contact');
                            }
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          {editingContactId ? 'Update Contact' : 'Save Contact'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div className="relative flex gap-0 min-h-0">
                    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-w-0 flex flex-col ${selectedContact ? 'mr-4' : ''}`}>
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacts</h4>
                        <button
                          type="button"
                          onClick={openAddContactForm}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <UserPlus size={16} />
                          Add Contact
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Primary</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last contacted</th>
                              <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-32">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {loadingContacts ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                                  Loading contacts...
                                </td>
                              </tr>
                            ) : clientContacts.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                                  No contacts yet. Click Add Contact to add one.
                                </td>
                              </tr>
                            ) : (
                              clientContacts.map((contact: any) => (
                                <tr
                                  key={contact.id}
                                  onClick={() => setSelectedContact(contact)}
                                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                        {contact.avatar ? (
                                          <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                                            {contact.name.charAt(0)}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                                        <p className="text-xs text-slate-500">{contact.designation}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{contact.department}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[140px]">{contact.email || '—'}</td>
                                  <td className="px-4 py-3 text-sm text-slate-600">{contact.phone}</td>
                                  <td className="px-4 py-3 text-center">
                                    {contact.isPrimary ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600" title="Primary contact">
                                        <span className="sr-only">Primary</span>
                                        <span className="text-[10px] font-bold">✓</span>
                                      </span>
                                    ) : (
                                      <span className="inline-block w-6 h-6 rounded-full border border-slate-200 bg-white" />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{contact.lastContacted}</td>
                                  <td className="px-4 py-3 text-right" onClick={(e: any) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleWhatsAppClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="WhatsApp"
                                      >
                                        <WhatsAppIcon size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEmailClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title="Email"
                                      >
                                        <Mail size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditContactClick(contact)}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setContactToDelete(contact)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <AnimatePresence>
                      {selectedContact && (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 320, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                        >
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{selectedContact.name}</h4>
                            <button
                              type="button"
                              onClick={() => setSelectedContact(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              aria-label="Close"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contact info</h5>
                              <div className="space-y-1 text-sm">
                                <p className="font-medium text-slate-900">
                                  {[
                                    cleanDisplayText(selectedContact.designation, ''),
                                    cleanDisplayText(selectedContact.department, ''),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </p>
                                <p className="text-slate-600">{selectedContact.email || '—'}</p>
                                <p className="text-slate-600">{selectedContact.phone}</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preferred communication</h5>
                              <p className="text-sm font-medium text-slate-900">
                                {visiblePreferredChannel(selectedContact.preferredChannel, '—')}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</h5>
                              <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedContact.notes || 'No notes.'}</p>
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Activity</h5>
                              <ul className="space-y-2">
                                {(selectedContact.activity ?? []).length === 0 ? (
                                  <li className="text-sm text-slate-500">No activity yet.</li>
                                ) : (
                                  (selectedContact.activity ?? []).map((a: any, i: any) => (
                                    <li key={i} className="text-sm border-l-2 border-slate-200 pl-3 py-0.5">
                                      <span className="text-slate-500">{a.date}</span>
                                      <span className="font-medium text-slate-700"> {a.type}</span>
                                      <span className="text-slate-600"> — {a.summary}</span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {contactToDelete && (
                      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4">
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                          <h3 className="text-base font-bold text-slate-900">Delete Contact</h3>
                          <p className="mt-2 text-sm text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-slate-900">{contactToDelete.name}</span>?
                            This action cannot be undone.
                          </p>
                          <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setContactToDelete(null)}
                              disabled={deletingContact}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteContact}
                              disabled={deletingContact}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {deletingContact ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )
  );
}
