'use client';

import React from 'react';
import { Eye, Linkedin, X } from 'lucide-react';
import { LinkedInPostPreview } from '../LinkedInPostPreview';
import { LINKEDIN_POST_MAX_LENGTH } from '../../lib/jobSocialPost';

export type LinkedInJobPostPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  postText: string;
  onChangePostText: (value: string) => void;
  generatedPostText: string;
  onRegenerate: () => void;
  userName: string;
  userPicture?: string | null;
  accountType?: 'personal' | 'page';
  headline?: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  location?: string;
  postingTo?: string;
  templateName?: string | null;
  visibleSectionLabels?: string[];
};

export function LinkedInJobPostPreviewModal({
  isOpen,
  onClose,
  postText,
  onChangePostText,
  generatedPostText,
  onRegenerate,
  userName,
  userPicture,
  accountType,
  headline,
  jobTitle,
  company,
  applyUrl,
  location,
  postingTo,
  templateName,
  visibleSectionLabels = [],
}: LinkedInJobPostPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div
        className="flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="linkedin-post-preview-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0077b5]/10 text-[#0077b5]">
              <Eye size={20} />
            </span>
            <div>
              <h3 id="linkedin-post-preview-title" className="text-base font-semibold text-slate-900">
                LinkedIn post preview
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                This is how the job will look on LinkedIn using{' '}
                {templateName ? (
                  <>
                    the <span className="font-semibold text-slate-700">{templateName}</span> template
                  </>
                ) : (
                  'your LinkedIn template (or default section order)'
                )}
                . Hidden template fields are not included. Edit the text if you want — HRYANTRA
                publishes this post when you create the job, not before.
              </p>
              {visibleSectionLabels.length ? (
                <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
                  Showing: {visibleSectionLabels.join(', ')}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto px-5 py-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Edit post
              <span className="ml-1 text-xs text-slate-500">
                ({postText.length}/{LINKEDIN_POST_MAX_LENGTH})
              </span>
            </label>
            <textarea
              value={postText}
              onChange={(event) =>
                onChangePostText(event.target.value.slice(0, LINKEDIN_POST_MAX_LENGTH))
              }
              rows={14}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#0077b5] focus:outline-none focus:ring-2 focus:ring-[#0077b5]/20"
              placeholder="LinkedIn post text is generated from this job. Edit it here."
            />
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-2 text-xs font-semibold text-[#0077b5] hover:text-[#006399]"
            >
              Regenerate from job details
            </button>
            {postingTo ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">
                On create, this post goes to <span className="font-semibold text-slate-800">{postingTo}</span>.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-amber-700">
                Select a LinkedIn account first so this post has somewhere to publish.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Linkedin size={15} className="text-[#0077b5]" />
              How it will look on LinkedIn
            </p>
            <LinkedInPostPreview
              userName={userName}
              userPicture={userPicture}
              accountType={accountType}
              headline={headline}
              jobTitle={jobTitle}
              company={company}
              applyUrl={applyUrl}
              location={location}
              postText={postText || generatedPostText}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0077b5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#006399]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
