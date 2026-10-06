'use client';

import React from 'react';
import { CandidateClientRepliesTab } from '../CandidateClientRepliesTab';

export function CandidateClientTab(props: any) {
  const {
    clientReplies,
    clientSubmissions,
    latestClientReview,
    uploadsBase,
  } = props;

  return (
<CandidateClientRepliesTab
                    replies={clientReplies}
                    submissions={clientSubmissions}
                    fallbackClientName={latestClientReview?.clientName || null}
                    uploadsBase={uploadsBase}
                  />
  );
}
