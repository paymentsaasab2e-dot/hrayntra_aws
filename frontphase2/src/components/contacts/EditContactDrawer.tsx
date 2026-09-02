'use client';

import React, { useState, useEffect } from 'react';
import { Briefcase, Building2, Mail, User, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiUpdateContact,
  apiGetClients,
  apiGetUsers,
  type CreateContactData,
  type BackendContact,
} from '../../lib/api';
import { NAME_SALUTATION_OPTIONS } from '../../constants/salutations';
import { visibleContactEmail } from '../../lib/contactEmail';
import { mapUniqueClientOptions } from '../../lib/companyNameKey';
import { DrawerFormShell, DrawerFormCancelButton } from '../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DrawerSelectDropdown,
  DRAWER_FORM_INPUT,
} from '../drawers/drawerFormUi';

interface EditContactDrawerProps {
  contact: BackendContact | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contact?: BackendContact) => void | Promise<void>;
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
        salutation: contact.salutation || '',
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: visibleContactEmail(contact.email),
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
          apiGetUsers({ assignable: true, role: 'RECRUITER' }),
        ]);

        if (clientsRes.data) {
          const clientsData = Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data.data || [];
          setClients(mapUniqueClientOptions(clientsData));
        }

        if (ownersRes.data) {
          const ownersData = Array.isArray(ownersRes.data) ? ownersRes.data : ownersRes.data.data || [];
          setOwners(ownersData.map((u: any) => ({ id: u.id, name: u.name })));
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      }
    };

    if (isOpen) void fetchOptions();
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
      const response = await apiUpdateContact(contact.id, formData);
      toast.success('Contact updated successfully');
      await onSuccess(response.data?.data ?? response.data);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!contact) return null;

  const inputClass = (field?: string) =>
    `${DRAWER_FORM_INPUT} ${field && errors[field] ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : ''}`;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Contact"
      subtitle={`Update details for ${contact.firstName} ${contact.lastName}`}
      headerIcon={UserCircle}
      footer={
        <>
          <DrawerFormCancelButton />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <DrawerSectionCard title="Basic Information" subtitle="Name and salutation" icon={User} accent="blue">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <DrawerFieldLabel label="Salutation" icon={User} iconClassName="text-blue-500" />
            <DrawerSelectDropdown
              value={formData.salutation ?? ''}
              preferUpward
              options={NAME_SALUTATION_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
              onChange={(salutation) => setFormData({ ...formData, salutation })}
            />
          </div>
          <div className="sm:col-span-4">
            <DrawerFieldLabel label="First Name" required />
            <input
              type="text"
              value={formData.firstName || ''}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={inputClass('firstName')}
            />
            {errors.firstName ? <p className="mt-1 text-xs text-red-600">{errors.firstName}</p> : null}
          </div>
          <div className="sm:col-span-5">
            <DrawerFieldLabel label="Last Name" required />
            <input
              type="text"
              value={formData.lastName || ''}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={inputClass('lastName')}
            />
            {errors.lastName ? <p className="mt-1 text-xs text-red-600">{errors.lastName}</p> : null}
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Contact Details" subtitle="Email, phone, and social" icon={Mail} accent="violet">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="Email" icon={Mail} iconClassName="text-violet-500" required />
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass('email')}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>
          <div>
            <DrawerFieldLabel label="Phone" />
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={DRAWER_FORM_INPUT}
            />
          </div>
          <div>
            <DrawerFieldLabel label="Location" />
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={DRAWER_FORM_INPUT}
            />
          </div>
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="LinkedIn URL" />
            <input
              type="url"
              value={formData.linkedinUrl || ''}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              className={DRAWER_FORM_INPUT}
            />
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Company Information" subtitle="Organization and role" icon={Building2} accent="emerald">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="Company" icon={Building2} iconClassName="text-emerald-500" />
            <DrawerSelectDropdown
              value={formData.companyId || ''}
              preferUpward
              placeholder="Select company"
              options={[
                { value: '', label: 'Select company' },
                ...clients.map((client) => ({ value: client.id, label: client.companyName })),
              ]}
              onChange={(companyId) => setFormData({ ...formData, companyId })}
            />
          </div>
          <div>
            <DrawerFieldLabel label="Designation" icon={Briefcase} iconClassName="text-emerald-500" />
            <input
              type="text"
              value={formData.designation || ''}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className={DRAWER_FORM_INPUT}
            />
          </div>
          <div>
            <DrawerFieldLabel label="Department" />
            <input
              type="text"
              value={formData.department || ''}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className={DRAWER_FORM_INPUT}
            />
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Additional Information" subtitle="Type, status, and ownership" icon={Briefcase} accent="sky">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Contact Type" />
            <DrawerSelectDropdown
              value={formData.contactType || 'CLIENT'}
              preferUpward
              options={[
                { value: 'CANDIDATE', label: 'Candidate' },
                { value: 'CLIENT', label: 'Client' },
                { value: 'HIRING_MANAGER', label: 'Hiring Manager' },
                { value: 'INTERVIEWER', label: 'Interviewer' },
                { value: 'VENDOR', label: 'Vendor' },
                { value: 'DECISION_MAKER', label: 'Decision Maker' },
                { value: 'FINANCE', label: 'Finance' },
              ]}
              onChange={(contactType) =>
                setFormData({ ...formData, contactType: contactType as CreateContactData['contactType'] })
              }
            />
          </div>
          <div>
            <DrawerFieldLabel label="Status" />
            <DrawerSelectDropdown
              value={formData.status || 'ACTIVE'}
              preferUpward
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              onChange={(status) =>
                setFormData({ ...formData, status: status as 'ACTIVE' | 'INACTIVE' })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="Owner" />
            <DrawerSelectDropdown
              value={formData.ownerId || ''}
              preferUpward
              placeholder="Assign owner"
              options={[
                { value: '', label: 'Assign owner' },
                ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
              ]}
              onChange={(ownerId) => setFormData({ ...formData, ownerId })}
            />
          </div>
        </div>
      </DrawerSectionCard>
    </DrawerFormShell>
  );
}
