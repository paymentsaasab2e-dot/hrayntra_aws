'use client';



import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { AnimatePresence } from 'motion/react';

import { DetailsModalShell } from './DetailsModalShell';

import { X, Plus, Check, Upload, Linkedin, Twitter, Facebook, AlertCircle, User, Send, Sparkles, ArrowUp, ArrowLeft, ArrowRight, FileText, Loader2, GripHorizontal, Briefcase, Building2, Home, Share2, Users } from 'lucide-react';

import { RichTextEditor } from '../RichTextEditor';

import { apiCreateJob, apiUpdateJob, apiGetJob, getJobPreScreenAssessments, apiGetClients, apiGetWorkspaceClient, apiGetClient, apiGetContacts, apiGenerateJobDescription, apiGenerateJobFromPrompt, apiProcessJobCreationPipeline, type JobCreationPipelineResult, apiUploadJobFile, filesApiUpload, apiPublishSocialJob, apiGetSocialStatus, apiConnectIntegration, apiDisconnectIntegration, apiGetJobApplyLink, apiListLinkedInPostTemplates, type SocialPublishingAccount, getTenantDbName, getCachedOrgRecruitmentMode, isOwnCompanyWorkspaceClient, type CreateJobData, type BackendClient, type BackendContact, type BackendUser } from '../../lib/api';

import { getAllTeamMembersForAssign, getLineManagersForJobPicker, linkTeamRequestToJob, teamMembersToBackendUsers } from '../../lib/api/teamApi';

import { assigneeCompanyId, formatAssigneeDisplayName } from '../../lib/assigneeDisplay';

import { WhatsAppIcon } from '../icons/WhatsAppIcon';

import { LinkedInPostPreview } from '../LinkedInPostPreview';

import { TwitterPostPreview } from '../TwitterPostPreview';

import { SocialAccountPicker } from '../SocialAccountPicker';

import { buildCandidatePortalApplyUrlPreview, replaceApplyUrlInSocialPostText, buildLinkedInJobPost, buildTwitterJobPost, buildFacebookJobPost, LINKEDIN_POST_MAX_LENGTH, type JobSocialPostInput } from '../../lib/jobSocialPost';

import { useLinkedIn } from '../../hooks/useLinkedIn';

import { requestError, requestInfo, requestWarning } from '../../lib/appDialog';

import { clampDateTimeLocalToMin, getLocalDateTimeInputMinNow } from '../../utils/dateInputConstraints';

import { CreateJobDetailsForm, type CreateJobDetailsFormData } from './CreateJobDetailsForm';

import { customJdSectionsToHtml, extractAdditionalJdSectionsFromHtml, mergeCustomJdSections, mergeDescriptionWithCustomJdSections, type JobCustomJdSection } from '../../lib/jobCustomJdSections';

import { plainTextToJobDescriptionHtml, readJdPlainFromClipboard } from '../../lib/jobDescriptionHtml';

import { usePageDrawerLifecycle } from '../../lib/pageDrawerEvents';

import { startAsyncLoad } from '../../lib/asyncLoadGuard';

import { useDrawerUnsavedGuard } from '../../hooks/useDrawerUnsavedGuard';

import { normalizeJobSalaryCurrency, parseJobSalaryMoneyNumber, resolveJobSalaryCurrencySymbolForSave } from '../../constants/jobSalary';

import { getCachedOrgDefaultCurrency } from '../../lib/api';

import { loadJobVisibilityUserDefaults, visibilityDefaultsForNewJob, jobVisibilityDefaultsEqual } from '../../lib/jobVisibilityUserDefaults';

import { filterClientsForAddJob } from '../../lib/recruitmentClients';

import { dedupeByCompanyName } from '../../lib/companyNameKey';

import { normalizeExtractedJobTitle } from '../../lib/normalizeExtractedJobTitle';

import { getStoredTenantCompanyName, resolveAddJobWorkspaceLabel, resolveJobPostingCompanyChooser, useOrgWorkspace } from '../../lib/org/useOrgWorkspace';

import { DocumentUploadButton, useDocumentUploadFeedback } from '../import/documentUploadUi';

import { ApplicationFormBuilderModal } from '../jobs/ApplicationFormBuilderModal';

import { LinkedInPostTemplateModal } from '../jobs/LinkedInPostTemplateModal';

import { PreScreenAssessmentSection } from '../jobs/PreScreenAssessmentSection';

import type { JobPreScreenAssessmentLink } from '../../lib/preScreenAssessmentTypes';

import { defaultApplicationFormSchema, normalizeApplicationFormSchema, type ApplicationFormSchema } from '../../lib/applicationFormTypes';

import { applyDefaultLinkedInPostTemplate, normalizeLinkedInPostTemplateSchema, parseLinkedInPostTemplateList, pickDefaultLinkedInPostTemplate, subscribeLinkedInTemplateDefaultChanged, visibleLinkedInTemplateSectionLabels, type JobLinkedInPostTemplate, type LinkedInPostTemplateSection } from '../../lib/jobLinkedInPostTemplate';

import { buildJobContactPersonOptions, type JobContactPersonOption } from '../../lib/jobClientContacts';

import { isJobFieldPubliclyVisible, mergeClientVisibility, parseJobPublicFieldVisibility, buildPublicFieldVisibilityPayload, resolvePostedCompanyNameForSocial } from '../../lib/jobPublicFieldVisibility';

import { DrawerSectionCard, DRAWER_FORM_HEADER_CLASS, DRAWER_FORM_SCROLL_BG } from './drawerFormUi';

import { DrawerLinkActions } from './DrawerLinkActions';

import { AccordionSection, AiChatMessage, AiDescriptionSection, AiDraftData, ApplicationLogoOption, CREATE_JOB_EDIT_WIZARD_STEPS, CREATE_JOB_WIZARD_HINTS, CREATE_JOB_WIZARD_STEPS, CreateJobDrawerProps, CreateJobWizardStep, DEFAULT_JOB_DRAWER_ACCORDIONS, JobPromptHints, SCREENING_TYPE_OPTIONS, ScreeningQuestion, ScreeningQuestionType, buildPlainJobDescriptionHtml, clearCreateJobOauthDraft, defaultTargetHireDateIso, emptyJobPromptHints, extractLabeledPromptValue, generateScreeningQuestionId, hydrateJobListFieldsFromPipelineResult, inferJobTitleFromPrompt, inferWorkModeFromText, makeShortTextScreeningQuestion, parseExperienceRequiredForForm, parseJobPromptHints, parseScreeningQuestionList, peekCreateJobOauthDraft, resolveClientIdByCompanyName, saveCreateJobOauthDraft, serializeScreeningQuestion } from './createJobShared';

import { useCreateJobDrawer } from '../../hooks/useCreateJobDrawer';
import { CreateJobClientStep } from './createJobSteps/ClientStep';
import { CreateJobJdStep } from './createJobSteps/JdStep';
import { CreateJobDetailsStep } from './createJobSteps/DetailsStep';
import { CreateJobApplicationStep } from './createJobSteps/ApplicationStep';
import { CreateJobPublishStep } from './createJobSteps/PublishStep';

export function CreateJobDrawer(props: CreateJobDrawerProps) {
  const {
  isOpen,
  onClose,
  onJobCreated,
  jobId,
  duplicateFromJobId = null,
  onJobUpdated,
  defaultClientId = null,
  prefillFromRequest = null,
} = props;
  const { addSkill, aiGenerating, applicationApplyUrlLoading, applyLinkedInTemplate, beginSmartFillResize, clearSmartJobAttachment, clients, connectingLinkedIn, connectingSocialProvider, contacts, createJobPanelRef, crmClients, disconnectingLinkedInId, disconnectingTwitterId, dropdownsOpen, effectiveApplyUrl, formData, generatedLinkedInPost, generatedTwitterPost, goWizardBack, goWizardNext, handleApplicationLogoFileChange, handleConnectLinkedIn, handleConnectSocialAccount, handleDisconnectLinkedInAccount, handleDisconnectTwitterAccount, handleJobDescriptionPaste, handleLinkedInImageFileChange, handleSaveJob, handleSmartJobFilePick, handleSmartJobProcess, isEditMode, isStandaloneMode, jobDetailsFormData, lineManagers, linkedIn, linkedInImageUploadFeedback, linkedInImageUrl, linkedInPostSections, linkedInPostText, linkedInPostUrl, linkedinAccounts, loading, loadingClients, loadingContacts, loadingLineManagers, loadingUsers, logoUploadFeedback, ownCompanyClient, ownCompanyDisplayName, patchJobDetailsForm, postingChooser, removeSkill, requestCreateJobClose, selectedLinkedInPreviewAccount, selectedLinkedInTargets, selectedLinkedInTemplateId, selectedLinkedInTemplateName, selectedTwitterPreviewAccount, selectedTwitterTargets, setDropdownsOpen, setExistingOtherDocName, setFacebookCaptionTouched, setFormData, setLinkedInImageUrl, setLinkedInPostSections, setLinkedInPostText, setLinkedInPostTextTouched, setSelectedLinkedInTargets, setSelectedLinkedInTemplateId, setSelectedLinkedInTemplateName, setSelectedTwitterTargets, setShowFormBuilder, setShowLinkedInTemplateModal, setSkillInput, setSmartJobPrompt, setSmartJobPromptVisible, setTwitterPostTextTouched, setUploadedFile, setWizardStep, showFormBuilder, showLinkedInSuccess, showLinkedInTemplateModal, skillInput, smartFillPanelHeight, smartJobAttachment, smartJobError, smartJobFileInputRef, smartJobPrompt, smartJobPromptBoundsRef, smartJobPromptBoxRef, smartJobPromptVisible, socialStatusLoading, twitterAccounts, uploadingApplicationLogo, uploadingLinkedInImage, useLineManagerPicker, users, wizardStep, wizardStepIndex, wizardSteps, workspaceOwnerHeading } = useCreateJobDrawer(props);

return (
    <>
    <AnimatePresence>
      {isOpen ? (
          <DetailsModalShell
            key="create-job-drawer"
            panelRef={createJobPanelRef}
            onBackdropClick={() => void requestCreateJobClose()}
            size="lg"
            variant="main"
            zIndexClass="z-50"
            dialogTitleId="create-job-modal-title"
          >
            {/* Sticky Header */}
            <div className={`${DRAWER_FORM_HEADER_CLASS} shrink-0`}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <Briefcase size={20} />
                </div>
                <div className="min-w-0">
                  <h2 id="create-job-modal-title" className="text-lg font-bold tracking-tight text-slate-900">{isEditMode ? 'Edit Job' : 'Add Job'}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {CREATE_JOB_WIZARD_HINTS[wizardStep]}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void requestCreateJobClose()}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-blue-100/80 bg-white/90 px-6 py-4">
              <div className="flex items-center gap-2">
                {wizardSteps.map((step, i) => {
                  const done = i < wizardStepIndex;
                  const active = i === wizardStepIndex;
                  return (
                    <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (i <= wizardStepIndex || isEditMode) setWizardStep(step.id);
                        }}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all ${
                          done
                            ? 'bg-[#2098C8] text-white shadow-md shadow-[#2098C8]/30'
                            : active
                              ? 'bg-[#2098C8] text-white shadow-lg shadow-[#2098C8]/30 ring-4 ring-[#2098C8]/25'
                              : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                        }`}
                        title={step.label}
                        aria-current={active ? 'step' : undefined}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </button>
                      <span
                        className={`hidden min-w-0 truncate text-xs font-semibold sm:block ${
                          active ? 'text-slate-900' : done ? 'text-[#2098C8]' : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                      {i < wizardSteps.length - 1 ? (
                        <div
                          className={`h-1.5 min-w-[6px] flex-1 rounded-full ${
                            done
                              ? 'bg-[#2098C8]'
                              : active
                                ? 'bg-gradient-to-r from-[#2098C8] to-slate-200'
                                : 'bg-slate-200/90'
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Step {wizardStepIndex + 1} of {wizardSteps.length} · {wizardSteps[wizardStepIndex]?.label}
              </p>
            </div>

            {/* Scrollable Content */}
            <div ref={smartJobPromptBoundsRef} className="flex min-h-0 flex-1 flex-col">
              <div className={`flex-1 overflow-y-auto ${DRAWER_FORM_SCROLL_BG} p-6 space-y-5`}>
              {wizardStep === 'client' && <CreateJobClientStep crmClients={crmClients} formData={formData} isStandaloneMode={isStandaloneMode} ownCompanyClient={ownCompanyClient} ownCompanyDisplayName={ownCompanyDisplayName} setFormData={setFormData} />}

              {wizardStep === 'jd' && <CreateJobJdStep aiGenerating={aiGenerating} handleSmartJobFilePick={handleSmartJobFilePick} smartJobAttachment={smartJobAttachment} smartJobError={smartJobError} smartJobFileInputRef={smartJobFileInputRef} />}

              {wizardStep === 'details' && <CreateJobDetailsStep addSkill={addSkill} aiGenerating={aiGenerating} clearSmartJobAttachment={clearSmartJobAttachment} contacts={contacts} crmClients={crmClients} dropdownsOpen={dropdownsOpen} formData={formData} handleJobDescriptionPaste={handleJobDescriptionPaste} handleSmartJobFilePick={handleSmartJobFilePick} isOpen={isOpen} isStandaloneMode={isStandaloneMode} jobDetailsFormData={jobDetailsFormData} lineManagers={lineManagers} loadingClients={loadingClients} loadingContacts={loadingContacts} loadingLineManagers={loadingLineManagers} loadingUsers={loadingUsers} ownCompanyClient={ownCompanyClient} ownCompanyDisplayName={ownCompanyDisplayName} patchJobDetailsForm={patchJobDetailsForm} postingChooser={postingChooser} removeSkill={removeSkill} setDropdownsOpen={setDropdownsOpen} setExistingOtherDocName={setExistingOtherDocName} setFormData={setFormData} setSkillInput={setSkillInput} setUploadedFile={setUploadedFile} skillInput={skillInput} smartJobAttachment={smartJobAttachment} smartJobError={smartJobError} smartJobFileInputRef={smartJobFileInputRef} useLineManagerPicker={useLineManagerPicker} users={users} workspaceOwnerHeading={workspaceOwnerHeading} />}

              {wizardStep === 'application' && <CreateJobApplicationStep formData={formData} handleApplicationLogoFileChange={handleApplicationLogoFileChange} isEditMode={isEditMode} jobId={jobId} logoUploadFeedback={logoUploadFeedback} setFormData={setFormData} setShowFormBuilder={setShowFormBuilder} uploadingApplicationLogo={uploadingApplicationLogo} />}

              {wizardStep === 'publish' && <CreateJobPublishStep applicationApplyUrlLoading={applicationApplyUrlLoading} clients={clients} connectingLinkedIn={connectingLinkedIn} connectingSocialProvider={connectingSocialProvider} disconnectingLinkedInId={disconnectingLinkedInId} disconnectingTwitterId={disconnectingTwitterId} effectiveApplyUrl={effectiveApplyUrl} formData={formData} generatedLinkedInPost={generatedLinkedInPost} generatedTwitterPost={generatedTwitterPost} handleConnectLinkedIn={handleConnectLinkedIn} handleConnectSocialAccount={handleConnectSocialAccount} handleDisconnectLinkedInAccount={handleDisconnectLinkedInAccount} handleDisconnectTwitterAccount={handleDisconnectTwitterAccount} handleLinkedInImageFileChange={handleLinkedInImageFileChange} jobId={jobId} linkedIn={linkedIn} linkedInImageUploadFeedback={linkedInImageUploadFeedback} linkedInImageUrl={linkedInImageUrl} linkedInPostSections={linkedInPostSections} linkedInPostText={linkedInPostText} linkedInPostUrl={linkedInPostUrl} linkedinAccounts={linkedinAccounts} selectedLinkedInPreviewAccount={selectedLinkedInPreviewAccount} selectedLinkedInTargets={selectedLinkedInTargets} selectedLinkedInTemplateId={selectedLinkedInTemplateId} selectedLinkedInTemplateName={selectedLinkedInTemplateName} selectedTwitterPreviewAccount={selectedTwitterPreviewAccount} selectedTwitterTargets={selectedTwitterTargets} setFacebookCaptionTouched={setFacebookCaptionTouched} setFormData={setFormData} setLinkedInImageUrl={setLinkedInImageUrl} setLinkedInPostSections={setLinkedInPostSections} setLinkedInPostText={setLinkedInPostText} setLinkedInPostTextTouched={setLinkedInPostTextTouched} setSelectedLinkedInTargets={setSelectedLinkedInTargets} setSelectedLinkedInTemplateId={setSelectedLinkedInTemplateId} setSelectedLinkedInTemplateName={setSelectedLinkedInTemplateName} setSelectedTwitterTargets={setSelectedTwitterTargets} setShowLinkedInTemplateModal={setShowLinkedInTemplateModal} setTwitterPostTextTouched={setTwitterPostTextTouched} showLinkedInSuccess={showLinkedInSuccess} socialStatusLoading={socialStatusLoading} twitterAccounts={twitterAccounts} uploadingLinkedInImage={uploadingLinkedInImage} />}
              </div>

              {false && !isEditMode ? (
                <div
                  className="flex shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-white"
                  style={smartJobPromptVisible ? { height: smartFillPanelHeight } : undefined}
                >
                  {smartJobPromptVisible ? (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize smart fill panel"
                      title="Drag to resize"
                      onMouseDown={beginSmartFillResize}
                      className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white hover:from-slate-100 hover:to-slate-50"
                    >
                      <GripHorizontal
                        size={16}
                        className="text-slate-400 transition-colors group-hover:text-slate-600"
                        aria-hidden
                      />
                    </div>
                  ) : null}

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-2.5">
                    <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-600" />
                        <span className="text-sm font-semibold text-slate-900">Smart fill</span>
                        <span className="text-xs text-slate-500">Paste details to auto-fill the form</span>
                      </div>
                      {smartJobPromptVisible ? (
                        <button
                          type="button"
                          onClick={() => setSmartJobPromptVisible(false)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Hide
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSmartJobPromptVisible(true)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Show
                        </button>
                      )}
                    </div>

                    {smartJobPromptVisible ? (
                      <div ref={smartJobPromptBoxRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                        {smartJobError ? (
                          <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                            {smartJobError}
                          </p>
                        ) : null}

                        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                          <div className="flex min-h-0 flex-1 items-end gap-2">
                            <textarea
                              id="job-smart-prompt"
                              value={smartJobPrompt}
                              onChange={(e) => setSmartJobPrompt(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !aiGenerating) {
                                  e.preventDefault();
                                  void handleSmartJobProcess();
                                }
                              }}
                              placeholder={'Role: Senior React Developer\nCompany: BluePeak Solutions\nLocation: Bengaluru, India\nSkills: React, TypeScript, Node.js…'}
                              className="h-full min-h-[56px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                              disabled={aiGenerating}
                            />
                            <button
                              type="button"
                              onClick={() => void handleSmartJobProcess()}
                              disabled={aiGenerating || !smartJobPrompt.trim()}
                              className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              aria-label={aiGenerating ? 'Processing' : 'Fill form from text'}
                              title={aiGenerating ? 'Processing…' : 'Fill form (Enter)'}
                            >
                              {aiGenerating ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              ) : (
                                <ArrowUp size={15} strokeWidth={2.25} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="relative shrink-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goWizardBack}
                    disabled={
                      (isEditMode && wizardStep === 'details') ||
                      (!isEditMode && wizardStep === 'client')
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void requestCreateJobClose()}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    {wizardStep === 'publish' ? (
                      <button
                        type="button"
                        onClick={handleSaveJob}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={14} />
                        {loading
                          ? isEditMode
                            ? 'Saving...'
                            : 'Publishing...'
                          : isEditMode
                            ? 'Save Job'
                            : 'Publish Job'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={goWizardNext}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#2098C8] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#2098C8]/30 transition hover:bg-[#1A86B3]"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DetailsModalShell>
      ) : null}
    </AnimatePresence>

      <ApplicationFormBuilderModal
        isOpen={showFormBuilder}
        onClose={() => setShowFormBuilder(false)}
        schema={formData.applicationFormSchema ?? defaultApplicationFormSchema()}
        onChange={(schema) =>
          setFormData((prev) => ({
            ...prev,
            applicationFormSchema: schema,
            enableApplicationForm: true,
          }))
        }
      />

      <LinkedInPostTemplateModal
        isOpen={showLinkedInTemplateModal}
        onClose={() => setShowLinkedInTemplateModal(false)}
        selectedTemplateId={selectedLinkedInTemplateId}
        onApply={(template: JobLinkedInPostTemplate) => {
          applyLinkedInTemplate(template);
        }}
      />
    </>
  );
}

