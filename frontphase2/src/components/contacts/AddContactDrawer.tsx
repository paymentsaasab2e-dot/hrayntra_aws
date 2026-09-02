'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Briefcase, Building2, Mail, User, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  apiCreateContact,
  apiDetectContactDuplicates,
  apiGetClients,
  apiGetUsers,
  type CreateContactData,
  type BackendContact,
} from '../../lib/api';
import { NAME_SALUTATION_OPTIONS, formatDirectorDisplay } from '../../constants/salutations';
import { mapUniqueClientOptions } from '../../lib/companyNameKey';
import { DrawerFormShell, DrawerFormCancelButton } from '../drawers/DrawerFormShell';
import {
  DrawerFieldLabel,
  DrawerSectionCard,
  DrawerSelectDropdown,
  DRAWER_FORM_INPUT,
} from '../drawers/drawerFormUi';

interface AddContactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contact?: BackendContact) => void | Promise<void>;
}

export function AddContactDrawer({ isOpen, onClose, onSuccess }: AddContactDrawerProps) {
  const [formData, setFormData] = useState<CreateContactData>({
    salutation: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: '',
    designation: '',
    department: '',
    location: '',
    linkedinUrl: '',
    contactType: 'CLIENT',
    status: 'ACTIVE',
    ownerId: '',
    tags: [],
  });
  const [clients, setClients] = useState<Array<{ id: string; companyName: string }>>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<BackendContact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
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

      void fetchOptions();
    } else {
      setFormData({
        salutation: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        companyId: '',
        designation: '',
        department: '',
        location: '',
        linkedinUrl: '',
        contactType: 'CLIENT',
        status: 'ACTIVE',
        ownerId: '',
        tags: [],
      });
      setDuplicateWarning(null);
      setErrors({});
    }
  }, [isOpen]);

  const handleEmailBlur = async () => {
    if (formData.email) {
      try {
        const response = await apiDetectContactDuplicates(
          formData.email,
          formatDirectorDisplay(formData.salutation, `${formData.firstName} ${formData.lastName}`.trim()),
        );
        if (response.data?.duplicates && response.data.duplicates.length > 0) {
          setDuplicateWarning(response.data.duplicates[0].contact);
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error('Failed to check duplicates:', error);
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email?.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await apiCreateContact(formData);

      if (response.data && (response.data as any).duplicate) {
        setDuplicateWarning((response.data as any).existingContact);
        toast.warning('Duplicate contact detected');
        return;
      }

      toast.success('Contact created successfully');
      await onSuccess(response.data?.data ?? response.data);
      onClose();
    } catch (error: any) {
      if (error.status === 409) {
        setDuplicateWarning(error.data?.existingContact);
        toast.warning('Duplicate contact detected');
      } else {
        toast.error(error.message || 'Failed to create contact');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field?: string) =>
    `${DRAWER_FORM_INPUT} ${field && errors[field] ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : ''}`;

  return (
    <DrawerFormShell
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      subtitle="Create a new contact and link them to a company"
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
            {isSubmitting ? 'Creating...' : 'Add Contact'}
          </button>
        </>
      }
    >
      {duplicateWarning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">A contact with this email already exists:</p>
              <p className="mt-1 text-sm text-amber-800">
                {formatDirectorDisplay(
                  duplicateWarning.salutation,
                  `${duplicateWarning.firstName} ${duplicateWarning.lastName}`.trim(),
                )}
                {duplicateWarning.company ? ` • ${duplicateWarning.company.companyName}` : ''}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/contacts/${duplicateWarning.id}`, '_blank');
                    setDuplicateWarning(null);
                  }}
                  className="text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                >
                  View Existing Contact
                </button>
                <span className="text-amber-400">|</span>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
            <DrawerFieldLabel label="First Name" icon={User} iconClassName="text-blue-500" required />
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={inputClass('firstName')}
              placeholder="Jane"
            />
            {errors.firstName ? <p className="mt-1 text-xs text-red-600">{errors.firstName}</p> : null}
          </div>
          <div className="sm:col-span-5">
            <DrawerFieldLabel label="Last Name" required />
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={inputClass('lastName')}
              placeholder="Smith"
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
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onBlur={() => void handleEmailBlur()}
              className={inputClass('email')}
              placeholder="jane@company.com"
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>
          <div>
            <DrawerFieldLabel label="Phone" />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={DRAWER_FORM_INPUT}
              placeholder="+1 234 567 8900"
            />
          </div>
          <div>
            <DrawerFieldLabel label="Location" />
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={DRAWER_FORM_INPUT}
              placeholder="City, Country"
            />
          </div>
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="LinkedIn URL" />
            <input
              type="url"
              value={formData.linkedinUrl}
              onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
              className={DRAWER_FORM_INPUT}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Company Information" subtitle="Organization and role" icon={Building2} accent="emerald">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DrawerFieldLabel label="Company" icon={Building2} iconClassName="text-emerald-500" />
            <DrawerSelectDropdown
              value={formData.companyId ?? ''}
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
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className={DRAWER_FORM_INPUT}
              placeholder="HR Manager"
            />
          </div>
          <div>
            <DrawerFieldLabel label="Department" />
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className={DRAWER_FORM_INPUT}
              placeholder="Human Resources"
            />
          </div>
        </div>
      </DrawerSectionCard>

      <DrawerSectionCard title="Additional Information" subtitle="Type and ownership" icon={Briefcase} accent="sky">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <DrawerFieldLabel label="Contact Type" />
            <DrawerSelectDropdown
              value={formData.contactType ?? 'CLIENT'}
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
              onChange={(contactType) => setFormData({ ...formData, contactType: contactType as CreateContactData['contactType'] })}
            />
          </div>
          <div>
            <DrawerFieldLabel label="Owner" />
            <DrawerSelectDropdown
              value={formData.ownerId ?? ''}
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
