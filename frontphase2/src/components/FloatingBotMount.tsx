'use client';

import dynamic from 'next/dynamic';

function FloatingMountUnavailable() {
  return null;
}

/** ARIA — existing AI System Operator (OpenAI-backed). */
const FloatingBotButton = dynamic(
  () =>
    import('./FloatingBotButton')
      .then((mod) => mod.FloatingBotButton)
      .catch(() => FloatingMountUnavailable),
  {
    ssr: false,
    loading: () => null,
  },
);

/** HRYANTRA Enterprise Brain — Phase 2 orchestration over tenant CRM (local fallback). */
const HrYantraAiFloatingButton = dynamic(
  () =>
    import('./HrYantraAiFloatingButton')
      .then((mod) => mod.HrYantraAiFloatingButton)
      .catch(() => FloatingMountUnavailable),
  {
    ssr: false,
    loading: () => null,
  },
);

export function FloatingBotMount() {
  return (
    <>
      <FloatingBotButton />
      <HrYantraAiFloatingButton />
    </>
  );
}
