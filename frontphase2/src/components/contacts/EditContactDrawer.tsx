'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiUpdateContact,
  apiGetClients,
  apiGetUsers,
  type CreateContactData,
  type BackendContact,
} from '../../lib/api';

interface EditContactDrawerProps {
  contact: BackendContact | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditContactDrawer({ contact, isOpen, onClose, onSuccess }: EditContactDrawerProps) {
  const [formData, setFormData] = useState<Partial<CreateContactData>>({});
  const [clients, setClients] = useState<Array<{ id: string; companyName: string }>>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contact && isOpen) {
      setFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || '',
        phone: contact.phone || '',
        companyId: contact.companyId || '',
        designation: contact.designation || '',
        department: contact.department || '',
        location: contact.location || '',
        linkedinUrl: contact.linkedinUrl || '',
        contactType: contact.contactType,
        status: contact.status,
        ownerId: contact.ownerId || '',
        tags: contact.tags || [],
      });
    }

    const fetchOptions = async () => {
      try {
        const [clientsRes, ownersRes] = await Promise.all([
          apiGetClients({ type: 'client' }),
            apiGetUsers({ role: 'RECRUITER' }),
        ]);

        if (clientsRes.data) {
          const clientsData = Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data.data || [];
          setClients(clientsData.map((c: any) => ({ id: c.id, companyName: c.companyName || c.name })));
        }

        if (ownersRes.data) {
          const ownersData = Array.isArray(ownersRes.data) ? ownersRes.data : ownersRes.data.data || [];
          setOwners(ownersData.map((u: any) => ({ id: u.id, name: u.name })));
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      }
    };

    if (isOpen) fetchOptions();
  }, [contact, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email?.trim()) newErrors.email = 'Email is required';
    else if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!contact || !validate()) return;

    setIsSubmitting(true);
    try {
      await apiUpdateContact(contact.id, formData);
      toast.success('Contact updated successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!contact) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-900/40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Contact</h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {/* Same form fields as AddContactDrawer */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.firstName || ''}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          errors.firstName ? 'border-red-300' : 'border-gray-200'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.lastName || ''}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          errors.lastName ? 'border-red-300' : 'border-gray-200'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          errors.email ? 'border-red-300' : 'border-gray-200'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone</label>
                        <input
                          type="tel"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Location</label>
                        <input
                          type="text"
                          value={formData.location || ''}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">LinkedIn URL</label>
                      <input
                        type="url"
                        value={formData.linkedinUrl || ''}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Company Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Company</label>
                      <select
                        value={formData.companyId || ''}
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select company</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.companyName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Designation</label>
                        <input
                          type="text"
                          value={formData.designation || ''}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Department</label>
                        <input
                          type="text"
                          value={formData.department || ''}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Contact Type</label>
                      <select
                        value={formData.contactType || 'CLIENT'}
                        onChange={(e) =>
                          setFormData({ ...formData, contactType: e.target.value as any })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="CANDIDATE">Candidate</option>
                        <option value="CLIENT">Client</option>
                        <option value="HIRING_MANAGER">Hiring Manager</option>
                        <option value="INTERVIEWER">Interviewer</option>
                        <option value="VENDOR">Vendor</option>
                        <option value="DECISION_MAKER">Decision Maker</option>
                        <option value="FINANCE">Finance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                      <select
                        value={formData.status || 'ACTIVE'}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Owner</label>
                      <select
                        value={formData.ownerId || ''}
                        onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Assign owner</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
