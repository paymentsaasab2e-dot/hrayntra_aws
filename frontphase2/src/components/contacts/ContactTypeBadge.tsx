'use client';

import React from 'react';

interface ContactTypeBadgeProps {
  type: string;
}

export function ContactTypeBadge({ type }: ContactTypeBadgeProps) {
  const badgeStyles: Record<string, { bg: string; text: string }> = {
    HR: { bg: 'bg-blue-100', text: 'text-blue-700' },
    HIRING_MANAGER: { bg: 'bg-purple-100', text: 'text-purple-700' },
    INTERVIEWER: { bg: 'bg-orange-100', text: 'text-orange-700' },
    CANDIDATE: { bg: 'bg-green-100', text: 'text-green-700' },
    VENDOR: { bg: 'bg-gray-100', text: 'text-gray-700' },
    CLIENT: { bg: 'bg-blue-100', text: 'text-blue-700' },
    DECISION_MAKER: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    FINANCE: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  };

  const style = badgeStyles[type] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}
