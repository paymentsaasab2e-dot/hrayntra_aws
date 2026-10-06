'use client';

import React from 'react';
import { ScheduleMeetingForm } from '../../ScheduleMeetingForm';
import { apiGetClientScheduledMeetings } from '../../../lib/api';
import { DrawerSectionCard } from '../drawerFormUi';
import { Building2, Gift, FileText, Paperclip, Shield, Upload, Trash2, Plus, Clock, X, ChevronDown, ChevronRight, User, Users, TrendingUp, Heart, Briefcase, Send, UserPlus, CalendarPlus, FileCheck } from 'lucide-react';
import { FieldRow, resolveClientTeamMembersForForm, syncClientTeamMembers, mergeClientLocationSelection, HEALTH_STYLES } from '../clientDetailsShared';
import { formatDirectorDisplay } from '../../../constants/salutations';
import { directorFromOtherDetails } from '../../../lib/clientDirectorDetails';
import { formatContactListMultiline } from '../../../lib/contact-channels';
import { teamMemberHasAnyValue } from '../../../lib/teamMemberFormDetails';
import { formatIndustriesDisplay } from '../../../lib/industryOptions';
import { readLeadOccasionFromOtherDetails, emptyLeadOccasionForm, buildLeadOccasionContactOptions } from '../../../lib/leadOccasionDetails';
import { formatAgreementTermsSummary, agreementTermsFromRecord } from '../../../lib/agreementTerms';
import { KycDocumentsView, KycDocumentsField } from '../../documents/KycDocumentsField';
import { ClientPostServiceKycSummary, ClientPostServiceKycFormSection } from '../../clients/ClientPostServiceKycSection';
import { postServiceKycFormFromRecord } from '../../../lib/clientKycForm';
import { ImageWithFallback } from '../../ImageWithFallback';
import { DirectorContactFields } from '../../forms/DirectorContactFields';
import { normalizeDirectorList } from '../../../lib/directorFormDetails';
import { TeamMemberOptionalFields } from '../../forms/TeamMemberOptionalFields';
import { CscLocationFields } from '../../location/CscLocationFields';
import { LocationSelection } from '../../LocationAutocomplete';
import { ClientTimezoneSelect } from '../../clients/ClientTimezoneSelect';
import { IndustryMultiSelect } from '../../forms/IndustryMultiSelect';
import { CatalogOptionDropdown } from '../../forms/CatalogOptionDropdown';
import { DEFAULT_CLIENT_STATUS_LABELS, clientStatusLabelToBackend, DEFAULT_CLIENT_PRIORITY_LABELS } from '../../../lib/clientLifecycleStatus';
import { LeadAssigneesMultiSelect } from '../LeadAssigneesMultiSelect';
import { ServicesNeededSelect } from '../../forms/ServicesNeededSelect';
import { sanitizeBusinessValueInput } from '../../../lib/businessValue';
import { LeadOccasionFields } from '../../forms/LeadOccasionFields';
import { AgreementTermsSection } from '../../agreements/AgreementTermsSection';
import { AgreementDocumentUpload } from '../../documents/AgreementDocumentUpload';
import { formatDateDMY } from '../../../utils/dateDisplay';
import { CrossDepartmentClientHandoff } from '../../team/CrossDepartmentClientHandoff';

export function ClientOverviewTab(props: any) {
  const {
    addClientLeadStatusOption,
    addClientPriorityOption,
    agreementLevelCatalogProps,
    agreementsInputRef,
    agreementsUploadFeedback,
    applyExtractedAgreementTerms,
    assignedToValue,
    businessValue,
    canCreateJob,
    canManageClientAgreements,
    canViewClientAgreements,
    client,
    clientContacts,
    clientFieldVisibility,
    clientKycFiles,
    clientLeadStatusOptions,
    clientLogoInputRef,
    clientLogoPreview,
    clientPriorityOptions,
    clientTeamMemberContacts,
    companyLinksValue,
    defaultRecruitmentEnabled,
    deleteClientLeadStatusOption,
    deleteClientPriorityOption,
    deleteFile,
    deletingClientLeadStatus,
    deletingClientPriority,
    extractedAgreementKeys,
    fullClientData,
    getClientLogoSrc,
    isAddMode,
    isHqOverrideMode,
    kycUploadFeedback,
    loadingRecruiters,
    locationFields,
    markClientLogoRemoved,
    newClientLeadStatusValue,
    newClientPriorityValue,
    onSendToRecruitment,
    openCreateJobDrawer,
    overviewEditForm,
    overviewEditMode,
    overviewOpen,
    pendingAgreementsFile,
    pendingKycFiles,
    pendingPostServiceKycFiles,
    primaryClientContact,
    primaryClientContactEmail,
    primaryClientContactPhone,
    recruiters,
    refetchClientFiles,
    removeStoredPostServiceKycFile,
    savingClientLeadStatus,
    savingClientPriority,
    sendingToRecruitment,
    servicesNeededValue,
    setActiveTab,
    setNewClientLeadStatusValue,
    setNewClientPriorityValue,
    setOverviewEditForm,
    setPendingAgreementsFile,
    setPendingKycFiles,
    setPendingPostServiceKycFilesForField,
    setScheduledMeetings,
    setShowAddClientLeadStatusInput,
    setShowAddClientPriorityInput,
    setShowScheduleMeetingForm,
    showAddClientLeadStatusInput,
    showAddClientPriorityInput,
    showScheduleMeetingForm,
    statusValue,
    timezoneManuallyEditedRef,
    toggleOverviewSection,
    uploadingAgreements,
    uploadingClientLogo,
    uploadingKyc,
    uploadsBase,
    viewDynamicFields,
  } = props;

  return (
showScheduleMeetingForm ? (
                    <ScheduleMeetingForm
                      entityType="client"
                      entityId={client?.id || ''}
                      showBackButton={true}
                      onBack={() => setShowScheduleMeetingForm(false)}
                      onSuccess={async () => {
                        setShowScheduleMeetingForm(false);
                        // Refresh scheduled meetings list and switch to schedule tab
                        if (client?.id) {
                          try {
                            const meetings = await apiGetClientScheduledMeetings(client.id);
                            setScheduledMeetings(meetings.data || []);
                            setActiveTab('schedule');
                          } catch (error) {
                            console.error('Failed to refresh meetings:', error);
                          }
                        }
                      }}
                      onCancel={() => setShowScheduleMeetingForm(false)}
                    />
                  ) : (
                    <div className="space-y-5">
                      {!overviewEditMode ? (
                        <>
                          <DrawerSectionCard
                            title="Client Information"
                            subtitle="Company profile, contacts, and qualification"
                            icon={Building2}
                            accent="blue"
                            collapsible
                            open={overviewOpen.leadInformation}
                            onOpenChange={() => toggleOverviewSection('leadInformation')}
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div><FieldRow label="Company *" value={fullClientData?.name || client?.name || ''} /></div>
                              <div><FieldRow label="Company Links" value={companyLinksValue} href={!!companyLinksValue} /></div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <FieldRow
                                    label="Director Name"
                                    value={formatDirectorDisplay(
                                      fullClientData?.directorSalutation ||
                                        client?.directorSalutation ||
                                        directorFromOtherDetails(
                                          fullClientData?.otherDetails || client?.otherDetails,
                                        ).directorSalutation,
                                      primaryClientContact?.name ||
                                        directorFromOtherDetails(
                                          fullClientData?.otherDetails || client?.otherDetails,
                                        ).directorName ||
                                        '',
                                    )}
                                  />
                                  <FieldRow
                                    label="Email *"
                                    value={formatContactListMultiline(
                                      fullClientData?.emails || client?.emails,
                                      primaryClientContactEmail,
                                    )}
                                    href={!!primaryClientContactEmail}
                                    multiline
                                  />
                                  <FieldRow
                                    label="Mobile Number"
                                    value={formatContactListMultiline(
                                      fullClientData?.phones || client?.phones,
                                      primaryClientContactPhone,
                                    )}
                                    multiline
                                  />
                                </div>
                              </div>
                              {(() => {
                                const teamMembers = resolveClientTeamMembersForForm(
                                  clientTeamMemberContacts,
                                  fullClientData || client,
                                  primaryClientContact?.id,
                                ).filter(teamMemberHasAnyValue);
                                if (teamMembers.length === 0) return null;
                                return (
                                  <div className="sm:col-span-2 space-y-2">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team Member</p>
                                    {teamMembers.map((tm: any, index: any) => (
                                      <div
                                        key={tm.id || `client-team-member-${index}`}
                                        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-3"
                                      >
                                        <FieldRow
                                          label="Name"
                                          value={formatDirectorDisplay(
                                            tm.teamMemberSalutation,
                                            tm.teamMemberName || tm.teamMemberDesignation,
                                          )}
                                        />
                                        <FieldRow label="Email" value={tm.teamMemberEmail ?? ''} href={!!tm.teamMemberEmail} />
                                        <FieldRow label="Mobile Number" value={tm.teamMemberPhone ?? ''} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              <div><FieldRow label="Location" value={fullClientData?.location || client?.location || ''} /></div>
                              <div><FieldRow label="City" value={locationFields.city} /></div>
                              <div><FieldRow label="State" value={locationFields.state} /></div>
                              <div><FieldRow label="Country" value={locationFields.country} /></div>
                              <div><FieldRow label="Timezone" value={fullClientData?.timezone || client?.timezone || ''} /></div>
                              <div><FieldRow label="Industry" value={formatIndustriesDisplay(fullClientData?.industry || client?.industry || '')} /></div>
                              {clientFieldVisibility.status ? (
                                <div><FieldRow label="Status" value={statusValue} /></div>
                              ) : null}
                              {clientFieldVisibility.interestLevel ? (
                                <div><FieldRow label="Interest Level" value={fullClientData?.priority || client?.priority || ''} /></div>
                              ) : null}
                              {clientFieldVisibility.assignedTo ? (
                                <div><FieldRow label="Assigned To" value={assignedToValue} /></div>
                              ) : null}
                              <div><FieldRow label="Services Needed" value={servicesNeededValue} /></div>
                              <div><FieldRow label="Expected Business Value" value={businessValue} /></div>
                              {viewDynamicFields.length ? (
                                <div className="sm:col-span-2">
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Dynamic Fields</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {viewDynamicFields.map((item: any, index: any) => (
                                        <div key={`${item.label}-${index}`} className="text-sm">
                                          <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
                                          <span className="text-slate-600">{item.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </DrawerSectionCard>

                          {(() => {
                            const occasions = readLeadOccasionFromOtherDetails(
                              fullClientData?.otherDetails || client?.otherDetails,
                            );
                            const events = occasions.events || [];
                            if (events.length === 0) return null;
                            return (
                              <DrawerSectionCard
                                title="Other"
                                subtitle="Events with name, date, reminder, and email"
                                icon={Gift}
                                accent="indigo"
                                collapsible
                                open={overviewOpen.other !== false}
                                onOpenChange={() => toggleOverviewSection('other')}
                              >
                                <div className="space-y-2">
                                  {events.map((event: any, index: any) => (
                                    <div
                                      key={event.id || `client-event-view-${index}`}
                                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                      <p className="font-semibold text-slate-900">
                                        {event.eventName?.trim() || `Event ${index + 1}`}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {[
                                          event.date?.trim(),
                                          event.reminder?.trim() && event.reminder !== 'No reminder'
                                            ? event.reminder
                                            : null,
                                          event.name?.trim(),
                                          event.email?.trim(),
                                        ]
                                          .filter(Boolean)
                                          .join(' · ') || 'No details'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </DrawerSectionCard>
                            );
                          })()}

                          {canViewClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            {(fullClientData?.agreementsFileUrl ||
                              client?.agreementsFileUrl ||
                              formatAgreementTermsSummary(
                                agreementTermsFromRecord(fullClientData || client),
                              ).length > 0) ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                                {fullClientData?.agreementsFileUrl || client?.agreementsFileUrl ? (
                                  <a
                                    href={String(fullClientData?.agreementsFileUrl || client?.agreementsFileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
                                  >
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="truncate max-w-[280px]">
                                      {fullClientData?.agreementsFileName ||
                                        client?.agreementsFileName ||
                                        'Agreement document'}
                                    </span>
                                  </a>
                                ) : null}
                                {formatAgreementTermsSummary(
                                  agreementTermsFromRecord(fullClientData || client),
                                ).map((line: any) => (
                                  <p key={line} className="text-sm text-slate-700">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No agreement details added yet.</p>
                            )}
                          </DrawerSectionCard>
                          ) : null}

                          <DrawerSectionCard
                            title="KYC Form"
                            subtitle="Identity verification and compliance documents"
                            icon={Shield}
                            accent="emerald"
                            collapsible
                            open={overviewOpen.kycForm}
                            onOpenChange={() => toggleOverviewSection('kycForm')}
                          >
                            <KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />
                            <ClientPostServiceKycSummary
                              values={postServiceKycFormFromRecord(fullClientData || client)}
                              uploadsBase={uploadsBase}
                            />
                          </DrawerSectionCard>
                        </>
                      ) : (
                        <>
                          <DrawerSectionCard
                            title="Client Information"
                            subtitle="Company profile, contacts, and qualification"
                            icon={Building2}
                            accent="blue"
                            collapsible
                            open={overviewOpen.leadInformation}
                            onOpenChange={() => toggleOverviewSection('leadInformation')}
                          >
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                  Client Image
                                </label>
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                                    {clientLogoPreview ? (
                                      <ImageWithFallback
                                        src={getClientLogoSrc(clientLogoPreview)}
                                        alt="Client logo preview"
                                        className="w-full h-full object-cover block"
                                      />
                                    ) : (
                                      <Building2 size={24} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => clientLogoInputRef.current?.click()}
                                      disabled={uploadingClientLogo}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      <Upload size={16} />
                                      {uploadingClientLogo
                                        ? 'Uploading…'
                                        : clientLogoPreview
                                          ? 'Replace Image'
                                          : 'Upload Image'}
                                    </button>
                                    {clientLogoPreview ? (
                                      <button
                                        type="button"
                                        onClick={markClientLogoRemoved}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                      >
                                        <Trash2 size={16} />
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  PNG, JPG, or SVG. Recommended size 256×256 or larger.
                                </p>
                              </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company *</label>
                                <input
                                  value={overviewEditForm.companyName}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, companyName: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g. Acme Inc."
                                />
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between gap-3">
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Links</label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOverviewEditForm((p: any) => ({ ...p, companyLinks: [...(p.companyLinks || ['']), ''] }))
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                                    aria-label="Add company link"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {(overviewEditForm.companyLinks?.length ? overviewEditForm.companyLinks : ['']).map((link: any, index: any) => (
                                    <div key={`client-company-link-${index}`} className="flex items-center gap-2">
                                      <input
                                        value={link}
                                        onChange={(e: any) =>
                                          setOverviewEditForm((p: any) => {
                                            const next = [...(p.companyLinks?.length ? p.companyLinks : [''])];
                                            next[index] = e.target.value;
                                            // Keep the first link mirrored into `website` so existing code paths still work.
                                            return { ...p, companyLinks: next, website: next[0] || '' };
                                          })
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="https://company.com or LinkedIn URL"
                                      />
                                      {(overviewEditForm.companyLinks?.length ?? 0) > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOverviewEditForm((p: any) => {
                                              const next = (p.companyLinks?.length ? p.companyLinks : ['']).filter((_: any, i: any) => i !== index);
                                              return {
                                                ...p,
                                                companyLinks: next.length ? next : [''],
                                                website: (next[0] ?? '') || '',
                                              };
                                            })
                                          }
                                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500"
                                          aria-label={`Remove company link ${index + 1}`}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="sm:col-span-2">
                                <DirectorContactFields
                                  boxed
                                  directorSalutation={overviewEditForm.directorSalutation}
                                  contactPerson={overviewEditForm.directorName}
                                  directors={overviewEditForm.directors}
                                  onDirectorsChange={(directors: any) =>
                                    setOverviewEditForm((p: any) => ({
                                      ...p,
                                      directors: normalizeDirectorList(directors),
                                    }))
                                  }
                                  emails={overviewEditForm.contactEmails}
                                  phones={overviewEditForm.contactPhones}
                                  email={overviewEditForm.contactEmail}
                                  phone={overviewEditForm.contactPhone}
                                  countryCode={overviewEditForm.countryCode}
                                  countryName={overviewEditForm.country}
                                  onDirectorSalutationChange={(value: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, directorSalutation: value }))
                                  }
                                  onContactPersonChange={(value: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, directorName: value }))
                                  }
                                  onEmailsChange={(contactEmails: any, primaryEmail: any) => {
                                    setOverviewEditForm((p: any) => ({ ...p, contactEmails, contactEmail: primaryEmail }));
                                  }}
                                  onPhonesChange={(contactPhones: any, primaryPhone: any) => {
                                    setOverviewEditForm((p: any) => ({ ...p, contactPhones, contactPhone: primaryPhone }));
                                  }}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <TeamMemberOptionalFields
                                  requireTeamName={false}
                                  countryCode={overviewEditForm.countryCode}
                                  countryName={overviewEditForm.country}
                                  members={overviewEditForm.teamMembers}
                                  onChange={(teamMembers: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, ...syncClientTeamMembers(teamMembers) }))
                                  }
                                />
                              </div>
                              <CscLocationFields
                                location={overviewEditForm.location ?? ''}
                                city={overviewEditForm.city}
                                state={overviewEditForm.state}
                                country={overviewEditForm.country}
                                countryCode={overviewEditForm.countryCode}
                                latitude={overviewEditForm.latitude}
                                longitude={overviewEditForm.longitude}
                                showDetectedHint={false}
                                onLocationChange={(next: any) =>
                                  setOverviewEditForm((p: any) => ({ ...p, location: next }))
                                }
                                onSelect={(s: LocationSelection) => {
                                  timezoneManuallyEditedRef.current = false;
                                  setOverviewEditForm((p: any) => mergeClientLocationSelection(p, s));
                                }}
                              />
                              <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  <Clock size={12} className="text-slate-400" />
                                  Timezone
                                </label>
                                <ClientTimezoneSelect
                                  value={overviewEditForm.timezone}
                                  onManualChange={() => {
                                    timezoneManuallyEditedRef.current = true;
                                  }}
                                  onChange={(timezone: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, timezone }))
                                  }
                                  placeholder="Select timezone…"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Industry</label>
                                <IndustryMultiSelect
                                  value={overviewEditForm.industry ?? ''}
                                  onChange={(industry: any) => setOverviewEditForm((p: any) => ({ ...p, industry }))}
                                  companyName={overviewEditForm.companyName}
                                  placeholder="Type an industry (e.g. technology, healthcare)"
                                />
                              </div>
                              {clientFieldVisibility.status ? (
                                <div>
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddClientLeadStatusInput((prev: any) => !prev);
                                        setNewClientLeadStatusValue('');
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add status
                                    </button>
                                  </div>
                                  <CatalogOptionDropdown
                                    value={overviewEditForm.leadStatusValue || 'Active'}
                                    options={clientLeadStatusOptions}
                                    defaultOptions={DEFAULT_CLIENT_STATUS_LABELS}
                                    deleting={deletingClientLeadStatus}
                                    placeholder="Active"
                                    onSelect={(status: any) =>
                                      setOverviewEditForm((p: any) => ({
                                        ...p,
                                        leadStatusValue: status,
                                        status: clientStatusLabelToBackend(status),
                                      }))
                                    }
                                    onDelete={(status: any) =>
                                      deleteClientLeadStatusOption(status, (nextStatus: any) =>
                                        setOverviewEditForm((p: any) => ({
                                          ...p,
                                          leadStatusValue: nextStatus,
                                          status: clientStatusLabelToBackend(nextStatus),
                                        })),
                                      )
                                    }
                                  />
                                  {showAddClientLeadStatusInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientLeadStatusValue}
                                        onChange={(e: any) => setNewClientLeadStatusValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new status"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientLeadStatusOption((status: any) =>
                                            setOverviewEditForm((p: any) => ({
                                              ...p,
                                              leadStatusValue: status,
                                              status: clientStatusLabelToBackend(status),
                                            }))
                                          )
                                        }
                                        disabled={savingClientLeadStatus}
                                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingClientLeadStatus ? 'Adding...' : 'Add'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientLeadStatusInput(false);
                                          setNewClientLeadStatusValue('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {clientFieldVisibility.interestLevel ? (
                                <div>
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Interest Level</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddClientPriorityInput((prev: any) => !prev);
                                        setNewClientPriorityValue('');
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Add level
                                    </button>
                                  </div>
                                  <CatalogOptionDropdown
                                    value={overviewEditForm.priority || 'Medium'}
                                    options={clientPriorityOptions}
                                    defaultOptions={DEFAULT_CLIENT_PRIORITY_LABELS}
                                    deleting={deletingClientPriority}
                                    placeholder="Medium"
                                    onSelect={(priority: any) =>
                                      setOverviewEditForm((p: any) => ({ ...p, priority }))
                                    }
                                    onDelete={(priority: any) =>
                                      deleteClientPriorityOption(priority, (nextPriority: any) =>
                                        setOverviewEditForm((p: any) => ({ ...p, priority: nextPriority }))
                                      )
                                    }
                                  />
                                  {showAddClientPriorityInput ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        value={newClientPriorityValue}
                                        onChange={(e: any) => setNewClientPriorityValue(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Enter new interest level"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addClientPriorityOption((priority: any) =>
                                            setOverviewEditForm((p: any) => ({ ...p, priority }))
                                          )
                                        }
                                        disabled={savingClientPriority}
                                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingClientPriority ? 'Adding...' : 'Add'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAddClientPriorityInput(false);
                                          setNewClientPriorityValue('');
                                        }}
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {clientFieldVisibility.assignedTo ? (
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                  <LeadAssigneesMultiSelect
                                    members={recruiters}
                                    value={overviewEditForm.assignedToIds ?? (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])}
                                    loading={loadingRecruiters}
                                    assignmentModule={
                                      isHqOverrideMode
                                        ? undefined
                                        : defaultRecruitmentEnabled
                                          ? 'Recruitment Clients'
                                          : 'Clients'
                                    }
                                    onChange={(ids: any) => {
                                      setOverviewEditForm((p: any) => ({
                                        ...p,
                                        assignedToIds: ids,
                                        assignedToId: ids[0] ?? '',
                                      }));
                                    }}
                                  />
                                </div>
                              ) : null}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Services Needed</label>
                                <ServicesNeededSelect
                                  value={overviewEditForm.servicesNeeded}
                                  onChange={(servicesNeeded: any) => setOverviewEditForm((p: any) => ({ ...p, servicesNeeded }))}
                                  industry={overviewEditForm.industry ?? ''}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Business Value</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={overviewEditForm.expectedBusinessValue}
                                  onChange={(e: any) =>
                                    setOverviewEditForm((p: any) => ({
                                      ...p,
                                      expectedBusinessValue: sanitizeBusinessValueInput(e.target.value),
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g. 50000"
                                />
                              </div>
                              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
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
                                      <div key={`client-dyn-b-${idx}`} className="flex flex-wrap items-center gap-2">
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
                          </DrawerSectionCard>

                          <DrawerSectionCard
                            title="Other"
                            subtitle="Add events with name, date, reminder, and email"
                            icon={Gift}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.other !== false}
                            onOpenChange={() => toggleOverviewSection('other')}
                          >
                            <LeadOccasionFields
                              value={overviewEditForm.occasions || emptyLeadOccasionForm()}
                              contacts={buildLeadOccasionContactOptions({
                                directorName: overviewEditForm.directorName,
                                directorEmail: overviewEditForm.contactEmail,
                                directorEmails: overviewEditForm.contactEmails,
                                teamMembers: overviewEditForm.teamMembers,
                              })}
                              onChange={(occasions: any) =>
                                setOverviewEditForm((p: any) => ({ ...p, occasions }))
                              }
                            />
                          </DrawerSectionCard>

                          {canManageClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            <AgreementTermsSection
                              values={overviewEditForm}
                              onChange={(patch: any) => setOverviewEditForm((p: any) => ({ ...p, ...patch }))}
                              disabled={uploadingKyc || uploadingAgreements}
                              showContractValidity
                              levelCatalog={agreementLevelCatalogProps}
                              extractedKeys={extractedAgreementKeys}
                              uploadSlot={
                                <>
                                  {overviewEditForm.agreementsFileUrl && !pendingAgreementsFile ? (
                                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                                      <Paperclip size={14} className="shrink-0 text-slate-500" />
                                      <a
                                        href={overviewEditForm.agreementsFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-0 flex-1 truncate hover:underline"
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
                                          if (agreementsInputRef.current) agreementsInputRef.current.value = '';
                                        }}
                                        className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-50"
                                        aria-label="Remove agreement"
                                      >
                                        <X size={16} strokeWidth={2.25} />
                                      </button>
                                    </div>
                                  ) : null}
                                  <AgreementDocumentUpload
                                    description=""
                                    pendingFile={pendingAgreementsFile}
                                    onPendingFileChange={(file: any) => {
                                      setPendingAgreementsFile(file);
                                      if (file) {
                                        setOverviewEditForm((p: any) => ({ ...p, agreementsFileName: file.name }));
                                      }
                                    }}
                                    currentTerms={overviewEditForm}
                                    onTermsExtracted={applyExtractedAgreementTerms}
                                    isUploading={uploadingAgreements}
                                    uploadSuccess={agreementsUploadFeedback.uploadSuccess}
                                    uploadPercent={agreementsUploadFeedback.uploadPercent}
                                    disabled={uploadingKyc}
                                  />
                                </>
                              }
                            />
                          </DrawerSectionCard>
                          ) : canViewClientAgreements ? (
                          <DrawerSectionCard
                            title="Agreements & Terms"
                            subtitle="Contract terms and agreement documents"
                            icon={FileText}
                            accent="indigo"
                            collapsible
                            open={overviewOpen.agreementsTerms}
                            onOpenChange={() => toggleOverviewSection('agreementsTerms')}
                          >
                            {(overviewEditForm.agreementsFileUrl ||
                              formatAgreementTermsSummary(overviewEditForm).length > 0) ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
                                {overviewEditForm.agreementsFileUrl ? (
                                  <a
                                    href={overviewEditForm.agreementsFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-slate-900 hover:underline"
                                  >
                                    <Paperclip size={14} className="text-slate-500" />
                                    <span className="truncate max-w-[280px]">
                                      {overviewEditForm.agreementsFileName || 'Agreement document'}
                                    </span>
                                  </a>
                                ) : null}
                                {formatAgreementTermsSummary(overviewEditForm).map((line: any) => (
                                  <p key={line} className="text-sm text-slate-700">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No agreement details added yet.</p>
                            )}
                          </DrawerSectionCard>
                          ) : null}

                          <DrawerSectionCard
                            title="KYC Form"
                            subtitle="Identity verification and compliance documents"
                            icon={Shield}
                            accent="emerald"
                            collapsible
                            open={overviewOpen.kycForm}
                            onOpenChange={() => toggleOverviewSection('kycForm')}
                          >
                            <KycDocumentsField
                              pendingFiles={pendingKycFiles}
                              onPendingFilesChange={setPendingKycFiles}
                              description=""
                              storedFiles={clientKycFiles}
                              uploadsBase={uploadsBase}
                              onRemoveStored={async (fileId: any) => {
                                await deleteFile(fileId);
                                await refetchClientFiles();
                              }}
                              uploading={uploadingKyc}
                              uploadSuccess={kycUploadFeedback.uploadSuccess}
                              uploadPercent={kycUploadFeedback.uploadPercent}
                              disabled={uploadingAgreements}
                              currentForm={overviewEditForm.postServiceKycForm}
                              onFormExtracted={(postServiceKycForm: any) =>
                                setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                              }
                            />
                            <ClientPostServiceKycFormSection
                              values={overviewEditForm.postServiceKycForm}
                              onChange={(postServiceKycForm: any) =>
                                setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                              }
                              disabled={uploadingKyc || uploadingAgreements}
                              uploadsBase={uploadsBase}
                              pendingFilesByField={pendingPostServiceKycFiles}
                              onPendingFilesChange={setPendingPostServiceKycFilesForField}
                              onRemoveStoredFile={removeStoredPostServiceKycFile}
                              onFormExtracted={(postServiceKycForm: any) =>
                                setOverviewEditForm((p: any) => ({ ...p, postServiceKycForm }))
                              }
                            />
                          </DrawerSectionCard>
                        </>
                      )}
                    <div className="hidden">
                    {/* 1. Company Snapshot Card */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('companySnapshot')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400" />
                          Company Snapshot
                        </h4>
                        {overviewOpen.companySnapshot ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.companySnapshot && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          {!overviewEditMode ? (
                            <>
                              {client && (
                                <>
                          <FieldRow label="Company Name" value={fullClientData?.name || client?.name || '—'} />
                          <FieldRow label="Industry" value={formatIndustriesDisplay(fullClientData?.industry || client?.industry || '') || '—'} />
                          <FieldRow label="Company size" value={fullClientData?.companySize || client?.companySize || '—'} />
                          <FieldRow label="Website" value={fullClientData?.website || client?.website || '—'} href={!!(fullClientData?.website || client?.website)} />
                          <FieldRow label="LinkedIn" value={fullClientData?.linkedin || client?.linkedin || '—'} href={!!(fullClientData?.linkedin || client?.linkedin)} />
                          <FieldRow label="Location" value={fullClientData?.location || client?.location || fullClientData?.hiringLocations || client?.hiringLocations || '—'} />
                          <FieldRow label="Locations / Hiring locations" value={fullClientData?.hiringLocations || client?.hiringLocations || fullClientData?.location || client?.location || 'Not specified'} />
                          <FieldRow label="Timezone" value={fullClientData?.timezone || client?.timezone || '—'} />
                          <FieldRow label="Client since" value={(() => {
                            const clientSince = fullClientData?.clientSince || client?.clientSince;
                            if (!clientSince) return '—';
                            if (typeof clientSince === 'string' && clientSince.includes('-')) {
                              return formatDateDMY(clientSince);
                            }
                            return clientSince;
                          })()} />
                                </>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</label>
                                <input
                                  type="text"
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
                                  companyName={overviewEditForm.companyName}
                                  placeholder="Type an industry (e.g. technology, healthcare)"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Size</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.companySize}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, companySize: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.location}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, location: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g., panvel, Raigad, India"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hiring Locations</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.hiringLocations || ''}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, hiringLocations: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  placeholder="e.g., panvel, Raigad, India"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.website}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, website: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">LinkedIn</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.linkedin}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, linkedin: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timezone</label>
                                <ClientTimezoneSelect
                                  value={overviewEditForm.timezone}
                                  onManualChange={() => {
                                    timezoneManuallyEditedRef.current = true;
                                  }}
                                  onChange={(timezone: any) =>
                                    setOverviewEditForm((p: any) => ({ ...p, timezone }))
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {/* 2. Contact Person Card - Only show in overview mode when contacts exist */}
                    {!isAddMode && client && clientContacts.length > 0 && (
                      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleOverviewSection('contactPerson')}
                          className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                        >
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} className="text-slate-400" />
                            Contact Person
                          </h4>
                          {overviewOpen.contactPerson ? (
                            <ChevronDown size={18} className="text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight size={18} className="text-slate-400 shrink-0" />
                          )}
                        </button>
                        {overviewOpen.contactPerson && (
                          <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                            {(() => {
                              // Get primary contact (first contact or one marked as primary)
                              const primaryContact = clientContacts.find((c: any) => c.isPrimary) || clientContacts[0];
                              if (!primaryContact) return null;
                              
                              return (
                                <>
                                  <FieldRow label="Contact Name" value={primaryContact.name || '—'} />
                                  <FieldRow label="Designation" value={primaryContact.designation || '—'} />
                                  <FieldRow label="Email" value={primaryContact.email || '—'} href={!!primaryContact.email} />
                                  <FieldRow label="Phone" value={primaryContact.phone || '—'} />
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </section>
                    )}

                    {/* 3. Relationship & Ownership Card */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('relationship')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Users size={14} className="text-slate-400" />
                          Relationship & Ownership
                        </h4>
                        {overviewOpen.relationship ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.relationship && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          {!overviewEditMode ? (
                            <>
                              {client && (
                                <>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account manager</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <ImageWithFallback src={client.owner.avatar} alt={client.owner.name} className="w-6 h-6 rounded-full border border-slate-200" />
                              <span className="text-sm font-medium text-slate-900">{client.owner.name}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Team members</p>
                            <p className="text-sm font-medium text-slate-900">
                              {client.recruiterTeam?.length ? client.recruiterTeam.join(', ') : client.owner.name}
                            </p>
                          </div>
                          <FieldRow label="Client stage" value={client.stage} />
                          <FieldRow label="Priority" value={client.priority ?? '—'} />
                          <FieldRow label="SLA / Response expectations" value={client.sla ?? '—'} />
                          {client?.id ? (
                            <div className="mt-4">
                              <CrossDepartmentClientHandoff
                                clientId={client.id}
                                clientName={client.name || 'Client'}
                              />
                            </div>
                          ) : null}
                                </>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned To</label>
                                <LeadAssigneesMultiSelect
                                  members={recruiters}
                                  value={
                                    overviewEditForm.assignedToIds ??
                                    (overviewEditForm.assignedToId ? [overviewEditForm.assignedToId] : [])
                                  }
                                  loading={loadingRecruiters}
                                  assignmentModule={
                                    isHqOverrideMode
                                      ? undefined
                                      : defaultRecruitmentEnabled
                                        ? 'Recruitment Clients'
                                        : 'Clients'
                                  }
                                  onChange={(ids: any) => {
                                    setOverviewEditForm((p: any) => ({
                                      ...p,
                                      assignedToIds: ids,
                                      assignedToId: ids[0] ?? '',
                                    }));
                                  }}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.priority}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, priority: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">SLA / Response expectations</label>
                                <input
                                  type="text"
                                  value={overviewEditForm.sla}
                                  onChange={(e: any) => setOverviewEditForm((p: any) => ({ ...p, sla: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {/* 3. Performance Metrics Cards */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('performance')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <TrendingUp size={14} className="text-slate-400" />
                          Performance metrics
                        </h4>
                        {overviewOpen.performance ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.performance && (
                        <div className="p-5 pt-0 border-t border-slate-100 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open jobs</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.openJobs ?? 0}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidates in progress</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.candidatesInProgress ?? client?.activeCandidates ?? 0}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interviews this week</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.interviewsThisWeek ?? '—'}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placements this month</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{client?.placementsThisMonth ?? client?.placements ?? '—'}</p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 col-span-2">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Revenue generated</p>
                            <p className="text-lg font-bold text-emerald-800 mt-0.5">{client?.revenueGenerated ?? client?.revenue ?? '—'}</p>
                          </div>
                        </div>
                      )}
                    </section>

                    {/* 4. Client Health Widget */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleOverviewSection('health')}
                        className="w-full p-5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Heart size={14} className="text-slate-400" />
                          Client health
                        </h4>
                        {overviewOpen.health ? (
                          <ChevronDown size={18} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={18} className="text-slate-400 shrink-0" />
                        )}
                      </button>
                      {overviewOpen.health && (
                        <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                          <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                            {(() => {
                              const status = client?.healthStatus ?? 'Good';
                              const s = HEALTH_STYLES[status as keyof typeof HEALTH_STYLES];
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
                                  {status === 'Good' && '🟢 '}
                                  {status === 'Needs attention' && '🟡 '}
                                  {status === 'At risk' && '🔴 '}
                                  {s.label}
                                </span>
                              );
                            })()}
                          </div>
                          <FieldRow label="Last activity" value={client?.lastActivity ?? '—'} />
                          <FieldRow label="Stale jobs count" value={client?.staleJobsCount != null ? String(client.staleJobsCount) : '—'} />
                          <FieldRow label="Pending invoices" value={client?.pendingInvoicesCount != null ? String(client.pendingInvoicesCount) : '—'} />
                          <FieldRow label="Average time-to-fill" value={client?.avgTimeToFill ?? '—'} />
                        </div>
                      )}
                    </section>

                    {/* 5. Quick Actions Strip — always visible, no dropdown */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('jobs'); void openCreateJobDrawer(); }}
                          disabled={!canCreateJob}
                          title={canCreateJob ? 'Add Job Requirement' : "You don't have permission to create jobs"}
                          className={`flex items-center justify-center gap-2 py-3 px-4 border rounded-xl text-sm font-medium shadow-sm active:scale-[0.98] transition-all ${
                            canCreateJob
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                              : 'bg-slate-100/60 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Briefcase size={16} className={canCreateJob ? 'text-slate-600' : 'text-slate-400'} />
                          Add Job Requirement
                        </button>
                        {onSendToRecruitment ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!client || sendingToRecruitment) return;
                              onSendToRecruitment(client);
                            }}
                            disabled={!client || sendingToRecruitment}
                            className={`flex items-center justify-center gap-2 py-3 px-4 border rounded-xl text-sm font-medium shadow-sm active:scale-[0.98] transition-all ${
                              client?.recruitmentEnabled
                                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200'
                            }`}
                            title={
                              client?.recruitmentEnabled
                                ? 'Forward to more members in Recruitment'
                                : 'Send this client to Recruitment'
                            }
                          >
                            <Send size={16} className={client?.recruitmentEnabled ? 'text-amber-600' : 'text-slate-600'} />
                            {client?.recruitmentEnabled ? 'Forward in Recruitment' : 'Send to Recruitment'}
                          </button>
                        ) : null}
                        <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all">
                          <UserPlus size={16} className="text-slate-600" />
                          Add Contact
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowScheduleMeetingForm(true)}
                          className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all"
                        >
                          <CalendarPlus size={16} className="text-slate-600" />
                          Schedule Meeting / Follow-up
                        </button>
                        <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] transition-all">
                          <FileCheck size={16} className="text-slate-600" />
                          Upload Agreement / SLA
                        </button>
                      </div>
                    </section>
                    </div>
                    </div>
                  )
  );
}
