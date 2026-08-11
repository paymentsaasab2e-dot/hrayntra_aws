'use client';

import React from 'react';
import { DM_Sans } from 'next/font/google';
import {
  AUTH_PANEL_BG,
  BRAND_BLUE,
  BRAND_BLUE_DEEP,
  BRAND_ORANGE,
  authPageBackgroundStyle,
} from './authMarketingTheme';
import { AuthBrandLogo } from './AuthBrandLogo';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

type AuthMarketingShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  /** Taller card for multi-step forms */
  tall?: boolean;
};

export function AuthMarketingShell({
  title,
  subtitle,
  children,
  footer,
  loading = false,
  loadingMessage,
  tall = false,
}: AuthMarketingShellProps) {
  const cardHeight = tall
    ? 'lg:h-[min(580px,calc(100dvh-2rem))] max-h-[min(620px,calc(100dvh-1.5rem))]'
    : 'lg:h-[min(520px,calc(100dvh-2rem))] max-h-[min(560px,calc(100dvh-1.5rem))]';

  return (
    <div
      className={`${dmSans.className} relative flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden px-3 py-3 sm:px-5 sm:py-4`}
      style={authPageBackgroundStyle}
    >
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-400" />
            <h2 className="text-base font-semibold text-slate-900">Please wait</h2>
            <p className="mt-2 text-sm text-slate-600">{loadingMessage || 'Processing your request...'}</p>
          </div>
        </div>
      )}

      <div
        className={`relative z-10 grid h-auto w-full max-w-[880px] overflow-hidden rounded-[1.5rem] border border-slate-200/80 shadow-[0_28px_70px_-28px_rgba(8,66,140,0.28)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] ${cardHeight}`}
        style={{ backgroundColor: AUTH_PANEL_BG }}
      >
        <div
          className="relative flex min-h-0 flex-col justify-between px-6 py-5 sm:px-8 sm:py-6 lg:px-9 lg:py-7"
          style={{ backgroundColor: AUTH_PANEL_BG }}
        >
          <div className="inline-flex w-fit items-center rounded-full border border-black/5 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
            <AuthBrandLogo />
          </div>

          <div className="mt-5 shrink-0">
            <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-[#1c1c1c] sm:text-[1.85rem]">
              {title}
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div>

          {footer ? (
            <div className="mt-5 shrink-0 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
              {footer}
            </div>
          ) : null}
        </div>

        <AuthMarketingVisual />
      </div>
    </div>
  );
}

function AuthMarketingVisual() {
  return (
    <div className="relative hidden overflow-hidden lg:block">
      <img
        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
        alt="Team collaborating in the workplace"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

      <div
        className="absolute left-4 top-5 max-w-[190px] rounded-xl px-3 py-2.5 shadow-lg ring-1 ring-orange-200/60"
        style={{ backgroundColor: '#FFFFFF', borderLeft: `3px solid ${BRAND_ORANGE}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold leading-snug text-[#1c1c1c]">Pipeline review with hiring team</p>
          <span
            className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            ↗
          </span>
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-[#1c1c1c]/70">04:00pm — 05:00pm</p>
      </div>

      <div
        className="absolute left-1/2 top-[42%] w-[82%] -translate-x-1/2 rounded-xl border border-white/70 px-2 py-2 shadow-xl backdrop-blur-md"
        style={{ backgroundColor: 'rgba(255,255,255,0.82)' }}
      >
        <div className="grid grid-cols-7 gap-0.5 text-center text-[#1c1c1c]">
          {[
            ['Sun', '22'],
            ['Mon', '23'],
            ['Tue', '24'],
            ['Wed', '25'],
            ['Thu', '26'],
            ['Fri', '27'],
            ['Sat', '28'],
          ].map(([day, date], idx) => (
            <div
              key={day}
              className={`rounded-lg px-0.5 py-1.5 ${idx === 3 ? 'text-white shadow-sm' : ''}`}
              style={idx === 3 ? { backgroundColor: BRAND_BLUE_DEEP } : undefined}
            >
              <div className="text-[9px] font-medium opacity-70">{day}</div>
              <div className="mt-0.5 text-[12px] font-semibold">{date}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-6 left-4 max-w-[210px] rounded-xl bg-white px-3 py-2.5 shadow-xl ring-1 ring-blue-100/80"
        style={{ borderLeft: `3px solid ${BRAND_BLUE}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-900">Daily standup</p>
            <div className="mt-1.5 flex -space-x-1.5">
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <span
                  key={letter}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                  style={{
                    backgroundColor: ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6'][i],
                    zIndex: 4 - i,
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] font-medium text-slate-500">12:00–01:00</p>
        </div>
      </div>

      <div className="absolute right-7 top-[26%] flex flex-col gap-2.5">
        <span className="h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
        <span className="ml-5 h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
      </div>
    </div>
  );
}
