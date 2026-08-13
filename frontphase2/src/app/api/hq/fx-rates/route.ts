import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** In-memory cache so repeated HQ requests are instant. */
let memCache: { body: unknown; at: number } | null = null;
const MEM_TTL_MS = 5 * 60 * 1000;

async function fetchFromOpenErApi(signal?: AbortSignal): Promise<{ date: string; rates: Record<string, number> }> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error('open.er-api failed');
  const data = (await res.json()) as {
    result?: string;
    time_last_update_utc?: string;
    rates?: Record<string, number>;
  };
  if (data.result !== 'success' || !data.rates) throw new Error('open.er-api bad payload');
  const date =
    data.time_last_update_utc?.slice(0, 16) ||
    new Date().toISOString().slice(0, 10);
  return { date, rates: { USD: 1, ...data.rates } };
}

async function fetchFromFrankfurter(signal?: AbortSignal): Promise<{ date: string; rates: Record<string, number> }> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD', { signal, cache: 'no-store' });
  if (!res.ok) throw new Error('frankfurter failed');
  const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
  return {
    date: String(data.date || new Date().toISOString().slice(0, 10)),
    rates: { USD: 1, ...(data.rates || {}) },
  };
}

export async function GET() {
  if (memCache && Date.now() - memCache.at < MEM_TTL_MS) {
    return NextResponse.json(memCache.body, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    });
  }

  try {
    // Prefer open.er-api (160+ currencies). Short timeout, then Frankfurter fallback.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    let payload: { date: string; rates: Record<string, number> };
    try {
      payload = await fetchFromOpenErApi(controller.signal);
    } catch {
      clearTimeout(timer);
      payload = await fetchFromFrankfurter();
    }
    clearTimeout(timer);

    const body = {
      base: 'USD',
      date: payload.date,
      fetchedAt: new Date().toISOString(),
      source: 'live',
      rates: payload.rates,
    };
    memCache = { body, at: Date.now() };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    });
  } catch {
    if (memCache) {
      return NextResponse.json(memCache.body, {
        headers: { 'Cache-Control': 'public, max-age=30' },
      });
    }
    return NextResponse.json({ error: 'FX fetch failed' }, { status: 502 });
  }
}
