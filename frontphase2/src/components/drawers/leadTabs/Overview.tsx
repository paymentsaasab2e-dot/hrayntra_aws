'use client';

import React from 'react';
import { isLeadAlreadyConverted, OverviewField, getSourceFieldLabel, getLeadSourceDetailValue, OverviewFieldDateTime, parseLeadDemoNotes, mergeLocationFields, syncLeadTeamMembers, LeadStatusDropdown, FieldRow, FieldRowDateTime } from '../leadDetailsShared';
import { EntityWorkspaceAlertsPanel } from '../../ai/EntityWorkspaceAlertsPanel';
import { AddLeadSectionCard, AddLeadFieldLabel, ADD_LEAD_INPUT } from '../drawerFormUi';
import { Building2, Link2, MapPin, Globe, Briefcase, Users, User, Mail, Phone, Megaphone, Flag, Target, Calendar, UserCog, IndianRupee, Layers, CalendarClock, FileText, Gift, PartyPopper, Plus, Trash2, Activity, PhoneCall, CalendarPlus, UserPlus, XCircle, ChevronDown, ChevronRight, Paperclip, X } from 'lucide-react';
import { formatIndustriesDisplay } from '../../../lib/industryOptions';
import { formatDirectorDisplay, NAME_SALUTATION_OPTIONS } from '../../../constants/salutations';
import { formatContactListMultiline, primaryContactValue, normalizeContactList } from '../../../lib/contact-channels';
import { resolveTeamMemberList, teamMemberHasAnyValue, isTeamMemberDetailLabel } from '../../../lib/teamMemberFormDetails';
import { formatLeadSourceDisplay, LeadSourceFields } from '../LeadSourceFields';
import { formatAssigneeDisplayName } from '../../../lib/assigneeDisplay';
import { isLeadOccasionDetailLabel, readLeadOccasionFromOtherDetails, emptyLeadOccasionForm, formatOccasionPersonDisplay, buildLeadOccasionContactOptions } from '../../../lib/leadOccasionDetails';
import { isInternalLeadOtherDetailLabel } from '../../../lib/leadInternalOtherDetails';
import { LeadLocationFields } from '../../location/LeadLocationFields';
import { IndustryMultiSelect } from '../../forms/IndustryMultiSelect';
import { DirectorContactFields } from '../../forms/DirectorContactFields';
import { normalizeDirectorList } from '../../../lib/directorFormDetails';
import { TeamMemberOptionalFields } from '../../forms/TeamMemberOptionalFields';
import { LeadStatus } from '@/app/leads/types';
import { LeadFollowUpScheduler } from '../../LeadFollowUpScheduler';
import { LeadAssigneesMultiSelect } from '../LeadAssigneesMultiSelect';
import { ServicesNeededSelect } from '../../forms/ServicesNeededSelect';
import { sanitizeBusinessValueInput } from '../../../lib/businessValue';
import { LeadOccasionFields } from '../../forms/LeadOccasionFields';
import { WhatsAppIcon } from '../../icons/WhatsAppIcon';
import { MultiContactFields } from '../../ui/MultiContactFields';
import { toDateTimeLocalInput, fromDateTimeLocalInput } from '../../../utils/formatLeadDateTime';
import { AgreementTermsSection } from '../../agreements/AgreementTermsSection';
import { emptyAgreementTerms } from '../../../lib/agreementTerms';
import { AgreementDocumentUpload } from '../../documents/AgreementDocumentUpload';
import { KycDocumentsField } from '../../documents/KycDocumentsField';

export function LeadOverviewTab(props: any) {
  const {
    addLeadStatusOption,
    agreementsUploadFeedback,
    applyExtractedLeadAgreementTerms,
    deleteLeadFile,
    deleteLeadStatusOption,
    deletingLeadStatus,
    handleHqStatusSelect,
    hqAssignedToPlaceholder,
    isHqOverrideMode,
    kycUploadFeedback,
    lead,
    leadAssignmentModule,
    leadKycFiles,
    loadingRecruiters,
    newLeadStatusValue,
    openAssignLeadForm,
    openConvertToClientForm,
    openMarkLostForm,
    overviewEditErrors,
    overviewEditForm,
    overviewEditMode,
    overviewLeadStatusOptions,
    overviewOpen,
    pendingOverviewAgreementsFile,
    pendingOverviewKycFiles,
    recruiters,
    refetchLeadFiles,
    savingLeadStatus,
    setActiveTab,
    setNewLeadStatusValue,
    setOverviewEditErrors,
    setOverviewEditForm,
    setPendingOverviewAgreementsFile,
    setPendingOverviewKycFiles,
    setShowAddLeadStatusInput,
    setShowLogCallForm,
    setShowScheduleFollowUpForm,
    setShowSendWhatsAppForm,
    showAddLeadStatusInput,
    toggleOverviewSection,
    uploadingAgreements,
    uploadingKyc,
  } = props;

  return (
<div className="space-y-5">
                      {isLeadAlreadyConverted(lead) ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                          <p className="font-semibold">Converted to client — view only</p>
                          <p className="mt-0.5 text-emerald-800/90">
                            This lead is linked to
                            {lead?.convertedClientName
                              ? ` “${lead.convertedClientName}”`
                              : ' a client'}
                            . Editing is disabled.
                          </p>
                        </div>
                      ) : null}
                      {!overviewEditMode ? (
                        <>
                          {lead?.id ? (
                            <>
                              <EntityWorkspaceAlertsPanel
                                entityType="LEAD"
                                entityId={lead.id}
                                entityLabel={lead.companyName || 'Lead'}
                              />
                            </>
                          ) : null}
                          <AddLeadSectionCard
                            title="Company Details"
                            subtitle="Organization name and online presence"
                            icon={Building2}
                            accent="blue"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewField
                                label="Company"
                                icon={Building2}
                                iconClassName="text-blue-500"
                                required
                                value={lead?.companyName ?? ''}
                              />
                              <OverviewField
                                label="Company Links"
                                icon={Link2}
                                iconClassName="text-blue-500"
                                value={lead?.website ?? ''}
                                href={!!lead?.website}
                              />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Location & Industry"
                            subtitle="Where the company operates"
                            icon={MapPin}
                            accent="emerald"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <OverviewField
                                  label="Search location"
                                  icon={MapPin}
                                  iconClassName="text-emerald-500"
                                  value={lead?.location ?? ''}
                                />
                              </div>
                              <OverviewField label="Country" icon={Globe} iconClassName="text-emerald-500" value={lead?.country ?? ''} />
                              <OverviewField label="State" icon={MapPin} iconClassName="text-emerald-500" value={lead?.state ?? ''} />
                              <OverviewField label="City" icon={MapPin} iconClassName="text-emerald-500" value={lead?.city ?? ''} />
                              <OverviewField label="Industry" icon={Briefcase} iconClassName="text-emerald-500" value={formatIndustriesDisplay(lead?.industry ?? '')} />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Contacts"
                            subtitle="Director and team member details"
                            icon={Users}
                            accent="violet"
                          >
                            <div className="space-y-4">
                              <div className="rounded-xl border border-violet-100/80 bg-violet-50/30 p-3">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                  <OverviewField
                                    label="Director Name"
                                    icon={User}
                                    iconClassName="text-violet-500"
                                    required
                                    value={formatDirectorDisplay(
                                      lead?.directorSalutation,
                                      lead?.directorName || lead?.contactPerson,
                                    )}
                                  />
                                  <OverviewField
                                    label="Email"
                                    icon={Mail}
                                    iconClassName="text-violet-500"
                                    required
                                    value={
                                      formatContactListMultiline(lead?.emails, lead?.email) ||
                                      'Not available'
                                    }
                                    multiline
                                  />
                                  <OverviewField
                                    label="Mobile Number"
                                    icon={Phone}
                                    iconClassName="text-violet-500"
                                    required
                                    value={
                                      formatContactListMultiline(lead?.phones, lead?.phone) ||
                                      'Not available'
                                    }
                                    multiline
                                  />
                                </div>
                              </div>
                              {(() => {
                                const teamMembers = resolveTeamMemberList(lead).filter(teamMemberHasAnyValue);
                                if (teamMembers.length === 0) return null;
                                return (
                                  <div className="rounded-xl border border-violet-100/80 bg-violet-50/20 p-3 space-y-3">
                                    <AddLeadFieldLabel label="Team Member" icon={Users} iconClassName="text-violet-500" />
                                    {teamMembers.map((tm: any, index: any) => (
                                      <div
                                        key={`lead-team-member-${index}`}
                                        className="grid grid-cols-1 gap-4 rounded-xl border border-violet-100/60 bg-white/80 px-3 py-3 sm:grid-cols-3"
                                      >
                                        <OverviewField
                                          label="Name"
                                          value={formatDirectorDisplay(
                                            tm.teamMemberSalutation,
                                            tm.teamMemberName || tm.teamMemberDesignation,
                                          )}
                                        />
                                        <OverviewField
                                          label="Email"
                                          value={tm.teamMemberEmail ?? ''}
                                          href={!!tm.teamMemberEmail}
                                        />
                                        <OverviewField label="Mobile Number" value={tm.teamMemberPhone ?? ''} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Source & Qualification"
                            subtitle="Lead origin and pipeline stage"
                            icon={Megaphone}
                            accent="amber"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewField label="Source" icon={Megaphone} iconClassName="text-amber-500" value={formatLeadSourceDisplay(lead?.source, lead?.sourceOther)} />
                              <OverviewField
                                label={getSourceFieldLabel(lead?.source ?? undefined)}
                                icon={Globe}
                                iconClassName="text-amber-500"
                                value={getLeadSourceDetailValue(lead)}
                                href={
                                  Boolean(getLeadSourceDetailValue(lead)) &&
                                  lead?.source !== 'Other' &&
                                  lead?.source !== 'Referral'
                                }
                              />
                              <OverviewField label="Status" icon={Flag} iconClassName="text-amber-500" value={lead?.status ?? ''} />
                              <OverviewField label="Interest Level" icon={Target} iconClassName="text-amber-500" value={lead?.priority ?? ''} />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Follow-up & Assignment"
                            subtitle="Schedule and owner"
                            icon={Calendar}
                            accent="sky"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <OverviewFieldDateTime
                                label="Next Follow-up"
                                icon={Calendar}
                                iconClassName="text-sky-500"
                                value={lead?.nextFollowUp}
                              />
                              <OverviewField
                                label="Assigned To"
                                icon={UserCog}
                                iconClassName="text-sky-500"
                                value={
                                  Array.isArray(lead?.assignedToUsers) && lead!.assignedToUsers!.length > 0
                                    ? lead!.assignedToUsers!.map((u: any) => formatAssigneeDisplayName(u) || u.name).filter(Boolean).join(', ')
                                    : (formatAssigneeDisplayName(lead?.assignedTo) || lead?.assignedTo?.name || '')
                                }
                              />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Business Opportunity"
                            subtitle="Services and expected value"
                            icon={IndianRupee}
                            accent="rose"
                          >
                            <div className="space-y-4">
                              <OverviewField
                                label="Services Needed"
                                icon={Layers}
                                iconClassName="text-rose-500"
                                value={lead?.servicesNeeded || lead?.interestedNeeds || ''}
                              />
                              {(() => {
                                const demoRows = parseLeadDemoNotes(lead?.notes);
                                const businessValue = String(lead?.expectedBusinessValue || '').trim();
                                const showBusinessValue =
                                  Boolean(businessValue) &&
                                  businessValue !== '0' &&
                                  !/booked demo:|employer demo request:|entrepreneur demo request:/i.test(businessValue);
                                return (
                                  <>
                                    {showBusinessValue ? (
                                      <OverviewField
                                        label="Expected Business Value"
                                        icon={IndianRupee}
                                        iconClassName="text-rose-500"
                                        value={businessValue}
                                      />
                                    ) : null}
                                    {demoRows ? (
                                      <div className="space-y-3">
                                        <AddLeadFieldLabel
                                          label="Demo request"
                                          icon={CalendarClock}
                                          iconClassName="text-rose-500"
                                        />
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                          {demoRows.map((row: any, index: any) => (
                                            <OverviewField
                                              key={`${row.label}-${index}`}
                                              label={row.label}
                                              value={row.value}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    ) : !showBusinessValue && String(lead?.notes || '').trim() ? (
                                      <OverviewField
                                        label="Notes"
                                        icon={FileText}
                                        iconClassName="text-rose-500"
                                        value={lead?.notes ?? ''}
                                        multiline
                                      />
                                    ) : null}
                                  </>
                                );
                              })()}
                              {(() => {
                                const publicOtherDetails = Array.isArray(lead?.otherDetails)
                                  ? lead.otherDetails.filter(
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
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {publicOtherDetails.map((item: any, index: any) => (
                                      <OverviewField
                                        key={`${item.label}-${index}`}
                                        label={item.label}
                                        value={item.value}
                                      />
                                    ))}
                                  </div>
                                </div>
                                );
                              })()}
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Other"
                            subtitle="Events with name, date, reminder, and email"
                            icon={Gift}
                            accent="indigo"
                          >
                            {(() => {
                              const occasions =
                                readLeadOccasionFromOtherDetails(lead?.otherDetails) ||
                                emptyLeadOccasionForm();
                              const events = occasions.events || [];
                              if (events.length === 0) {
                                return (
                                  <p className="text-sm text-slate-400">No events added.</p>
                                );
                              }
                              return (
                                <div className="space-y-3">
                                  {events.map((event: any) => (
                                    <OverviewField
                                      key={event.id}
                                      label={event.eventName || 'Event'}
                                      icon={PartyPopper}
                                      iconClassName="text-indigo-500"
                                      value={formatOccasionPersonDisplay(event)}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </AddLeadSectionCard>
                        </>
                      ) : (
                        <div className="space-y-5">
                          <AddLeadSectionCard
                            title="Company Details"
                            subtitle="Organization name and online presence"
                            icon={Building2}
                            accent="blue"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <AddLeadFieldLabel label="Company" icon={Building2} iconClassName="text-blue-500" required />
                              <input
                                value={overviewEditForm.companyName}
                                onChange={(e: any) => {
                                  const value = e.target.value;
                                  setOverviewEditForm((p: any) => ({ ...p, companyName: value }));
                                  if (overviewEditErrors.companyName) {
                                    setOverviewEditErrors((prev: any) => ({ ...prev, companyName: undefined }));
                                  }
                                }}
                                className={`${ADD_LEAD_INPUT} ${
                                  overviewEditErrors.companyName ? 'border-red-300' : 'border-slate-200'
                                }`}
                              />
                              {overviewEditErrors.companyName && (
                                <p className="mt-1 text-xs text-red-600">{overviewEditErrors.companyName}</p>
                              )}
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Company Links" icon={Link2} iconClassName="text-blue-500" />
                              <input value={overviewEditForm.website} onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, website: e.target.value }))} className={ADD_LEAD_INPUT} />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Location & Industry"
                            subtitle="Where the company operates"
                            icon={MapPin}
                            accent="emerald"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                            <LeadLocationFields
                              location={overviewEditForm.location}
                              city={overviewEditForm.city}
                              state={overviewEditForm.state}
                              country={overviewEditForm.country}
                              countryCode={overviewEditForm.countryCode}
                              latitude={overviewEditForm.latitude}
                              longitude={overviewEditForm.longitude}
                              showDetectedHint={false}
                              countryError={overviewEditErrors.country}
                              stateError={overviewEditErrors.state}
                              onLocationChange={(next: any) => setOverviewEditForm((p: any) => ({ ...p, location: next }))}
                              onSelect={(s: any) => {
                                setOverviewEditForm((p: any) => mergeLocationFields(p, s));
                                setOverviewEditErrors((prev: any) => ({
                                  ...prev,
                                  country: undefined,
                                  state: undefined,
                                }));
                              }}
                            />
                            </div>
                            <div>
                              <AddLeadFieldLabel label="Industry" icon={Briefcase} iconClassName="text-emerald-500" />
                              <IndustryMultiSelect
                                value={overviewEditForm.industry ?? ''}
                                onChange={(industry: any) => setOverviewEditForm((p: any) => ({ ...p, industry }))}
                                companyName={overviewEditForm.companyName ?? ''}
                                placeholder="Type an industry (e.g. technology, healthcare)"
                              />
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Contacts"
                            subtitle="Director and team member details"
                            icon={Users}
                            accent="violet"
                          >
                            <div className="space-y-4">
                              <DirectorContactFields
                                directorSalutation={overviewEditForm.directorSalutation}
                                contactPerson={overviewEditForm.contactPerson}
                                directors={overviewEditForm.directors}
                                onDirectorsChange={(directors: any) =>
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    directors: normalizeDirectorList(directors),
                                  }))
                                }
                                emails={overviewEditForm.emails}
                                phones={overviewEditForm.phones}
                                email={overviewEditForm.email}
                                phone={overviewEditForm.phone}
                                countryCode={overviewEditForm.countryCode}
                                countryName={overviewEditForm.country}
                                allowNotAvailable
                                emailNotAvailable={Boolean(overviewEditForm.emailNotAvailable)}
                                phoneNotAvailable={Boolean(overviewEditForm.phoneNotAvailable)}
                                onEmailNotAvailableChange={(emailNotAvailable: any) => {
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    emailNotAvailable,
                                    ...(emailNotAvailable ? { emails: [''], email: '' } : {}),
                                  }));
                                  setOverviewEditErrors((prev: any) => ({ ...prev, email: undefined }));
                                }}
                                onPhoneNotAvailableChange={(phoneNotAvailable: any) => {
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    phoneNotAvailable,
                                    ...(phoneNotAvailable ? { phones: [''], phone: '' } : {}),
                                  }));
                                  setOverviewEditErrors((prev: any) => ({ ...prev, phone: undefined }));
                                }}
                                onDirectorSalutationChange={(value: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, directorSalutation: value }))
                                }
                                onContactPersonChange={(value: any) => {
                                  setOverviewEditForm((p: any) => ({ ...p, contactPerson: value }));
                                  if (overviewEditErrors.contactPerson) {
                                    setOverviewEditErrors((prev: any) => ({ ...prev, contactPerson: undefined }));
                                  }
                                }}
                                onEmailsChange={(emails: any, primaryEmail: any) => {
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    emails,
                                    email: primaryEmail,
                                    emailNotAvailable: primaryEmail.trim() ? false : p.emailNotAvailable,
                                  }));
                                  if (overviewEditErrors.email) {
                                    setOverviewEditErrors((prev: any) => ({ ...prev, email: undefined }));
                                  }
                                }}
                                onPhonesChange={(phones: any, primaryPhone: any) => {
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    phones,
                                    phone: primaryPhone,
                                    phoneNotAvailable: primaryPhone.trim() ? false : p.phoneNotAvailable,
                                  }));
                                  if (overviewEditErrors.phone) {
                                    setOverviewEditErrors((prev: any) => ({ ...prev, phone: undefined }));
                                  }
                                }}
                                contactPersonError={overviewEditErrors.contactPerson}
                                emailError={overviewEditErrors.email}
                                phoneError={overviewEditErrors.phone}
                              />
                              <TeamMemberOptionalFields
                                requireTeamName={false}
                                countryCode={overviewEditForm.countryCode}
                                countryName={overviewEditForm.country}
                                members={overviewEditForm.teamMembers}
                                onChange={(teamMembers: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, ...syncLeadTeamMembers(teamMembers) }))
                                }
                              />
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Source & Qualification"
                            subtitle="How you found this lead and its stage"
                            icon={Megaphone}
                            accent="amber"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <LeadSourceFields
                                form={overviewEditForm}
                                onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-3">
                                <AddLeadFieldLabel label="Status" icon={Flag} iconClassName="text-amber-500" />
                                <div className="flex items-center gap-2">
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
                              </div>
                              <LeadStatusDropdown
                                value={overviewEditForm.status || 'New'}
                                options={overviewLeadStatusOptions}
                                deleting={deletingLeadStatus}
                                hqMode={isHqOverrideMode}
                                onSelect={(status: any) =>
                                  handleHqStatusSelect(status, (next: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, status: next as LeadStatus })),
                                  )
                                }
                                onDelete={(status: any) =>
                                  deleteLeadStatusOption(status, (nextStatus: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, status: nextStatus as LeadStatus })),
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
                                    onClick={() => addLeadStatusOption((status: any) => setOverviewEditForm((p: any) => ({ ...p, status: status as LeadStatus })))}
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
                              <AddLeadFieldLabel label="Interest Level" icon={Target} iconClassName="text-amber-500" />
                              <select
                                value={overviewEditForm.priority}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
                                className={`${ADD_LEAD_INPUT} bg-white`}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Follow-up & Assignment"
                            subtitle="Schedule and owner"
                            icon={Calendar}
                            accent="sky"
                          >
                            <div className="space-y-4">
                              <LeadFollowUpScheduler
                                value={{
                                  nextFollowUp: overviewEditForm.nextFollowUp,
                                  followUpType: overviewEditForm.followUpType || 'Call',
                                  followUpContact: overviewEditForm.followUpContact,
                                  followUpMeetLink: overviewEditForm.followUpMeetLink,
                                  followUpReminder: overviewEditForm.followUpReminder,
                                  followUpTimezone: overviewEditForm.followUpTimezone,
                                  followUpAttendeeIds: overviewEditForm.followUpAttendeeIds,
                                  followUpNotes: overviewEditForm.followUpNotes,
                                }}
                                onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                                phoneOptions={[...(overviewEditForm.phones || []), overviewEditForm.phone].filter((value: any): value is string => Boolean(value))}
                                emailOptions={[...(overviewEditForm.emails || []), overviewEditForm.email].filter((value: any): value is string => Boolean(value))}
                                teamMembers={recruiters}
                                loadingMembers={loadingRecruiters}
                                inputClassName={ADD_LEAD_INPUT}
                              />
                              <div>
                              <AddLeadFieldLabel label="Assigned To" icon={UserCog} iconClassName="text-sky-500" />
                              <LeadAssigneesMultiSelect
                                members={recruiters}
                                value={overviewEditForm.assignedToIds ?? (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])}
                                loading={loadingRecruiters}
                        assignmentModule={leadAssignmentModule}
                                placeholder={hqAssignedToPlaceholder}
                                onChange={(ids: any) => {
                                  const selected = ids
                                    .map((id: any) => recruiters.find((r: any) => r.id === id))
                                    .filter(Boolean);
                                  const assignedToName = selected
                                    .map(
                                      (m: any) =>
                                        `${m!.firstName || ''} ${m!.lastName || ''}`.trim() ||
                                        m!.name ||
                                        m!.email,
                                    )
                                    .filter(Boolean)
                                    .join(', ');
                                  setOverviewEditForm((p: any) => ({
                                    ...p,
                                    assignedToIds: ids,
                                    assignedToId: ids[0] ?? '',
                                    leadOwner: assignedToName,
                                  }));
                                }}
                              />
                              </div>
                            </div>
                          </AddLeadSectionCard>

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
                                value={overviewEditForm.interestedNeeds}
                                onChange={(interestedNeeds: any) => setOverviewEditForm((p: any) => ({ ...p, interestedNeeds }))}
                                industry={overviewEditForm.industry ?? ''}
                              />
                            </div>
                          <div>
                            <AddLeadFieldLabel label="Expected Business Value" icon={IndianRupee} iconClassName="text-rose-500" />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={overviewEditForm.notes}
                              onChange={(e: any) =>
                                setOverviewEditForm((p: any) => ({
                                  ...p,
                                  notes: sanitizeBusinessValueInput(e.target.value),
                                }))
                              }
                              className={ADD_LEAD_INPUT}
                              placeholder="e.g. 1500000"
                            />
                          </div>
                          <div>
                            <AddLeadFieldLabel label="Other Details" icon={FileText} iconClassName="text-rose-500" />
                            <div className="rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Fields</p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOverviewEditForm((p: any) => ({
                                      ...p,
                                      dynamicOtherDetails: [...p.dynamicOtherDetails, { label: '', value: '' }],
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                >
                                  <Plus size={14} />
                                  Add field
                                </button>
                              </div>
                              {overviewEditForm.dynamicOtherDetails.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No custom fields yet. Add a row or import from Excel; label and value are both required to save a field.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {overviewEditForm.dynamicOtherDetails.map((row: any, idx: any) => (
                                    <div key={`lead-dyn-${idx}`} className="flex flex-wrap items-center gap-2">
                                      <input
                                        value={row.label}
                                        onChange={(e: any) => {
                                          const label = e.target.value;
                                          setOverviewEditForm((p: any) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.map((r: any, i: any) =>
                                              i === idx ? { ...r, label } : r,
                                            ),
                                          }));
                                        }}
                                        placeholder="Field name"
                                        className="min-w-[8rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      />
                                      <input
                                        value={row.value}
                                        onChange={(e: any) => {
                                          const value = e.target.value;
                                          setOverviewEditForm((p: any) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.map((r: any, i: any) =>
                                              i === idx ? { ...r, value } : r,
                                            ),
                                          }));
                                        }}
                                        placeholder="Value"
                                        className="min-w-[8rem] flex-[2] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOverviewEditForm((p: any) => ({
                                            ...p,
                                            dynamicOtherDetails: p.dynamicOtherDetails.filter((_: any, i: any) => i !== idx),
                                          }))
                                        }
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                        aria-label="Remove dynamic field"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                            </div>
                          </AddLeadSectionCard>

                          <AddLeadSectionCard
                            title="Other"
                            subtitle="Add events with name, date, reminder, and email"
                            icon={Gift}
                            accent="indigo"
                          >
                            <LeadOccasionFields
                              value={overviewEditForm.occasions || emptyLeadOccasionForm()}
                              contacts={buildLeadOccasionContactOptions({
                                directorName: overviewEditForm.contactPerson,
                                directorEmail: overviewEditForm.email,
                                directorEmails: overviewEditForm.emails,
                                teamMembers: overviewEditForm.teamMembers,
                              })}
                              onChange={(occasions: any) =>
                                setOverviewEditForm((p: any) => ({ ...p, occasions }))
                              }
                            />
                          </AddLeadSectionCard>
                        </div>
                      )}

                  {!isLeadAlreadyConverted(lead) ? (
                  <AddLeadSectionCard
                    title="Quick Actions"
                    subtitle="Common lead workflows"
                    icon={Activity}
                    accent="indigo"
                  >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setShowLogCallForm(true)}
                          className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3.5 text-left text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 active:scale-[0.98]"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-600 ring-1 ring-sky-100">
                            <PhoneCall size={16} />
                          </span>
                          Log Call
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSendWhatsAppForm(true)}
                          className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5 text-left text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-100 active:scale-[0.98]"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-100">
                            <WhatsAppIcon size={16} />
                          </span>
                          Send WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScheduleFollowUpForm(false);
                            setActiveTab('followup');
                          }}
                          className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3.5 text-left text-sm font-semibold text-indigo-950 shadow-sm transition hover:bg-indigo-100 active:scale-[0.98]"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-indigo-100">
                            <CalendarPlus size={16} />
                          </span>
                          Schedule Follow-up
                        </button>
                        <button
                            type="button"
                            onClick={openConvertToClientForm}
                            className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3.5 text-left text-sm font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100 active:scale-[0.98]"
                          >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 ring-1 ring-violet-100">
                            <UserPlus size={16} />
                          </span>
                            Convert to Client
                          </button>
                        <button
                            type="button"
                            onClick={openMarkLostForm}
                            className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3.5 text-left text-sm font-semibold text-rose-950 shadow-sm transition hover:bg-rose-100 active:scale-[0.98]"
                          >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-rose-600 ring-1 ring-rose-100">
                            <XCircle size={16} />
                          </span>
                            Mark Lost
                          </button>
                        <button
                            type="button"
                            onClick={openAssignLeadForm}
                            className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3.5 text-left text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 active:scale-[0.98]"
                          >
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-600 ring-1 ring-amber-100">
                            <UserCog size={16} />
                          </span>
                            Assign Lead
                          </button>
                      </div>
                  </AddLeadSectionCard>
                  ) : null}
                  <div className="hidden">
                  {/* Section 1 — Company Information */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('company')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        Company Information
                      </h4>
                      {overviewOpen.company ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.company && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Company Name" value={lead?.companyName ?? ''} />
                            <FieldRow label="Industry" value={formatIndustriesDisplay(lead?.industry ?? '')} />
                            <FieldRow label="Company Size" value={lead?.companySize ?? ''} />
                            <FieldRow label="Website" value={lead?.website ?? ''} href={!!lead?.website} />
                            <FieldRow label="LinkedIn" value={lead?.linkedIn ?? ''} href={!!lead?.linkedIn} />
                            <FieldRow label="Location" value={lead?.location ?? ''} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</label>
                              <input
                                value={overviewEditForm.companyName}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, companyName: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                              <IndustryMultiSelect
                                value={overviewEditForm.industry ?? ''}
                                onChange={(industry: any) => setOverviewEditForm((p: any) => ({ ...p, industry }))}
                                companyName={overviewEditForm.companyName ?? ''}
                                placeholder="Type an industry (e.g. technology, healthcare)"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Size</label>
                              <input
                                value={overviewEditForm.companySize}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, companySize: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                              <input
                                value={overviewEditForm.website}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, website: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn</label>
                              <input
                                value={overviewEditForm.linkedIn}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, linkedIn: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <LeadLocationFields
                              location={overviewEditForm.location}
                              city={overviewEditForm.city}
                              state={overviewEditForm.state}
                              country={overviewEditForm.country}
                              countryCode={overviewEditForm.countryCode}
                              latitude={overviewEditForm.latitude}
                              longitude={overviewEditForm.longitude}
                              showDetectedHint={false}
                              countryError={overviewEditErrors.country}
                              stateError={overviewEditErrors.state}
                              onLocationChange={(next: any) => setOverviewEditForm((p: any) => ({ ...p, location: next }))}
                              onSelect={(s: any) => {
                                setOverviewEditForm((p: any) => mergeLocationFields(p, s));
                                setOverviewEditErrors((prev: any) => ({
                                  ...prev,
                                  country: undefined,
                                  state: undefined,
                                }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Section 2 — Contact Person */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('contact')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        Contact Person
                      </h4>
                      {overviewOpen.contact ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.contact && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Contact Name" value={formatDirectorDisplay(lead?.directorSalutation, lead?.contactPerson)} />
                            <FieldRow label="Designation" value={lead?.designation ?? ''} />
                            <FieldRow
                              label="Email"
                              value={formatContactListMultiline(lead?.emails, lead?.email)}
                              href
                              multiline
                            />
                            <FieldRow
                              label="Phone"
                              value={formatContactListMultiline(lead?.phones, lead?.phone)}
                              multiline
                            />
                            <FieldRow label="Country" value={lead?.country ?? ''} />
                            <FieldRow label="City" value={lead?.city ?? ''} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Name</label>
                              <div className="flex gap-2">
                                <select
                                  value={overviewEditForm.directorSalutation ?? ''}
                                  onChange={(e: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, directorSalutation: e.target.value }))
                                  }
                                  className="w-[5.75rem] shrink-0 rounded-xl border border-slate-200 px-2 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  aria-label="Contact salutation"
                                >
                                  {NAME_SALUTATION_OPTIONS.map((opt: any) => (
                                    <option key={opt.value || 'none'} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={overviewEditForm.contactPerson}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, contactPerson: e.target.value }))}
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Designation</label>
                              <input
                                value={overviewEditForm.designation}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, designation: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <MultiContactFields
                              label="Email"
                              type="email"
                              values={overviewEditForm.emails}
                              onChange={(emails: any) => {
                                const primary = primaryContactValue(
                                  normalizeContactList(emails, overviewEditForm.email),
                                );
                                setOverviewEditForm((p: any) => ({ ...p, emails, email: primary }));
                              }}
                              placeholder="email@company.com"
                            />
                            <MultiContactFields
                              label="Phone"
                              type="tel"
                              values={overviewEditForm.phones}
                              onChange={(phones: any) => {
                                const primary = primaryContactValue(
                                  normalizeContactList(phones, overviewEditForm.phone),
                                );
                                setOverviewEditForm((p: any) => ({ ...p, phones, phone: primary }));
                              }}
                              placeholder="+1 (555) 000-0000"
                            />
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                              <input
                                value={overviewEditForm.country}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, country: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                              <input
                                value={overviewEditForm.city}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, city: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Section 3 — Lead Details */}
                  <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleOverviewSection('leadDetails')}
                      className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Target size={14} className="text-slate-400" />
                        Lead Details
                      </h4>
                      {overviewOpen.leadDetails ? (
                        <ChevronDown size={18} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {overviewOpen.leadDetails && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 space-y-0">
                        {!overviewEditMode ? (
                          <>
                            <FieldRow label="Lead Source" value={formatLeadSourceDisplay(lead?.source, lead?.sourceOther)} />
                            <FieldRow
                              label={getSourceFieldLabel(lead?.source ?? undefined)}
                              value={getLeadSourceDetailValue(lead)}
                            />
                            <FieldRow label="Campaign Name" value={lead?.campaignName ?? ''} />
                            <FieldRow
                              label="Lead Owner"
                              value={
                                Array.isArray(lead?.assignedToUsers) && lead!.assignedToUsers!.length > 0
                                  ? lead!.assignedToUsers!.map((u: any) => formatAssigneeDisplayName(u) || u.name).filter(Boolean).join(', ')
                                  : (formatAssigneeDisplayName(lead?.assignedTo) || lead?.assignedTo?.name || '')
                              }
                            />
                            <FieldRow label="Lead Status" value={lead?.status ?? ''} />
                            <FieldRow label="Created Date" value={lead?.createdDate ?? ''} />
                            <FieldRowDateTime label="Last Contacted" value={lead?.lastFollowUp} />
                            <FieldRowDateTime label="Next Follow-up" value={lead?.nextFollowUp} />
                          </>
                        ) : (
                          <div className="space-y-4 pt-2">
                            <LeadSourceFields
                              form={overviewEditForm}
                              onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                            />
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Owner</label>
                              <input
                                value={overviewEditForm.leadOwner}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, leadOwner: e.target.value }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lead Status</label>
                                <div className="flex items-center gap-2">
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
                              </div>
                              <LeadStatusDropdown
                                value={overviewEditForm.status || 'New'}
                                options={overviewLeadStatusOptions}
                                deleting={deletingLeadStatus}
                                hqMode={isHqOverrideMode}
                                onSelect={(status: any) =>
                                  handleHqStatusSelect(status, (next: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, status: next as LeadStatus })),
                                  )
                                }
                                onDelete={(status: any) =>
                                  deleteLeadStatusOption(status, (nextStatus: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, status: nextStatus as LeadStatus })),
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
                                    onClick={() => addLeadStatusOption((status: any) => setOverviewEditForm((p: any) => ({ ...p, status: status as LeadStatus })))}
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
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Created Date</label>
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalInput(overviewEditForm.createdDate)}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, createdDate: fromDateTimeLocalInput(e.target.value) }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Contacted</label>
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalInput(overviewEditForm.lastFollowUp)}
                                onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, lastFollowUp: fromDateTimeLocalInput(e.target.value) }))}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <LeadFollowUpScheduler
                                value={{
                                  nextFollowUp: overviewEditForm.nextFollowUp,
                                  followUpType: overviewEditForm.followUpType || 'Call',
                                  followUpContact: overviewEditForm.followUpContact,
                                  followUpMeetLink: overviewEditForm.followUpMeetLink,
                                  followUpReminder: overviewEditForm.followUpReminder,
                                  followUpTimezone: overviewEditForm.followUpTimezone,
                                  followUpAttendeeIds: overviewEditForm.followUpAttendeeIds,
                                  followUpNotes: overviewEditForm.followUpNotes,
                                }}
                                onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                                phoneOptions={[...(overviewEditForm.phones || []), overviewEditForm.phone].filter((value: any): value is string => Boolean(value))}
                                emailOptions={[...(overviewEditForm.emails || []), overviewEditForm.email].filter((value: any): value is string => Boolean(value))}
                                teamMembers={recruiters}
                                loadingMembers={loadingRecruiters}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <AgreementTermsSection
                                values={{ ...emptyAgreementTerms(), ...overviewEditForm }}
                                onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                                disabled={uploadingKyc || uploadingAgreements}
                                uploadSlot={
                                  <>
                                    {overviewEditForm.agreementsFileUrl && !pendingOverviewAgreementsFile ? (
                                      <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                                        <Paperclip size={14} className="shrink-0 text-slate-500" />
                                        <a
                                          href={overviewEditForm.agreementsFileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="truncate flex-1 hover:underline"
                                        >
                                          {overviewEditForm.agreementsFileName || 'Agreement document'}
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOverviewEditForm((p: any) => ({
                                              ...p,
                                              agreementsFileName: '',
                                              agreementsFileUrl: '',
                                              agreementsUploadedAt: '',
                                            }));
                                          }}
                                          className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50"
                                          aria-label="Remove agreement"
                                        >
                                          <X size={16} strokeWidth={2.25} />
                                        </button>
                                      </div>
                                    ) : null}
                                    <AgreementDocumentUpload
                                      description="Upload the signed agreement, MoU, or terms document for this lead. PDF, DOC, DOCX up to 10MB."
                                      pendingFile={pendingOverviewAgreementsFile}
                                      onPendingFileChange={(file: any) => {
                                        setPendingOverviewAgreementsFile(file);
                                        if (file) {
                                          setOverviewEditForm((p: any) => ({ ...p, agreementsFileName: file.name }));
                                        }
                                      }}
                                      onTermsExtracted={applyExtractedLeadAgreementTerms}
                                      isUploading={uploadingAgreements}
                                      uploadSuccess={agreementsUploadFeedback.uploadSuccess}
                                      uploadPercent={agreementsUploadFeedback.uploadPercent}
                                      disabled={uploadingKyc}
                                    />
                                  </>
                                }
                              />
                            </div>
                            <div>
                              <KycDocumentsField
                                pendingFiles={pendingOverviewKycFiles}
                                onPendingFilesChange={setPendingOverviewKycFiles}
                                storedFiles={leadKycFiles}
                                onRemoveStored={async (fileId: any) => {
                                  await deleteLeadFile(fileId);
                                  await refetchLeadFiles();
                                }}
                                uploading={uploadingKyc}
                                uploadSuccess={kycUploadFeedback.uploadSuccess}
                                uploadPercent={kycUploadFeedback.uploadPercent}
                                disabled={uploadingAgreements}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  </div>
                </div>
  );
}
