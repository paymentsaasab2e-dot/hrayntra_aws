'use client';

import React from 'react';
import { Globe2, Linkedin, MessageCircle, Repeat2, Send, ThumbsUp } from 'lucide-react';
import { linkifyPostText } from '../utils/linkifyPostText';

interface LinkedInPostPreviewProps {
  userName: string;
  userPicture?: string | null;
  accountType?: 'personal' | 'page';
  headline?: string;
  jobTitle: string;
  company: string;
  description?: string;
  applyUrl: string;
  location?: string;
  /** When set, renders this text instead of auto-generating from fields. */
  postText?: string;
  /** Optional image shown under the post text in the preview. */
  imageUrl?: string | null;
}

function fallbackPostText(props: LinkedInPostPreviewProps): string {
  return `We're hiring a ${props.jobTitle || '…'} at ${props.company || '…'}!

${
  props.description
    ? props.description.substring(0, 200) + (props.description.length > 200 ? '...' : '')
    : ''
}
${props.location ? `\nLocation: ${props.location}\n` : ''}
Apply here: ${props.applyUrl}

#hiring #jobs #careers`;
}

export function LinkedInPostPreview({
  userName,
  userPicture,
  accountType,
  headline,
  jobTitle,
  company,
  description,
  applyUrl,
  location,
  postText: postTextOverride,
  imageUrl,
}: LinkedInPostPreviewProps) {
  const postText = postTextOverride?.trim() || fallbackPostText({
    userName,
    userPicture,
    jobTitle,
    company,
    description,
    applyUrl,
    location,
  });
  const displayHeadline =
    headline ||
    (accountType === 'page'
      ? 'Company page · LinkedIn'
      : 'Posting to your LinkedIn feed');

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-[#F3F6F8] px-3 py-2">
        <Linkedin size={14} className="text-[#0A66C2]" fill="currentColor" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          LinkedIn feed preview
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {userPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userPicture}
              alt={userName}
              className={`h-12 w-12 object-cover ${accountType === 'page' ? 'rounded-lg' : 'rounded-full'}`}
            />
          ) : (
            <div
              className={`flex h-12 w-12 items-center justify-center bg-[#0A66C2] text-white ${
                accountType === 'page' ? 'rounded-lg' : 'rounded-full'
              }`}
            >
              <Linkedin size={22} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{userName || 'Your LinkedIn profile'}</p>
            <p className="truncate text-xs text-slate-500">{displayHeadline}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
              Just now · <Globe2 size={11} /> Anyone
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="whitespace-pre-line text-sm leading-6 text-slate-800">
          {linkifyPostText(postText || 'Job details will fill this LinkedIn post as you complete the form.')}
        </div>
      </div>

      {imageUrl ? (
        <div className="border-t border-slate-100 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="LinkedIn post attachment"
            className="max-h-72 w-full object-cover"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-4 border-t border-slate-200 px-1 py-1 text-slate-500">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageCircle, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map((action) => (
          <div
            key={action.label}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold"
          >
            <action.icon size={15} strokeWidth={2} />
            {action.label}
          </div>
        ))}
      </div>
    </div>
  );
}
