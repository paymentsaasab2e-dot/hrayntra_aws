'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { FileText, X, Plus } from 'lucide-react';
import { ApplicationLogoOption, ScreeningQuestion, ScreeningQuestionType, SCREENING_TYPE_OPTIONS, generateScreeningQuestionId } from '../createJobShared';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import { PreScreenAssessmentSection } from '../../jobs/PreScreenAssessmentSection';

export function CreateJobApplicationStep(props: any) {
  const {
    formData,
    handleApplicationLogoFileChange,
    isEditMode,
    jobId,
    logoUploadFeedback,
    setFormData,
    setShowFormBuilder,
    uploadingApplicationLogo,
  } = props;

  return (
<DrawerSectionCard
                title="Job Application Form"
                subtitle="Application fields and pre-screen assessments"
                icon={FileText}
                accent="violet"
              >
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableApplicationForm}
                        onChange={(e: any) => setFormData((prev: any) => ({ ...prev, enableApplicationForm: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Enable Job Application Form
                        <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards)</span>
                      </span>
                    </label>

                    {formData.enableApplicationForm && (
                      <>
                        {isEditMode ? (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Custom application form</p>
                                <p className="text-xs text-slate-600">
                                  Build fields (email, phone, resume, education, work history, etc.). Saved with this job and used on the public apply link after publish.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowFormBuilder(true)}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                Edit / Create form
                              </button>
                            </div>
                            <p className="text-xs text-slate-600">
                              {(formData.applicationFormSchema?.fields?.length ?? 0)} field(s) configured
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Logo selection</label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="account"
                                checked={formData.logoOption === 'account'}
                                onChange={(e: any) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Your Account Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="company"
                                checked={formData.logoOption === 'company'}
                                onChange={(e: any) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Job's Company Logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="none"
                                checked={formData.logoOption === 'none'}
                                onChange={(e: any) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">No logo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoOption"
                                value="custom"
                                checked={formData.logoOption === 'custom'}
                                onChange={(e: any) => {
                                  const v = e.target.value as ApplicationLogoOption;
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    logoOption: v,
                                    applicationLogoUrl: v === 'custom' ? prev.applicationLogoUrl : '',
                                  }));
                                }}
                                className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-700">Uploaded logo (Cloudinary)</span>
                            </label>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                              <DocumentUploadButton
                                variant="secondary"
                                label="Upload logo"
                                uploadingLabel="Uploading"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                isUploading={uploadingApplicationLogo}
                                uploadSuccess={logoUploadFeedback.uploadSuccess}
                                uploadPercent={logoUploadFeedback.uploadPercent}
                                onFilesSelected={async (files: any) => {
                                  const file = files[0];
                                  if (file) await handleApplicationLogoFileChange(file);
                                }}
                              />
                              <p className="text-xs text-slate-500 max-w-md">
                                Images are stored in <span className="font-medium text-slate-600">Cloudinary</span> via your API.
                                {isEditMode && jobId
                                  ? ' Upload is attached to this job.'
                                  : ' Select a company in Job Details first so the file can be uploaded under that client.'}
                              </p>
                            </div>
                            {formData.applicationLogoUrl ? (
                              <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                <img
                                  src={formData.applicationLogoUrl}
                                  alt="Uploaded application form logo"
                                  className="h-20 max-h-24 w-auto max-w-[220px] rounded-lg border border-slate-200 bg-white object-contain p-1"
                                />
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-medium text-slate-600">Preview</p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFormData((prev: any) => ({
                                        ...prev,
                                        applicationLogoUrl: '',
                                        logoOption: prev.logoOption === 'custom' ? 'none' : prev.logoOption,
                                      }))
                                    }
                                    className="self-start text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Remove uploaded logo
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">Job Application Form Questions</label>
                            <span className="text-xs text-slate-500">Shown to candidates when they click Apply</span>
                          </div>

                          {formData.applicationQuestions.length > 0 ? (
                            <div className="space-y-3">
                              {formData.applicationQuestions.map((question: any, index: any) => {
                                const updateQuestion = (patch: Partial<ScreeningQuestion>) => {
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.map((q: any, i: any) =>
                                      i === index ? { ...q, ...patch } : q
                                    ),
                                  }));
                                };
                                const removeQuestion = () => {
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    applicationQuestions: prev.applicationQuestions.filter((_: any, i: any) => i !== index),
                                  }));
                                };
                                const setOption = (optionIndex: number, value: string) => {
                                  const next = [...(question.options || [])];
                                  next[optionIndex] = value;
                                  updateQuestion({ options: next });
                                };
                                const addOption = () => {
                                  updateQuestion({ options: [...(question.options || []), ''] });
                                };
                                const removeOption = (optionIndex: number) => {
                                  updateQuestion({
                                    options: (question.options || []).filter((_: any, i: any) => i !== optionIndex),
                                  });
                                };
                                return (
                                  <div
                                    key={question.id}
                                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
                                      <select
                                        value={question.type}
                                        onChange={(e: any) => {
                                          const nextType = e.target.value as ScreeningQuestionType;
                                          const patch: Partial<ScreeningQuestion> = { type: nextType };
                                          if (nextType === 'single_choice' && !(question.options && question.options.length)) {
                                            patch.options = ['', ''];
                                          }
                                          if (nextType === 'slider') {
                                            if (typeof question.min !== 'number') patch.min = 0;
                                            if (typeof question.max !== 'number') patch.max = 100;
                                            if (typeof question.step !== 'number') patch.step = 1;
                                            if (!question.minLabel) patch.minLabel = 'Beginner';
                                            if (!question.maxLabel) patch.maxLabel = 'Expert';
                                          }
                                          updateQuestion(patch);
                                        }}
                                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      >
                                        {SCREENING_TYPE_OPTIONS.map((opt: any) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600">
                                        <input
                                          type="checkbox"
                                          checked={!!question.required}
                                          onChange={(e: any) => updateQuestion({ required: e.target.checked })}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Required
                                      </label>
                                      <button
                                        type="button"
                                        onClick={removeQuestion}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete question"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <input
                                      type="text"
                                      value={question.label}
                                      onChange={(e: any) => updateQuestion({ label: e.target.value })}
                                      placeholder="Type your question here…"
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />

                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {SCREENING_TYPE_OPTIONS.find((o: any) => o.value === question.type)?.hint}
                                    </p>

                                    {question.type === 'single_choice' && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-xs font-medium text-slate-600">Options</p>
                                        {(question.options || []).map((opt: any, optionIndex: any) => (
                                          <div key={optionIndex} className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e: any) => setOption(optionIndex, e.target.value)}
                                              placeholder={`Option ${optionIndex + 1}`}
                                              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => removeOption(optionIndex)}
                                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Remove option"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={addOption}
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                        >
                                          <Plus size={14} /> Add option
                                        </button>
                                      </div>
                                    )}

                                    {question.type === 'slider' && (
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min value</label>
                                          <input
                                            type="number"
                                            value={typeof question.min === 'number' ? question.min : 0}
                                            onChange={(e: any) => updateQuestion({ min: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max value</label>
                                          <input
                                            type="number"
                                            value={typeof question.max === 'number' ? question.max : 100}
                                            onChange={(e: any) => updateQuestion({ max: Number(e.target.value) })}
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Min label</label>
                                          <input
                                            type="text"
                                            value={question.minLabel || ''}
                                            onChange={(e: any) => updateQuestion({ minLabel: e.target.value })}
                                            placeholder="Beginner"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Max label</label>
                                          <input
                                            type="text"
                                            value={question.maxLabel || ''}
                                            onChange={(e: any) => updateQuestion({ maxLabel: e.target.value })}
                                            placeholder="Expert"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {question.type === 'yes_no' && (
                                      <p className="mt-2 text-[11px] text-slate-500">
                                        Candidates will see two buttons: <span className="font-medium">Yes</span> and{' '}
                                        <span className="font-medium">No</span>.
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No questions added yet.</p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {SCREENING_TYPE_OPTIONS.map((opt: any) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const base: ScreeningQuestion = {
                                    id: generateScreeningQuestionId(),
                                    type: opt.value,
                                    label: '',
                                    required: false,
                                  };
                                  if (opt.value === 'single_choice') base.options = ['', ''];
                                  if (opt.value === 'slider') {
                                    base.min = 0;
                                    base.max = 100;
                                    base.step = 1;
                                    base.minLabel = 'Beginner';
                                    base.maxLabel = 'Expert';
                                  }
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    applicationQuestions: [...prev.applicationQuestions, base],
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                              >
                                <Plus size={14} /> {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Note For Candidates
                            <span className="text-xs text-slate-500 ml-1">(Required To Post On Partner Job Boards, If Job Description Is Not Provided In Text Format)</span>
                          </label>
                          <textarea
                            value={formData.noteForCandidates}
                            onChange={(e: any) => setFormData((prev: any) => ({ ...prev, noteForCandidates: e.target.value }))}
                            rows={4}
                            placeholder="Add a note for candidates..."
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                          />
                        </div>
                      </>
                    )}

                    <PreScreenAssessmentSection
                      jobId={isEditMode ? jobId : undefined}
                      jobTitle={formData.jobTitle}
                      skills={formData.skills}
                      jobDescription={
                        formData.jobSummary?.trim() ||
                        formData.jobDescriptionHtml?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
                        ''
                      }
                      links={formData.preScreenAssessments ?? []}
                      onChange={(preScreenAssessments: any) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          preScreenAssessments: Array.isArray(preScreenAssessments)
                            ? preScreenAssessments
                            : [],
                        }))
                      }
                    />
                  </div>
              </DrawerSectionCard>
  );
}
