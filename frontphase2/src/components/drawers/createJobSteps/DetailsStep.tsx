'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Briefcase, Upload, Loader2, FileText, X } from 'lucide-react';
import { RichTextEditor } from '../../RichTextEditor';
import { CreateJobDetailsForm } from '../CreateJobDetailsForm';

export function CreateJobDetailsStep(props: any) {
  const {
    addSkill,
    aiGenerating,
    clearSmartJobAttachment,
    contacts,
    crmClients,
    dropdownsOpen,
    formData,
    handleJobDescriptionPaste,
    handleSmartJobFilePick,
    isOpen,
    isStandaloneMode,
    jobDetailsFormData,
    lineManagers,
    loadingClients,
    loadingContacts,
    loadingLineManagers,
    loadingUsers,
    ownCompanyClient,
    ownCompanyDisplayName,
    patchJobDetailsForm,
    postingChooser,
    removeSkill,
    setDropdownsOpen,
    setExistingOtherDocName,
    setFormData,
    setSkillInput,
    setUploadedFile,
    skillInput,
    smartJobAttachment,
    smartJobError,
    smartJobFileInputRef,
    useLineManagerPicker,
    users,
    workspaceOwnerHeading,
  } = props;

  return (
<DrawerSectionCard
                title="Job Details"
                subtitle="Description, role info, and requirements"
                icon={Briefcase}
                accent="blue"
              >
                  <div className="space-y-6">
                    <div>
                      <input
                        ref={smartJobFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden"
                        onChange={(e: any) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          void handleSmartJobFilePick(file);
                        }}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Job Description{' '}
                          <span className="font-normal text-slate-500">(optional)</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => smartJobFileInputRef.current?.click()}
                            onDragOver={(e: any) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e: any) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const file = e.dataTransfer.files?.[0];
                              if (file) void handleSmartJobFilePick(file);
                            }}
                            disabled={aiGenerating}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload className="h-3.5 w-3.5 text-blue-600" />
                            Upload Job Description
                            <span className="font-normal text-slate-500">· PDF, DOC, DOCX, TXT</span>
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 mb-3 text-xs text-slate-500">
                        Upload a JD or paste and edit the full posting below.
                      </p>

                      {smartJobAttachment ? (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-900 px-2.5 py-2 text-white">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                              {smartJobAttachment.status === 'processing' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-white" strokeWidth={2.25} />
                              ) : (
                                <FileText className="h-4 w-4 text-white" strokeWidth={2} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium leading-tight">
                                {smartJobAttachment.file.name}
                              </p>
                              <p className="text-[11px] leading-tight text-slate-400">
                                {smartJobAttachment.status === 'processing'
                                  ? 'Extracting job details…'
                                  : smartJobAttachment.status === 'error'
                                    ? smartJobAttachment.error || 'Processing failed'
                                    : 'Ready — review the form and publish'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                clearSmartJobAttachment();
                                setUploadedFile(null);
                                setExistingOtherDocName('');
                              }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                              aria-label="Remove attached file"
                              title="Remove file"
                              disabled={smartJobAttachment.status === 'processing'}
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {smartJobAttachment && smartJobError ? (
                        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                          {smartJobError}
                        </p>
                      ) : null}

                      {isOpen ? (
                        <div onPasteCapture={handleJobDescriptionPaste}>
                          <RichTextEditor
                            value={formData.jobDescriptionHtml}
                            onChange={(html: any) => setFormData((prev: any) => ({ ...prev, jobDescriptionHtml: html }))}
                            placeholder="Paste or enter the full job description…"
                            minHeight={360}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-slate-100" />

                    <CreateJobDetailsForm
                      formData={jobDetailsFormData}
                      setFormData={patchJobDetailsForm}
                      clients={
                        ownCompanyClient
                          ? [
                              ownCompanyClient,
                              ...crmClients.filter((client: any) => client.id !== ownCompanyClient.id),
                            ]
                          : crmClients
                      }
                      users={users}
                      contacts={contacts}
                      loadingClients={loadingClients}
                      loadingUsers={loadingUsers}
                      loadingContacts={loadingContacts}
                      dropdownsOpen={dropdownsOpen}
                      setDropdownsOpen={setDropdownsOpen as React.Dispatch<React.SetStateAction<Record<string, boolean>>>}
                      skillInput={skillInput}
                      setSkillInput={setSkillInput}
                      onAddSkill={addSkill}
                      onRemoveSkill={removeSkill}
                      hideCompanyField={isStandaloneMode}
                      standaloneWorkspaceName={isStandaloneMode ? ownCompanyDisplayName : undefined}
                      ownCompanyDisplayName={ownCompanyDisplayName}
                      workspaceOwnerHeading={workspaceOwnerHeading}
                      useLineManagerPicker={useLineManagerPicker}
                      lineManagerOptions={lineManagers}
                      loadingLineManagers={loadingLineManagers}
                      postingCompanyOptions={postingChooser.options}
                      canChoosePostingCompany={postingChooser.canChoose}
                      postingCompanyFieldLabel={postingChooser.fieldLabel}
                    />
                  </div>
              </DrawerSectionCard>
  );
}
