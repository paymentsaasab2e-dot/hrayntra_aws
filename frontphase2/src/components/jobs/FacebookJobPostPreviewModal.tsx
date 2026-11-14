'use client';

import React from 'react';
import { Eye, Facebook, X } from 'lucide-react';
import { LINKEDIN_POST_MAX_LENGTH } from '../../lib/jobSocialPost';

export type FacebookJobPostPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  postText: string;
  onChangePostText: (value: string) => void;
  generatedPostText: string;
  onRegenerate: () => void;
  pageName: string;
  postingTo?: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  location?: string;
};

export function FacebookJobPostPreviewModal({
  isOpen,
  onClose,
  postText,
  onChangePostText,
  generatedPostText,
  onRegenerate,
  pageName,
  postingTo,
  jobTitle,
  company,
  applyUrl,
  location,
}: FacebookJobPostPreviewModalProps) {
  if (!isOpen) return null;

  const body = (postText || generatedPostText || '').trim();

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div
        className="flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="facebook-post-preview-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
              <Eye size={20} />
            </span>
            <div>
              <h3 id="facebook-post-preview-title" className="text-base font-semibold text-slate-900">
                Facebook post preview
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                This is how the job will look on your Facebook Page feed. Edit the text if you want —
                HRYANTRA publishes this post when you create the job, not before.
              </p>
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
                ({body.length}/{LINKEDIN_POST_MAX_LENGTH})
              </span>
            </label>
            <textarea
              value={postText}
              onChange={(event) =>
                onChangePostText(event.target.value.slice(0, LINKEDIN_POST_MAX_LENGTH))
              }
              rows={14}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-[#1877F2] focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20"
              placeholder="Facebook post text is generated from this job. Edit it here."
            />
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-2 text-xs font-semibold text-[#1877F2] hover:text-[#166FE5]"
            >
              Regenerate from job details
            </button>
            {postingTo ? (
              <p className="mt-3 text-xs leading-5 text-slate-600">
                On create, this post goes to{' '}
                <span className="font-semibold text-slate-800">{postingTo}</span>.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-5 text-amber-700">
                Select a Facebook Page first so this post has somewhere to publish.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Facebook size={15} className="text-[#1877F2]" />
              How it will look on Facebook
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#F0F2F5] p-3">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white">
                    <Facebook size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {pageName || 'Facebook Page'}
                    </p>
                    <p className="text-[11px] text-slate-500">Just now · Public</p>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {body ||
                      [
                        jobTitle ? `We're hiring: ${jobTitle}` : null,
                        company ? `at ${company}` : null,
                        location ? `Location: ${location}` : null,
                        applyUrl ? `Apply: ${applyUrl}` : null,
                      ]
                        .filter(Boolean)
                        .join('\n') ||
                      'Your Facebook job post will appear here.'}
                  </p>
                  {applyUrl ? (
                    <a
                      href={applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-[#1877F2] hover:underline"
                    >
                      {applyUrl}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1877F2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#166FE5]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
