'use client';

import React, { useMemo } from 'react';
import { Bell, Calendar, Mail, Plus, Sparkles, Trash2, User } from 'lucide-react';
import {
  createLeadOccasionEventRow,
  LEAD_OCCASION_REMINDER_OPTIONS,
  type LeadOccasionContactOption,
  type LeadOccasionEventRow,
  type LeadOccasionFormValues,
} from '../../lib/leadOccasionDetails';
import { AddLeadFieldLabel, ADD_LEAD_INPUT } from '../drawers/drawerFormUi';

export type LeadOccasionFieldsProps = {
  value: LeadOccasionFormValues;
  contacts: LeadOccasionContactOption[];
  onChange: (next: LeadOccasionFormValues) => void;
};

function resolveSelectedContact(
  contacts: LeadOccasionContactOption[],
  event: LeadOccasionEventRow,
): LeadOccasionContactOption | undefined {
  if (event.contactId) {
    const byId = contacts.find((contact) => contact.id === event.contactId);
    if (byId) return byId;
  }
  const email = event.email.trim().toLowerCase();
  const name = event.name.trim().toLowerCase();
  return contacts.find((contact) => {
    const contactEmail = contact.email.trim().toLowerCase();
    const contactName = contact.name.trim().toLowerCase();
    if (email && contactEmail === email) return true;
    if (name && contactName === name) return true;
    return false;
  });
}

function uniquePersonNames(contacts: LeadOccasionContactOption[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const contact of contacts) {
    const name = contact.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function LeadOccasionFields({ value, contacts, onChange }: LeadOccasionFieldsProps) {
  const events = Array.isArray(value?.events) ? value.events : [];
  const personNames = useMemo(() => uniquePersonNames(contacts), [contacts]);

  const setEvents = (nextEvents: LeadOccasionEventRow[]) => {
    onChange({ events: nextEvents });
  };

  const updateEvent = (id: string, patch: Partial<LeadOccasionEventRow>) => {
    setEvents(events.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  };

  const addEvent = () => {
    setEvents([...events, createLeadOccasionEventRow()]);
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter((event) => event.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <AddLeadFieldLabel label="Events" icon={Sparkles} iconClassName="text-indigo-500" />
        <button
          type="button"
          onClick={addEvent}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100"
          aria-label="Add event"
          title="Add event"
        >
          <Plus size={16} />
        </button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 px-3 py-4 text-center text-xs text-slate-500">
          Click + to add an event row (event, date, reminder, person, email).
        </p>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="hidden min-w-[52rem] gap-2 px-0.5 xl:grid xl:grid-cols-[minmax(7rem,1.05fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.9fr)_minmax(6.5rem,0.95fr)_minmax(7.5rem,1.1fr)_2.25rem]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Name of the event
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Calendar size={10} /> Date
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Bell size={10} /> Reminder
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <User size={10} /> Name of the person
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Mail size={10} /> Email
            </span>
            <span />
          </div>

          {events.map((event) => {
            const selected = resolveSelectedContact(contacts, event);
            const selectedName = (selected?.name || event.name || '').trim();
            const emailOptions = selectedName
              ? contacts.filter(
                  (contact) =>
                    contact.name.trim().toLowerCase() === selectedName.toLowerCase(),
                )
              : contacts;

            return (
              <div
                key={event.id}
                className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-indigo-100/80 bg-indigo-50/20 p-2.5 xl:min-w-[52rem] xl:grid-cols-[minmax(7rem,1.05fr)_minmax(6.5rem,0.85fr)_minmax(6.5rem,0.9fr)_minmax(6.5rem,0.95fr)_minmax(7.5rem,1.1fr)_2.25rem] xl:items-center"
              >
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">
                    Name of the event
                  </label>
                  <input
                    type="text"
                    value={event.eventName}
                    onChange={(e) => updateEvent(event.id, { eventName: e.target.value })}
                    className={ADD_LEAD_INPUT}
                    placeholder="e.g. Birthday, Launch…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">
                    Date
                  </label>
                  <input
                    type="date"
                    value={event.date}
                    onChange={(e) => updateEvent(event.id, { date: e.target.value })}
                    className={ADD_LEAD_INPUT}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">
                    Reminder
                  </label>
                  <select
                    value={event.reminder || 'No reminder'}
                    onChange={(e) => updateEvent(event.id, { reminder: e.target.value })}
                    className={`${ADD_LEAD_INPUT} bg-white`}
                  >
                    {LEAD_OCCASION_REMINDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">
                    Name of the person
                  </label>
                  <select
                    value={selectedName}
                    onChange={(e) => {
                      const name = e.target.value;
                      if (!name) {
                        updateEvent(event.id, { contactId: '', name: '', email: '' });
                        return;
                      }
                      const matches = contacts.filter(
                        (contact) => contact.name.trim().toLowerCase() === name.toLowerCase(),
                      );
                      const preferred =
                        matches.find((contact) => contact.email === event.email) ||
                        matches.find((contact) => contact.email) ||
                        matches[0];
                      updateEvent(event.id, {
                        contactId: preferred?.id || '',
                        name,
                        email: preferred?.email || '',
                      });
                    }}
                    className={`${ADD_LEAD_INPUT} bg-white`}
                    disabled={personNames.length === 0}
                  >
                    <option value="">
                      {personNames.length === 0 ? 'Add contacts above first…' : 'Select person…'}
                    </option>
                    {personNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">
                    Email
                  </label>
                  <select
                    value={event.email || selected?.email || ''}
                    onChange={(e) => {
                      const email = e.target.value;
                      if (!email) {
                        updateEvent(event.id, {
                          email: '',
                          contactId: selectedName
                            ? contacts.find(
                                (c) => c.name.trim().toLowerCase() === selectedName.toLowerCase(),
                              )?.id || ''
                            : '',
                        });
                        return;
                      }
                      const match =
                        emailOptions.find((contact) => contact.email === email) ||
                        contacts.find((contact) => contact.email === email);
                      updateEvent(event.id, {
                        email,
                        name: match?.name || event.name,
                        contactId: match?.id || event.contactId,
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
                <button
                  type="button"
                  onClick={() => removeEvent(event.id)}
                  className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 xl:justify-self-center"
                  aria-label="Remove event"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
