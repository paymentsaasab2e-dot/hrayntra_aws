import { useEffect, useState } from 'react';
import type { Interview } from '../types/interview.types';
import { DRAWER_QUERY, readDrawerQuery, useBindDrawerQuery } from '../lib/drawerUrlState';

export function useInterviewDrawer() {
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const [selectedInterviewSnapshot, setSelectedInterviewSnapshot] = useState<Interview | null>(null);
  useBindDrawerQuery(Boolean(selectedInterviewId), {
    [DRAWER_QUERY.interviewId]: selectedInterviewId,
  });
  useEffect(() => {
    const id = readDrawerQuery(DRAWER_QUERY.interviewId);
    if (id) setSelectedInterviewId(id);
  }, []);

  return {
    selectedInterviewId,
    selectedInterviewSnapshot,
    isOpen: Boolean(selectedInterviewId),
    openDrawer: (interviewOrId: string | Interview) => {
      if (typeof interviewOrId === 'string') {
        setSelectedInterviewId(interviewOrId);
        setSelectedInterviewSnapshot((current) =>
          current?.id === interviewOrId ? current : null,
        );
        return;
      }
      setSelectedInterviewId(interviewOrId.id);
      setSelectedInterviewSnapshot(interviewOrId);
    },
    closeDrawer: () => {
      setSelectedInterviewId(null);
      setSelectedInterviewSnapshot(null);
    },
  };
}
