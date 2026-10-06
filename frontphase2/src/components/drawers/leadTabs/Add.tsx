'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AddLeadSectionCard, AddLeadFieldLabel, AddLeadIconInput, ADD_LEAD_INPUT, AddLeadSelectDropdown } from '../drawerFormUi';
import { Target, Building2, Link2, Plus, Globe, Trash2, MapPin, Briefcase, Users, Megaphone, Flag, Calendar, UserCog, IndianRupee, Layers, FileText, Gift, ChevronDown, ChevronRight, User } from 'lucide-react';
import { HqProductLineSelectBoxes } from '../../hq/HqProductLinePicker';
import { LeadLocationFields } from '../../location/LeadLocationFields';
import { mergeLocationFields, validateLeadRequiredFields, syncLeadTeamMembers, LeadStatusDropdown } from '../leadDetailsShared';
import { IndustryMultiSelect } from '../../forms/IndustryMultiSelect';
import { DirectorContactFields } from '../../forms/DirectorContactFields';
import { normalizeDirectorList } from '../../../lib/directorFormDetails';
import { TeamMemberOptionalFields } from '../../forms/TeamMemberOptionalFields';
import { LeadSourceFields } from '../LeadSourceFields';
import { LeadStatus } from '@/app/leads/types';
import { LeadFollowUpScheduler } from '../../LeadFollowUpScheduler';
import { LeadAssigneesMultiSelect } from '../LeadAssigneesMultiSelect';
import { ServicesNeededSelect } from '../../forms/ServicesNeededSelect';
import { sanitizeBusinessValueInput } from '../../../lib/businessValue';
import { isTeamMemberDetailLabel } from '../../../lib/teamMemberFormDetails';
import { isLeadOccasionDetailLabel, emptyLeadOccasionForm, buildLeadOccasionContactOptions } from '../../../lib/leadOccasionDetails';
import { isInternalLeadOtherDetailLabel } from '../../../lib/leadInternalOtherDetails';
import { LeadOccasionFields } from '../../forms/LeadOccasionFields';

export function LeadAddTab(props: any) {
  const {
    addCompanyLinkField,
    addLeadErrors,
    addLeadForm,
    addLeadHqStatusMode,
    addLeadSectionsOpen,
    addLeadStatusOption,
    addLeadStatusOptions,
    addLeadWizardStep,
    addLeadWizardStepErrors,
    companyLinks,
    deleteLeadStatusOption,
    deletingLeadStatus,
    handleHqStatusSelect,
    hqAssignedToPlaceholder,
    hqProductLine,
    isHqOverrideMode,
    leadAssignmentModule,
    loadingRecruiters,
    newLeadStatusValue,
    recruiters,
    removeCompanyLinkField,
    savingLeadStatus,
    setAddLeadErrors,
    setAddLeadForm,
    setHqProductLine,
    setNewLeadStatusValue,
    setShowAddLeadStatusInput,
    showAddLeadStatusInput,
    toggleAddLeadSection,
    updateCompanyLink,
  } = props;

  return (
<>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={addLeadWizardStep}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                  >
                  {addLeadWizardStep === 'workspace' && isHqOverrideMode ? (
                    <AddLeadSectionCard
                      title="Workspace"
                      subtitle="Choose CRM or Recruitment for this HQ lead"
                      icon={Target}
                      accent="indigo"
                    >
                      <AddLeadFieldLabel label="Product line" icon={Target} iconClassName="text-indigo-500" required />
                      <HqProductLineSelectBoxes value={hqProductLine} onChange={setHqProductLine} />
                      <p className="mt-2 text-xs text-slate-500">You can select CRM, Recruitment, or both.</p>
                    </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'company' ? (
                  <AddLeadSectionCard
                    title="Company Details"
                    subtitle="Organization name and online presence"
                    icon={Building2}
                    accent="blue"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <AddLeadFieldLabel label="Company" icon={Building2} iconClassName="text-blue-500" required />
                        <AddLeadIconInput
                          icon={Building2}
                          iconClassName="text-blue-400"
                          value={addLeadForm.companyName}
                          onChange={(e: any) => {
                            setAddLeadForm((p: any) => ({ ...p, companyName: e.target.value }));
                            if (addLeadErrors.companyName) {
                              setAddLeadErrors((prev: any) => ({ ...prev, companyName: undefined }));
                            }
                          }}
                          placeholder="e.g. Acme Inc."
                        />
                        {addLeadErrors.companyName ? (
                          <p className="mt-1 text-xs text-rose-600">{addLeadErrors.companyName}</p>
                        ) : null}
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <AddLeadFieldLabel label="Company Links" icon={Link2} iconClassName="text-blue-500" />
                          <button
                            type="button"
                            onClick={addCompanyLinkField}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                            aria-label="Add company link"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {companyLinks.map((link: any, index: any) => (
                            <div key={`company-link-${index}`} className="flex items-center gap-2">
                              <AddLeadIconInput
                                icon={Globe}
                                iconClassName="text-blue-400"
                                value={link}
                                onChange={(e: any) => updateCompanyLink(index, e.target.value)}
                                placeholder="https://company.com or LinkedIn URL"
                              />
                              {companyLinks.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeCompanyLinkField(index)}
                                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                  aria-label={`Remove company link ${index + 1}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'location' ? (
                  <AddLeadSectionCard
                    title="Location & Industry"
                    subtitle="Where the company operates"
                    icon={MapPin}
                    accent="emerald"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <LeadLocationFields
                          location={addLeadForm.location ?? ''}
                          city={addLeadForm.city ?? ''}
                          state={addLeadForm.state ?? ''}
                          country={addLeadForm.country ?? ''}
                          countryCode={addLeadForm.countryCode ?? ''}
                          latitude={addLeadForm.latitude ?? null}
                          longitude={addLeadForm.longitude ?? null}
                          showDetectedHint={false}
                          deviceLocationMode="country-preview"
                          countryError={addLeadErrors.country}
                          stateError={addLeadErrors.state}
                          onLocationChange={(next: any) => setAddLeadForm((p: any) => ({ ...p, location: next }))}
                          onSelect={(s: any) => {
                            setAddLeadForm((p: any) => mergeLocationFields(p, s));
                            setAddLeadErrors((prev: any) => ({
                              ...prev,
                              country: undefined,
                              state: undefined,
                            }));
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                        <IndustryMultiSelect
                          value={addLeadForm.industry ?? ''}
                          onChange={(industry: any) => setAddLeadForm((p: any) => ({ ...p, industry }))}
                          companyName={addLeadForm.companyName ?? ''}
                          placeholder="Type an industry (e.g. technology, healthcare)"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          Select one or more industries. Press Enter to add a custom industry.
                        </p>
                      </div>
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'contacts' ? (
                  <AddLeadSectionCard
                    title="Contacts"
                    subtitle="Director and team member details"
                    icon={Users}
                    accent="violet"
                  >
                    <div className="space-y-4">
                        <DirectorContactFields
                          directorSalutation={addLeadForm.directorSalutation}
                          contactPerson={addLeadForm.contactPerson}
                          directors={addLeadForm.directors}
                          onDirectorsChange={(directors: any) =>
                            setAddLeadForm((p: any) => ({ ...p, directors: normalizeDirectorList(directors) }))
                          }
                          emails={addLeadForm.emails}
                          phones={addLeadForm.phones}
                          email={addLeadForm.email}
                          phone={addLeadForm.phone}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          allowNotAvailable
                          emailNotAvailable={Boolean(addLeadForm.emailNotAvailable)}
                          phoneNotAvailable={Boolean(addLeadForm.phoneNotAvailable)}
                          onEmailNotAvailableChange={(emailNotAvailable: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              emailNotAvailable,
                              ...(emailNotAvailable ? { emails: [''], email: '' } : {}),
                            }));
                            setAddLeadErrors((prev: any) => ({ ...prev, email: undefined }));
                          }}
                          onPhoneNotAvailableChange={(phoneNotAvailable: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              phoneNotAvailable,
                              ...(phoneNotAvailable ? { phones: [''], phone: '' } : {}),
                            }));
                            setAddLeadErrors((prev: any) => ({ ...prev, phone: undefined }));
                          }}
                          onDirectorSalutationChange={(value: any) =>
                            setAddLeadForm((p: any) => ({ ...p, directorSalutation: value }))
                          }
                          onContactPersonChange={(value: any) => {
                            setAddLeadForm((p: any) => ({ ...p, contactPerson: value }));
                            if (addLeadErrors.contactPerson) {
                              setAddLeadErrors((prev: any) => ({ ...prev, contactPerson: undefined }));
                            }
                          }}
                          onEmailsChange={(emails: any, primaryEmail: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              emails,
                              email: primaryEmail,
                              emailNotAvailable: primaryEmail.trim() ? false : p.emailNotAvailable,
                            }));
                            if (addLeadErrors.email) {
                              setAddLeadErrors((prev: any) => ({ ...prev, email: undefined }));
                            }
                          }}
                          onPhonesChange={(phones: any, primaryPhone: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              phones,
                              phone: primaryPhone,
                              phoneNotAvailable: primaryPhone.trim() ? false : p.phoneNotAvailable,
                            }));
                            if (addLeadErrors.phone) {
                              setAddLeadErrors((prev: any) => ({ ...prev, phone: undefined }));
                            }
                          }}
                          contactPersonError={addLeadWizardStepErrors.contactPerson || addLeadErrors.contactPerson}
                          emailError={addLeadWizardStepErrors.email || addLeadErrors.email}
                          phoneError={addLeadWizardStepErrors.phone || addLeadErrors.phone}
                          onContactPersonBlur={() => {
                            const nextErrors = validateLeadRequiredFields(addLeadForm);
                            setAddLeadErrors((prev: any) => ({
                              ...prev,
                              contactPerson: nextErrors.contactPerson,
                            }));
                          }}
                        />
                        <TeamMemberOptionalFields
                          requireTeamName={false}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          members={addLeadForm.teamMembers}
                          onChange={(teamMembers: any) =>
                            setAddLeadForm((p: any) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                          }
                        />
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'source' ? (
                  <AddLeadSectionCard
                    title="Source & Qualification"
                    subtitle="How you found this lead and its stage"
                    icon={Megaphone}
                    accent="amber"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <LeadSourceFields
                          form={addLeadForm}
                          onChange={(patch: any) => setAddLeadForm((p: any) => ({ ...p, ...patch }))}
                        />
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <AddLeadFieldLabel label="Status" icon={Flag} iconClassName="text-amber-500" />
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddLeadStatusInput((prev: any) => !prev);
                              setNewLeadStatusValue('');
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add status
                          </button>
                        </div>
                        <LeadStatusDropdown
                          value={addLeadForm.status ?? 'New'}
                          options={addLeadStatusOptions}
                          deleting={deletingLeadStatus}
                          preferUpward
                          hqMode={addLeadHqStatusMode}
                          onSelect={(status: any) =>
                            handleHqStatusSelect(status, (next: any) =>
                              setAddLeadForm((p: any) => ({ ...p, status: next as LeadStatus })),
                            )
                          }
                          onDelete={(status: any) =>
                            deleteLeadStatusOption(status, (nextStatus: any) =>
                              setAddLeadForm((p: any) => ({ ...p, status: nextStatus as LeadStatus })),
                            )
                          }
                        />
                        {showAddLeadStatusInput ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={newLeadStatusValue}
                              onChange={(e: any) => setNewLeadStatusValue(e.target.value)}
                              className={ADD_LEAD_INPUT}
                              placeholder="Enter new status"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                addLeadStatusOption((status: any) =>
                                  setAddLeadForm((p: any) => ({ ...p, status: status as LeadStatus })),
                                )
                              }
                              disabled={savingLeadStatus}
                              className="rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingLeadStatus ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddLeadStatusInput(false);
                                setNewLeadStatusValue('');
                              }}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <AddLeadFieldLabel label="Interest Level" icon={Target} iconClassName="text-amber-500" />
                        <AddLeadSelectDropdown
                          value={addLeadForm.priority ?? 'Medium'}
                          preferUpward
                          leadingIcon={Target}
                          leadingIconClassName="text-amber-400"
                          triggerClassName={`${ADD_LEAD_INPUT} flex w-full items-center justify-between text-left`}
                          options={[
                            { value: 'High', label: 'High' },
                            { value: 'Medium', label: 'Medium' },
                            { value: 'Low', label: 'Low' },
                          ]}
                          onChange={(priority: any) =>
                            setAddLeadForm((p: any) => ({
                              ...p,
                              priority: priority as 'High' | 'Medium' | 'Low',
                            }))
                          }
                        />
                      </div>
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'followup' ? (
                  <AddLeadSectionCard
                    title="Follow-up & Assignment"
                    subtitle="Schedule the first follow-up and assign an owner"
                    icon={Calendar}
                    accent="sky"
                  >
                    <div className="space-y-4">
                      <LeadFollowUpScheduler
                        value={{
                          nextFollowUp: addLeadForm.nextFollowUp ?? '',
                          followUpType: addLeadForm.followUpType || 'Call',
                          followUpContact: addLeadForm.followUpContact,
                          followUpMeetLink: addLeadForm.followUpMeetLink,
                          followUpReminder: addLeadForm.followUpReminder,
                          followUpTimezone: addLeadForm.followUpTimezone,
                          followUpAttendeeIds: addLeadForm.followUpAttendeeIds,
                          followUpNotes: addLeadForm.followUpNotes,
                          followUpPostponed: addLeadForm.followUpPostponed,
                          followUpPostponeReason: addLeadForm.followUpPostponeReason,
                          followUpPostponePreset: addLeadForm.followUpPostponePreset,
                        }}
                        onChange={(patch: any) => setAddLeadForm((p: any) => ({ ...p, ...patch }))}
                        phoneOptions={[...(addLeadForm.phones || []).map((phone: any) => phone ?? ''), addLeadForm.phone ?? '']}
                        emailOptions={[...(addLeadForm.emails || []), addLeadForm.email].filter((value: any): value is string => Boolean(value))}
                        teamMembers={recruiters}
                        loadingMembers={loadingRecruiters}
                        showPostpone={false}
                        inputClassName={ADD_LEAD_INPUT}
                      />
                      <div>
                        <AddLeadFieldLabel label="Assigned To" icon={UserCog} iconClassName="text-sky-500" />
                        <LeadAssigneesMultiSelect
                          members={recruiters}
                          value={
                            addLeadForm.assignedToIds ??
                            (addLeadForm.assignedToId ? [addLeadForm.assignedToId] : [])
                          }
                          loading={loadingRecruiters}
                        assignmentModule={leadAssignmentModule}
                          placeholder={hqAssignedToPlaceholder}
                          onChange={(ids: any) => {
                            const selected = ids
                              .map((id: any) => recruiters.find((r: any) => r.id === id))
                              .filter(Boolean);
                            const primary = selected[0];
                            const assignedToName = selected
                              .map((m: any) =>
                                `${m!.firstName || ''} ${m!.lastName || ''}`.trim() || m!.name || m!.email,
                              )
                              .filter(Boolean)
                              .join(', ');
                            setAddLeadForm((p: any) => ({
                              ...p,
                              assignedToIds: ids,
                              assignedToId: ids[0] ?? '',
                              assignedToName:
                                assignedToName ||
                                (primary
                                  ? `${primary.firstName} ${primary.lastName}`.trim()
                                  : ''),
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'business' ? (
                  <AddLeadSectionCard
                    title="Business Opportunity"
                    subtitle="Services and expected value"
                    icon={IndianRupee}
                    accent="rose"
                  >
                    <div className="space-y-4">
                      <div>
                        <AddLeadFieldLabel label="Services Needed" icon={Layers} iconClassName="text-rose-500" />
                        <ServicesNeededSelect
                          value={addLeadForm.interestedNeeds ?? ''}
                          onChange={(interestedNeeds: any) =>
                            setAddLeadForm((p: any) => ({ ...p, interestedNeeds }))
                          }
                          industry={addLeadForm.industry ?? ''}
                        />
                      </div>
                      <div>
                        <AddLeadFieldLabel
                          label="Expected Business Value"
                          icon={IndianRupee}
                          iconClassName="text-rose-500"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={addLeadForm.notes ?? ''}
                          onChange={(e: any) =>
                            setAddLeadForm((p: any) => ({
                              ...p,
                              notes: sanitizeBusinessValueInput(e.target.value),
                            }))
                          }
                          className={ADD_LEAD_INPUT}
                          placeholder="e.g. 1500000"
                        />
                      </div>
                      {(() => {
                        const publicOtherDetails = Array.isArray(addLeadForm.otherDetails)
                          ? addLeadForm.otherDetails.filter(
                              (item: any) =>
                                !isTeamMemberDetailLabel(item.label) &&
                                !isLeadOccasionDetailLabel(item.label) &&
                                !isInternalLeadOtherDetailLabel(item.label),
                            )
                          : [];
                        if (!publicOtherDetails.length) return null;
                        return (
                        <div>
                          <AddLeadFieldLabel label="Other Details" icon={FileText} iconClassName="text-rose-500" />
                          <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3">
                            {publicOtherDetails.map((item: any, index: any) => (
                              <div key={`${item.label}-${index}`} className="text-sm">
                                <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                <span className="text-slate-600">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                  </AddLeadSectionCard>
                  ) : null}

                  {addLeadWizardStep === 'other' ? (
                  <AddLeadSectionCard
                    title="Other"
                    subtitle="Add events with name, date, reminder, and email"
                    icon={Gift}
                    accent="indigo"
                  >
                    <LeadOccasionFields
                      value={addLeadForm.occasions || emptyLeadOccasionForm()}
                      contacts={buildLeadOccasionContactOptions({
                        directorName: addLeadForm.contactPerson,
                        directorEmail: addLeadForm.email,
                        directorEmails: addLeadForm.emails,
                        teamMembers: addLeadForm.teamMembers,
                      })}
                      onChange={(occasions: any) => setAddLeadForm((p: any) => ({ ...p, occasions }))}
                    />
                  </AddLeadSectionCard>
                  ) : null}

                  </motion.div>
                </AnimatePresence>

                  <div className="hidden">
                  {/* Section 1 — Company Information */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('company')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        Company Information
                      </h4>
                      {addLeadSectionsOpen.company ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.company && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                          <input
                            value={addLeadForm.companyName}
                            onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, companyName: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Acme Inc."
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                          <IndustryMultiSelect
                            value={addLeadForm.industry ?? ''}
                            onChange={(industry: any) => setAddLeadForm((p: any) => ({ ...p, industry }))}
                            companyName={addLeadForm.companyName ?? ''}
                            placeholder="Type an industry (e.g. technology, healthcare)"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Links</label>
                          <input
                            value={addLeadForm.website ?? ''}
                            onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, website: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="https://company.com or LinkedIn URL"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                          <input
                            value={addLeadForm.location ?? ''}
                            onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, location: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Downtown Office"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                          <input
                            value={addLeadForm.city ?? ''}
                            onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, city: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. San Francisco"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                          <input
                            value={addLeadForm.country ?? ''}
                            onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, country: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. United States"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Section 2 — Contact Person */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('contact')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        Contact
                      </h4>
                      {addLeadSectionsOpen.contact ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.contact && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <DirectorContactFields
                          directorSalutation={addLeadForm.directorSalutation}
                          contactPerson={addLeadForm.contactPerson}
                          directors={addLeadForm.directors}
                          onDirectorsChange={(directors: any) =>
                            setAddLeadForm((p: any) => ({ ...p, directors: normalizeDirectorList(directors) }))
                          }
                          emails={addLeadForm.emails}
                          phones={addLeadForm.phones}
                          email={addLeadForm.email}
                          phone={addLeadForm.phone}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          allowNotAvailable
                          emailNotAvailable={Boolean(addLeadForm.emailNotAvailable)}
                          phoneNotAvailable={Boolean(addLeadForm.phoneNotAvailable)}
                          onEmailNotAvailableChange={(emailNotAvailable: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              emailNotAvailable,
                              ...(emailNotAvailable ? { emails: [''], email: '' } : {}),
                            }));
                            setAddLeadErrors((prev: any) => ({ ...prev, email: undefined }));
                          }}
                          onPhoneNotAvailableChange={(phoneNotAvailable: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              phoneNotAvailable,
                              ...(phoneNotAvailable ? { phones: [''], phone: '' } : {}),
                            }));
                            setAddLeadErrors((prev: any) => ({ ...prev, phone: undefined }));
                          }}
                          onDirectorSalutationChange={(value: any) =>
                            setAddLeadForm((p: any) => ({ ...p, directorSalutation: value }))
                          }
                          onContactPersonChange={(value: any) => {
                            setAddLeadForm((p: any) => ({ ...p, contactPerson: value }));
                            if (addLeadErrors.contactPerson) {
                              setAddLeadErrors((prev: any) => ({ ...prev, contactPerson: undefined }));
                            }
                          }}
                          onEmailsChange={(emails: any, primaryEmail: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              emails,
                              email: primaryEmail,
                              emailNotAvailable: primaryEmail.trim() ? false : p.emailNotAvailable,
                            }));
                            if (addLeadErrors.email) {
                              setAddLeadErrors((prev: any) => ({ ...prev, email: undefined }));
                            }
                          }}
                          onPhonesChange={(phones: any, primaryPhone: any) => {
                            setAddLeadForm((p: any) => ({
                              ...p,
                              phones,
                              phone: primaryPhone,
                              phoneNotAvailable: primaryPhone.trim() ? false : p.phoneNotAvailable,
                            }));
                            if (addLeadErrors.phone) {
                              setAddLeadErrors((prev: any) => ({ ...prev, phone: undefined }));
                            }
                          }}
                          contactPersonError={addLeadErrors.contactPerson}
                          emailError={addLeadErrors.email}
                          phoneError={addLeadErrors.phone}
                          onContactPersonBlur={() => {
                            const nextErrors = validateLeadRequiredFields(addLeadForm);
                            setAddLeadErrors((prev: any) => ({
                              ...prev,
                              contactPerson: nextErrors.contactPerson,
                            }));
                          }}
                        />
                        <TeamMemberOptionalFields
                          requireTeamName={false}
                          countryCode={addLeadForm.countryCode}
                          countryName={addLeadForm.country}
                          members={addLeadForm.teamMembers}
                          onChange={(teamMembers: any) =>
                            setAddLeadForm((p: any) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                          }
                        />
                      </div>
                    )}
                  </section>

                  {/* Section 3 — Lead Details */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleAddLeadSection('leadDetails')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Target size={14} className="text-slate-400" />
                        Lead Details
                      </h4>
                      {addLeadSectionsOpen.leadDetails ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {addLeadSectionsOpen.leadDetails && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddLeadStatusInput((prev: any) => !prev);
                                    setNewLeadStatusValue('');
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add status
                                </button>
                              </div>
                            </div>
                            <LeadStatusDropdown
                              value={addLeadForm.status ?? 'New'}
                              options={addLeadStatusOptions}
                              deleting={deletingLeadStatus}
                              hqMode={addLeadHqStatusMode}
                              onSelect={(status: any) =>
                                handleHqStatusSelect(status, (next: any) =>
                                  setAddLeadForm((p: any) => ({ ...p, status: next as LeadStatus })),
                                )
                              }
                              onDelete={(status: any) =>
                                deleteLeadStatusOption(status, (nextStatus: any) =>
                                  setAddLeadForm((p: any) => ({ ...p, status: nextStatus as LeadStatus })),
                                )
                              }
                            />
                            {showAddLeadStatusInput ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  value={newLeadStatusValue}
                                  onChange={(e: any) => setNewLeadStatusValue(e.target.value)}
                                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="Enter new status"
                                />
                                <button
                                  type="button"
                                  onClick={() => addLeadStatusOption((status: any) => setAddLeadForm((p: any) => ({ ...p, status: status as LeadStatus })))}
                                  disabled={savingLeadStatus}
                                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {savingLeadStatus ? 'Adding...' : 'Add'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddLeadStatusInput(false);
                                    setNewLeadStatusValue('');
                                  }}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interest Level</label>
                            <select
                              value={addLeadForm.priority ?? 'Medium'}
                              onChange={(e: any) => setAddLeadForm((p: any) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                          <ServicesNeededSelect
                            value={addLeadForm.interestedNeeds ?? ''}
                            onChange={(interestedNeeds: any) => setAddLeadForm((p: any) => ({ ...p, interestedNeeds }))}
                            industry={addLeadForm.industry ?? ''}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={addLeadForm.notes ?? ''}
                            onChange={(e: any) =>
                              setAddLeadForm((p: any) => ({
                                ...p,
                                notes: sanitizeBusinessValueInput(e.target.value),
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 50000"
                          />
                        </div>
                        <div>
                          <LeadFollowUpScheduler
                            value={{
                              nextFollowUp: addLeadForm.nextFollowUp ?? '',
                              followUpType: addLeadForm.followUpType || 'Call',
                              followUpContact: addLeadForm.followUpContact,
                              followUpMeetLink: addLeadForm.followUpMeetLink,
                              followUpReminder: addLeadForm.followUpReminder,
                              followUpTimezone: addLeadForm.followUpTimezone,
                              followUpAttendeeIds: addLeadForm.followUpAttendeeIds,
                              followUpNotes: addLeadForm.followUpNotes,
                              followUpPostponed: addLeadForm.followUpPostponed,
                              followUpPostponeReason: addLeadForm.followUpPostponeReason,
                              followUpPostponePreset: addLeadForm.followUpPostponePreset,
                            }}
                            onChange={(patch: any) => setAddLeadForm((p: any) => ({ ...p, ...patch }))}
                            phoneOptions={[...(addLeadForm.phones || []).map((phone: any) => phone ?? ''), addLeadForm.phone ?? '']}
                            emailOptions={[...(addLeadForm.emails || []), addLeadForm.email].filter((value: any): value is string => Boolean(value))}
                            teamMembers={recruiters}
                            loadingMembers={loadingRecruiters}
                            showPostpone={false}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                          <LeadAssigneesMultiSelect
                            members={recruiters}
                            value={addLeadForm.assignedToIds ?? (addLeadForm.assignedToId ? [addLeadForm.assignedToId] : [])}
                            loading={loadingRecruiters}
                        assignmentModule={leadAssignmentModule}
                            placeholder={hqAssignedToPlaceholder}
                            onChange={(ids: any) => {
                              const selected = ids
                                .map((id: any) => recruiters.find((r: any) => r.id === id))
                                .filter(Boolean);
                              const primary = selected[0];
                              const assignedToName = selected
                                .map(
                                  (m: any) =>
                                    `${m!.firstName || ''} ${m!.lastName || ''}`.trim() ||
                                    m!.name ||
                                    m!.email,
                                )
                                .filter(Boolean)
                                .join(', ');
                              setAddLeadForm((p: any) => ({
                                ...p,
                                assignedToIds: ids,
                                assignedToId: ids[0] ?? '',
                                assignedToName:
                                  assignedToName ||
                                  (primary
                                    ? `${primary.firstName} ${primary.lastName}`.trim()
                                    : ''),
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </section>
                  </div>
                </>
  );
}
