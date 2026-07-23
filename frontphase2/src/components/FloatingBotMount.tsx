'use client';

import dynamic from 'next/dynamic';

/** ARIA — existing AI System Operator (OpenAI-backed). */
const FloatingBotButton = dynamic(
  () => import('./FloatingBotButton').then((mod) => mod.FloatingBotButton),
  {
    ssr: false,
    loading: () => null,
  },
);

/** HRYantra AI — tenant CRM Q&A without OpenAI / external AI API keys. */
const HrYantraAiFloatingButton = dynamic(
  () => import('./HrYantraAiFloatingButton').then((mod) => mod.HrYantraAiFloatingButton),
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
