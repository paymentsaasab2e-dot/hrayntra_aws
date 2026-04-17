import { useState } from 'react';

export function useInterviewDrawer() {
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);

  return {
    selectedInterviewId,
    isOpen: Boolean(selectedInterviewId),
    openDrawer: (interviewId: string) => setSelectedInterviewId(interviewId),
    closeDrawer: () => setSelectedInterviewId(null),
  };
}
