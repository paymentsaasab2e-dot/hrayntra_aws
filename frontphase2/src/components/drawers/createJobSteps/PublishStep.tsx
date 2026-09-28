'use client';

import React from 'react';
import { DrawerSectionCard } from '../drawerFormUi';
import { Share2, Linkedin, FileText, Check, AlertCircle, Twitter, Facebook, Loader2 } from 'lucide-react';
import { SocialAccountPicker } from '../../SocialAccountPicker';
import { LINKEDIN_POST_MAX_LENGTH, buildCandidatePortalApplyUrlPreview } from '../../../lib/jobSocialPost';
import { DocumentUploadButton } from '../../import/documentUploadUi';
import { getTenantDbName } from '../../../lib/api';
import { visibleLinkedInTemplateSectionLabels } from '../../../lib/jobLinkedInPostTemplate';
import { LinkedInPostPreview } from '../../LinkedInPostPreview';
import { isJobFieldPubliclyVisible, resolvePostedCompanyNameForSocial } from '../../../lib/jobPublicFieldVisibility';
import { DrawerLinkActions } from '../DrawerLinkActions';
import { TwitterPostPreview } from '../../TwitterPostPreview';
import { getLocalDateTimeInputMinNow, clampDateTimeLocalToMin } from '../../../utils/dateInputConstraints';
import { WhatsAppIcon } from '../../icons/WhatsAppIcon';

export function CreateJobPublishStep(props: any) {
  const {
    applicationApplyUrlLoading,
    clients,
    connectingLinkedIn,
    connectingSocialProvider,
    disconnectingLinkedInId,
    disconnectingTwitterId,
    effectiveApplyUrl,
    formData,
    generatedLinkedInPost,
    generatedTwitterPost,
    handleConnectLinkedIn,
    handleConnectSocialAccount,
    handleDisconnectLinkedInAccount,
    handleDisconnectTwitterAccount,
    handleLinkedInImageFileChange,
    jobId,
    linkedIn,
    linkedInImageUploadFeedback,
    linkedInImageUrl,
    linkedInPostSections,
    linkedInPostText,
    linkedInPostUrl,
    linkedinAccounts,
    selectedLinkedInPreviewAccount,
    selectedLinkedInTargets,
    selectedLinkedInTemplateId,
    selectedLinkedInTemplateName,
    selectedTwitterPreviewAccount,
    selectedTwitterTargets,
    setFacebookCaptionTouched,
    setFormData,
    setLinkedInImageUrl,
    setLinkedInPostSections,
    setLinkedInPostText,
    setLinkedInPostTextTouched,
    setSelectedLinkedInTargets,
    setSelectedLinkedInTemplateId,
    setSelectedLinkedInTemplateName,
    setSelectedTwitterTargets,
    setShowLinkedInTemplateModal,
    setTwitterPostTextTouched,
    showLinkedInSuccess,
    socialStatusLoading,
    twitterAccounts,
    uploadingLinkedInImage,
  } = props;

  return (
<DrawerSectionCard
                title="Publish & Share"
                subtitle="LinkedIn, social channels, and job board publishing"
                icon={Share2}
                accent="sky"
              >
                  <div className="space-y-4">
                    {/* LinkedIn Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Linkedin size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">LinkedIn</h4>
                            <p className="text-xs text-slate-500">Share a hiring post to your LinkedIn feed</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.linkedInEnabled}
                            onChange={(e: any) => setFormData((prev: any) => ({ ...prev, linkedInEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.linkedInEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3">
                            <p className="text-sm font-semibold text-slate-900">How this posts to LinkedIn</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              When you save this job, HRYANTRA publishes the post below to the LinkedIn
                              profile or company page you select. Nothing is posted until you save. Edit
                              the text — the LinkedIn preview shows exactly how the feed will look.
                            </p>
                          </div>

                          <SocialAccountPicker
                            provider="linkedin"
                            accounts={linkedinAccounts}
                            selectedKeys={selectedLinkedInTargets}
                            onSelectionChange={setSelectedLinkedInTargets}
                            onConnect={() => void handleConnectLinkedIn()}
                            onDisconnect={(accountId: any) => void handleDisconnectLinkedInAccount(accountId)}
                            connecting={connectingLinkedIn}
                            disconnectingId={disconnectingLinkedInId}
                            loading={socialStatusLoading || linkedIn.isLoading}
                          />

                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">Post templates</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  The selected template controls which job fields appear in the LinkedIn
                                  post. You can still edit the final wording below.
                                </p>
                                {selectedLinkedInTemplateName ? (
                                  <p className="mt-1.5 text-xs font-medium text-blue-700">
                                    Using: {selectedLinkedInTemplateName}
                                  </p>
                                ) : (
                                  <p className="mt-1.5 text-xs text-slate-400">
                                    No template yet — posting from Public Visibility
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {selectedLinkedInTemplateId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedLinkedInTemplateId(null);
                                      setSelectedLinkedInTemplateName(null);
                                      setLinkedInPostSections(null);
                                      setLinkedInPostTextTouched(false);
                                      setTwitterPostTextTouched(false);
                                      setFacebookCaptionTouched(false);
                                    }}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setShowLinkedInTemplateModal(true)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <FileText size={13} />
                                  Manage templates
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Edit LinkedIn post
                                  <span className="ml-1 text-xs text-slate-500">
                                    ({linkedInPostText.length}/{LINKEDIN_POST_MAX_LENGTH} chars)
                                  </span>
                                </label>
                                <textarea
                                  value={linkedInPostText}
                                  onChange={(e: any) => {
                                    setLinkedInPostTextTouched(true);
                                    const text = e.target.value.substring(0, LINKEDIN_POST_MAX_LENGTH);
                                    setLinkedInPostText(text);
                                  }}
                                  rows={12}
                                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                  placeholder="LinkedIn post text is generated from the job form. Edit it here to change what LinkedIn will show."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkedInPostTextTouched(false);
                                    setLinkedInPostText(generatedLinkedInPost);
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Regenerate from job details
                                </button>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  Post image (optional)
                                </label>
                                <p className="mb-2 text-xs text-slate-500">
                                  This image appears in the LinkedIn feed with the post when you save.
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                  <DocumentUploadButton
                                    variant="secondary"
                                    label="Upload image"
                                    uploadingLabel="Uploading"
                                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                                    isUploading={uploadingLinkedInImage}
                                    uploadSuccess={linkedInImageUploadFeedback.uploadSuccess}
                                    uploadPercent={linkedInImageUploadFeedback.uploadPercent}
                                    onFilesSelected={async (files: any) => {
                                      const file = files[0];
                                      if (file) await handleLinkedInImageFileChange(file);
                                    }}
                                  />
                                  {formData.applicationLogoUrl && !linkedInImageUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setLinkedInImageUrl(formData.applicationLogoUrl)}
                                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                      Use application logo
                                    </button>
                                  ) : null}
                                  {linkedInImageUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setLinkedInImageUrl('')}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                    >
                                      Remove image
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Application URL</label>
                                <input
                                  type="url"
                                  value={formData.linkedInExternalUrl || effectiveApplyUrl}
                                  onChange={(e: any) => setFormData((prev: any) => ({ ...prev, linkedInExternalUrl: e.target.value }))}
                                  placeholder={buildCandidatePortalApplyUrlPreview(getTenantDbName())}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                  {applicationApplyUrlLoading
                                    ? 'Loading candidate apply link…'
                                    : jobId
                                      ? 'This apply link is included in the LinkedIn post.'
                                      : 'A unique apply link is generated when you save. The preview uses a placeholder until then.'}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium text-slate-700">How it will look on LinkedIn</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {selectedLinkedInTemplateName
                                    ? `Using the ${selectedLinkedInTemplateName} template. Hidden fields are omitted.`
                                    : 'Live preview of the post that will go out when you save.'}
                                </p>
                                {visibleLinkedInTemplateSectionLabels(linkedInPostSections).length ? (
                                  <p className="mt-1 text-[11px] leading-4 text-slate-400">
                                    Showing:{' '}
                                    {visibleLinkedInTemplateSectionLabels(linkedInPostSections).join(
                                      ', ',
                                    )}
                                  </p>
                                ) : null}
                              </div>
                              <LinkedInPostPreview
                                userName={
                                  selectedLinkedInPreviewAccount?.name ||
                                  linkedIn.linkedinUser?.name ||
                                  'Your LinkedIn profile'
                                }
                                userPicture={
                                  selectedLinkedInPreviewAccount?.picture ||
                                  linkedIn.linkedinUser?.picture
                                }
                                accountType={selectedLinkedInPreviewAccount?.type}
                                headline={
                                  selectedLinkedInPreviewAccount?.type === 'page'
                                    ? 'Company page · LinkedIn'
                                    : selectedLinkedInPreviewAccount?.accountEmail ||
                                      'Posting to your LinkedIn feed'
                                }
                                jobTitle={
                                  isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobTitle')
                                    ? formData.jobTitle
                                    : ''
                                }
                                company={resolvePostedCompanyNameForSocial({
                                  postingCompanyName: formData.postingCompanyName,
                                  clientCompanyName: clients.find((c: any) => c.id === formData.companyId)
                                    ?.companyName,
                                  showClientNamePublicly: formData.showClientNamePublicly,
                                })}
                                description={
                                  isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'jobDescription') &&
                                  formData.jobDescriptionHtml
                                    ? formData.jobDescriptionHtml.replace(/<[^>]*>/g, '')
                                    : undefined
                                }
                                applyUrl={effectiveApplyUrl}
                                location={
                                  isJobFieldPubliclyVisible(formData.publicFieldVisibility, 'location')
                                    ? formData.city || formData.state || formData.country || formData.fullAddress || undefined
                                    : undefined
                                }
                                postText={linkedInPostText}
                                imageUrl={linkedInImageUrl || null}
                              />
                              {linkedinAccounts.filter((account: any) => selectedLinkedInTargets.includes(account.key)).length > 0 ? (
                                <p className="text-xs leading-5 text-slate-600">
                                  On save, this post goes to{' '}
                                  <span className="font-semibold text-slate-800">
                                    {linkedinAccounts
                                      .filter((account: any) => selectedLinkedInTargets.includes(account.key))
                                      .map((account: any) =>
                                        account.type === 'page' ? `${account.name} (Company Page)` : account.name,
                                      )
                                      .join(', ')}
                                  </span>
                                  .
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {showLinkedInSuccess && linkedInPostUrl ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <Check size={16} className="text-green-600" />
                                <span className="text-sm font-medium text-green-700">Posted to LinkedIn successfully!</span>
                              </div>
                              <DrawerLinkActions url={linkedInPostUrl} shareTitle="LinkedIn job post" />
                            </div>
                          ) : null}

                          {!linkedIn.isConnected ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              Connect LinkedIn above to publish this post when you save the job.
                            </p>
                          ) : selectedLinkedInTargets.length === 0 ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              Select at least one LinkedIn account or company page to publish when you save the job.
                            </p>
                          ) : null}

                          {linkedIn.error ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-red-600" />
                                <span className="text-sm text-red-700">{linkedIn.error}</span>
                              </div>
                              {linkedIn.error.includes('expired') ? (
                                <button
                                  type="button"
                                  onClick={handleConnectLinkedIn}
                                  className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
                                >
                                  Reconnect LinkedIn
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Twitter/X Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Twitter size={20} className="text-slate-900" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Twitter / X</h4>
                            <p className="text-xs text-slate-500">Post job announcement to X</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.twitterEnabled}
                            onChange={(e: any) => setFormData((prev: any) => ({ ...prev, twitterEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.twitterEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <SocialAccountPicker
                            provider="twitter"
                            accounts={twitterAccounts}
                            selectedKeys={selectedTwitterTargets}
                            onSelectionChange={setSelectedTwitterTargets}
                            onConnect={() => void handleConnectSocialAccount('twitter')}
                            onDisconnect={(connectionId: any) => void handleDisconnectTwitterAccount(connectionId)}
                            connecting={connectingSocialProvider === 'twitter'}
                            disconnectingId={disconnectingTwitterId}
                            loading={socialStatusLoading}
                          />

                          {formData.jobTitle && formData.companyId ? (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  X Post Preview
                                  <span className="text-xs text-slate-500 ml-1">({formData.twitterTweetText.length}/280 chars)</span>
                                </label>
                                <TwitterPostPreview
                                  accountName={selectedTwitterPreviewAccount?.name || formData.twitterAccountName}
                                  postText={formData.twitterTweetText}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Edit tweet text
                                  <span className="text-xs text-slate-500 ml-1">({formData.twitterTweetText.length}/280 chars)</span>
                                </label>
                                <textarea
                                  value={formData.twitterTweetText}
                                  onChange={(e: any) => {
                                    setTwitterPostTextTouched(true);
                                    const text = e.target.value.substring(0, 280);
                                    setFormData((prev: any) => ({ ...prev, twitterTweetText: text }));
                                  }}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTwitterPostTextTouched(false);
                                    setFormData((prev: any) => ({ ...prev, twitterTweetText: generatedTwitterPost }));
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Regenerate from job details
                                </button>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Application URL</label>
                                {effectiveApplyUrl ? (
                                  <DrawerLinkActions url={effectiveApplyUrl} shareTitle="Candidate apply link" />
                                ) : (
                                  <p className="text-sm text-slate-400">Apply link not available yet</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Fill in Job Title and Client in Job Details to generate the X preview.
                            </p>
                          )}

                          {!formData.twitterConnected ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Connect an X account above to publish this post when you save the job.
                            </p>
                          ) : selectedTwitterTargets.length === 0 ? (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Select at least one X account to publish when you save the job.
                            </p>
                          ) : null}

                          {formData.twitterConnected ? (
                            <>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.twitterIncludeLogo}
                                  onChange={(e: any) => setFormData((prev: any) => ({ ...prev, twitterIncludeLogo: e.target.checked }))}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Include company logo image</span>
                              </label>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Schedule tweet (optional)</label>
                                <input
                                  type="datetime-local"
                                  min={getLocalDateTimeInputMinNow()}
                                  value={formData.twitterScheduleDate}
                                  onChange={(e: any) => {
                                    const v = e.target.value;
                                    const min = getLocalDateTimeInputMinNow();
                                    setFormData((prev: any) => ({
                                      ...prev,
                                      twitterScheduleDate: v ? clampDateTimeLocalToMin(v, min) : '',
                                    }));
                                  }}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-sm font-medium"
                              >
                                Preview Tweet
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Facebook Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Facebook size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Facebook</h4>
                            <p className="text-xs text-slate-500">Post to Facebook Page</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.facebookEnabled}
                            onChange={(e: any) => setFormData((prev: any) => ({ ...prev, facebookEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.facebookEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          {!formData.facebookConnected ? (
                            <button
                              type="button"
                              onClick={() => void handleConnectSocialAccount('facebook')}
                              disabled={connectingSocialProvider === 'facebook'}
                              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                              {connectingSocialProvider === 'facebook' ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  Connecting...
                                </>
                              ) : (
                                'Connect Facebook Page'
                              )}
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <Check size={16} className="text-green-600" />
                                <span className="text-sm text-green-700">Connected</span>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Page selector</label>
                                <select
                                  value={formData.facebookPageId}
                                  onChange={(e: any) => setFormData((prev: any) => ({ ...prev, facebookPageId: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                  <option value="">Select page</option>
                                  <option value="page1">Company Page 1</option>
                                  <option value="page2">Company Page 2</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Post caption</label>
                                <textarea
                                  value={formData.facebookCaption}
                                  onChange={(e: any) => {
                                    setFacebookCaptionTouched(true);
                                    setFormData((prev: any) => ({ ...prev, facebookCaption: e.target.value }));
                                  }}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                                />
                              </div>

                              <button
                                type="button"
                                className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                Preview Post
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Card */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <WhatsAppIcon size={20} className="text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">WhatsApp Business</h4>
                            <p className="text-xs text-slate-500">Send via WhatsApp Broadcast</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.whatsappEnabled}
                            onChange={(e: any) => setFormData((prev: any) => ({ ...prev, whatsappEnabled: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {formData.whatsappEnabled && (
                        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Business API phone number</label>
                            <input
                              type="tel"
                              value={formData.whatsappPhoneNumber}
                              onChange={(e: any) => setFormData((prev: any) => ({ ...prev, whatsappPhoneNumber: e.target.value }))}
                              placeholder="+1234567890"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Message template</label>
                            <select
                              value={formData.whatsappTemplate}
                              onChange={(e: any) => setFormData((prev: any) => ({ ...prev, whatsappTemplate: e.target.value }))}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="">Select template</option>
                              <option>Job Opening Template 1</option>
                              <option>Job Opening Template 2</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Recipient list</label>
                            <input
                              type="text"
                              placeholder="Enter phone numbers or import CSV"
                              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </DrawerSectionCard>
  );
}
