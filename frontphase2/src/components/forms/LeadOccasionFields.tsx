'use client';

import React from 'react';
import { Cake, Calendar, Gift, Mail, PartyPopper, User } from 'lucide-react';
import {
  emptyLeadOccasionPerson,
  type LeadOccasionContactOption,
  type LeadOccasionFormValues,
  type LeadOccasionPersonFields,
} from '../../lib/leadOccasionDetails';
import { AddLeadFieldLabel, ADD_LEAD_INPUT } from '../drawers/drawerFormUi';

const OCCASION_ROWS: Array<{
  key: keyof LeadOccasionFormValues;
  label: string;
  icon: typeof Cake;
}> = [
  { key: 'birthday', label: 'Birthday', icon: Cake },
  { key: 'anniversary', label: 'Anniversary', icon: Gift },
  { key: 'specialOccasion', label: 'Special Occasion', icon: PartyPopper },
];

export type LeadOccasionFieldsProps = {
  value: LeadOccasionFormValues;
  contacts: LeadOccasionContactOption[];
  onChange: (next: LeadOccasionFormValues) => void;
};

function resolveSelectedContact(
  contacts: LeadOccasionContactOption[],
  person: LeadOccasionPersonFields,
): LeadOccasionContactOption | undefined {
  if (person.contactId) {
    const byId = contacts.find((contact) => contact.id === person.contactId);
    if (byId) return byId;
  }
  const name = person.name.trim().toLowerCase();
  const email = person.email.trim().toLowerCase();
  return contacts.find((contact) => {
    const contactName = contact.name.trim().toLowerCase();
    const contactEmail = contact.email.trim().toLowerCase();
    if (email && contactEmail === email) return true;
    if (name && contactName === name) return true;
    return false;
  });
}

export function LeadOccasionFields({ value, contacts, onChange }: LeadOccasionFieldsProps) {
  const updatePerson = (key: keyof LeadOccasionFormValues, patch: Partial<LeadOccasionPersonFields>) => {
    onChange({
      ...value,
      [key]: {
        ...(value[key] || emptyLeadOccasionPerson()),
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4">
      {OCCASION_ROWS.map(({ key, label, icon: Icon }) => {
        const person = value[key] || emptyLeadOccasionPerson();
        const selected = resolveSelectedContact(contacts, person);
        const selectedId = selected?.id || '';
        const emailOptions = selected
          ? contacts.filter(
              (contact) =>
                contact.name.trim().toLowerCase() === selected.name.trim().toLowerCase() ||
                contact.id === selected.id,
            )
          : contacts;

        return (
          <div
            key={key}
            className="rounded-xl border border-indigo-100/80 bg-indigo-50/20 p-3 space-y-3"
          >
            <AddLeadFieldLabel label={label} icon={Icon} iconClassName="text-indigo-500" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <AddLeadFieldLabel label="Date" icon={Calendar} iconClassName="text-indigo-500" />
                <input
                  type="date"
                  value={person.date}
                  onChange={(e) => updatePerson(key, { date: e.target.value })}
                  className={ADD_LEAD_INPUT}
                />
              </div>
              <div>
                <AddLeadFieldLabel label="Name" icon={User} iconClassName="text-indigo-500" />
                <select
                  value={selectedId}
                  onChange={(e) => {
                    const contact = contacts.find((item) => item.id === e.target.value);
                    if (!contact) {
                      updatePerson(key, { contactId: '', name: '', email: '' });
                      return;
                    }
                    updatePerson(key, {
                      contactId: contact.id,
                      name: contact.name,
                      email: contact.email,
                    });
                  }}
                  className={`${ADD_LEAD_INPUT} bg-white`}
                  disabled={contacts.length === 0}
                >
                  <option value="">
                    {contacts.length === 0 ? 'Add contacts above first…' : 'Select name…'}
                  </option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.email ? ` (${contact.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <AddLeadFieldLabel label="Email" icon={Mail} iconClassName="text-indigo-500" />
                <select
                  value={person.email}
                  onChange={(e) => {
                    const email = e.target.value;
                    const match =
                      emailOptions.find((contact) => contact.email === email) ||
                      contacts.find((contact) => contact.email === email);
                    updatePerson(key, {
                      email,
                      name: match?.name || person.name,
                      contactId: match?.id || person.contactId,
                    });
                  }}
                  className={`${ADD_LEAD_INPUT} bg-white`}
                  disabled={contacts.length === 0}
                >
                  <option value="">
                    {contacts.length === 0 ? 'Add contacts above first…' : 'Select email…'}
                  </option>
                  {(emailOptions.length > 0 ? emailOptions : contacts)
                    .filter((contact) => contact.email)
                    .map((contact) => (
                      <option key={`${contact.id}-email`} value={contact.email}>
                        {contact.email}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
