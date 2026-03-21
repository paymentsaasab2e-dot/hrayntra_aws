'use client';

import React from 'react';
import { Linkedin, Clock } from 'lucide-react';

interface LinkedInPostPreviewProps {
  userName: string;
  userPicture?: string;
  jobTitle: string;
  company: string;
  description?: string;
  applyUrl: string;
  location?: string;
}

export function LinkedInPostPreview({
  userName,
  userPicture,
  jobTitle,
  company,
  description,
  applyUrl,
  location,
}: LinkedInPostPreviewProps) {
  // Generate post text
  const postText = `We're hiring a ${jobTitle} at ${company}!\n\n${description ? description.substring(0, 200) + (description.length > 200 ? '...' : '') : ''}\n\n${location ? `Location: ${location}\n\n` : ''}Apply here: ${applyUrl}\n\n#hiring #jobs #careers`;

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* LinkedIn-style header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {userPicture ? (
            <img
              src={userPicture}
              alt={userName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Linkedin size={20} className="text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{userName}</span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock size={12} />
                Just now
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{jobTitle}</div>
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className="p-4">
        <div className="text-sm text-slate-900 whitespace-pre-line leading-relaxed">
          {postText}
        </div>
      </div>

      {/* LinkedIn-style footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 text-xs text-slate-500">
        <button className="hover:text-blue-600 transition-colors">Like</button>
        <button className="hover:text-blue-600 transition-colors">Comment</button>
        <button className="hover:text-blue-600 transition-colors">Share</button>
        <button className="hover:text-blue-600 transition-colors ml-auto">Send</button>
      </div>
    </div>
  );
}
