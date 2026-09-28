'use client';

import React from 'react';
import { Sparkles, UserRound } from 'lucide-react';

export function AddCandidateIsCenteredPopupBlock(props) {
  const {
    drawerDescription,
    drawerTitle,
    embeddedBulkCv,
    inlineSuccess,
    isBulkResumeBusy,
    isCenteredPopup,
    showAiChatStage,
    showAiFormStage,
  } = props;

  return (
isCenteredPopup ? (
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#2098C8]/35 bg-[#E8F6FC] px-3 py-1 shadow-sm shadow-[#2098C8]/10">
                  <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-[#2098C8]/25">
                    {showAiChatStage ? <Sparkles size={14} className="text-[#2098C8]" /> : <UserRound size={14} className="text-[#2098C8]" />}
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#176F96]">
                    {showAiChatStage ? 'AI candidate creation' : 'Create candidate'}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">
                  {showAiChatStage
                    ? 'Chat with AI'
                    : showAiFormStage
                      ? 'Review candidate'
                      : drawerTitle}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                  {showAiChatStage
                    ? 'Chat, paste notes, or upload a resume, then continue to review the filled form.'
                    : showAiFormStage
                      ? 'Review AI-filled fields, then create the candidate.'
                      : drawerDescription}
                </p>
                {inlineSuccess ? <p className="mt-2 text-xs font-medium text-emerald-600">{inlineSuccess}</p> : null}
              </div>
            ) : (
              <>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                    showAiChatStage || showAiFormStage
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 shadow-indigo-500/25'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25'
                  }`}
                >
                  {showAiChatStage || showAiFormStage ? <Sparkles size={20} /> : <UserRound size={20} />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight text-slate-900">
                    {embeddedBulkCv
                      ? 'Bulk CV upload'
                      : showAiChatStage
                        ? 'Create with AI'
                        : showAiFormStage
                          ? 'Review candidate'
                          : drawerTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {embeddedBulkCv
                      ? 'Same parsing pipeline as Candidates — upload files, ZIP, or folders; token usage appears below.'
                      : showAiChatStage
                        ? 'Chat, paste notes, or upload a resume, then continue to review the filled form.'
                        : showAiFormStage
                          ? 'Review AI-filled fields, then create the candidate.'
                          : drawerDescription}
                  </p>
                  {inlineSuccess ? <p className="mt-1 text-xs font-medium text-emerald-600">{inlineSuccess}</p> : null}
                  {isBulkResumeBusy ? (
                    <p className="mt-1 text-xs font-medium text-blue-600">
                      Parsing in progress — leaving or closing will show a confirmation to stop parsing.
                    </p>
                  ) : null}
                </div>
              </>
            )
  );
}
