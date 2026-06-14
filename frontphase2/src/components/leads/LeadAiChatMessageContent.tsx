'use client';

import React from 'react';
import { parseLeadAiAssistantReply } from '@/lib/leadAiHelpers';

type Props = {
  content: string;
  role: 'user' | 'assistant';
};

export function LeadAiChatMessageContent({ content, role }: Props) {
  if (role === 'user') {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  const parsed = parseLeadAiAssistantReply(content);

  if (parsed.bullets.length === 0) {
    return <p className="whitespace-pre-wrap leading-relaxed">{parsed.intro || content}</p>;
  }

  return (
    <div className="space-y-2.5 leading-relaxed">
      {parsed.intro ? <p className="text-sm text-slate-800">{parsed.intro}</p> : null}
      <ul className="space-y-1.5 border-l-2 border-indigo-200 pl-3">
        {parsed.bullets.map((item) => (
          <li key={`${item.label}-${item.value}`} className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{item.label}:</span>{' '}
            <span className="text-slate-700">{item.value}</span>
          </li>
        ))}
      </ul>
      {parsed.outro ? (
        <p className="text-sm font-medium text-slate-800">{parsed.outro}</p>
      ) : null}
    </div>
  );
}
