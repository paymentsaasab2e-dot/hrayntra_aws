'use client';

import dynamic from 'next/dynamic';

const FloatingBotButton = dynamic(
  () => import('./FloatingBotButton').then((mod) => mod.FloatingBotButton),
  {
    ssr: false,
    loading: () => null,
  }
);

export function FloatingBotMount() {
  return <FloatingBotButton />;
}
