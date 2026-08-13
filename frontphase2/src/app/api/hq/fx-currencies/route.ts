import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedList: { code: string; name: string }[] | null = null;
let cachedAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

export async function GET() {
  if (cachedList && Date.now() - cachedAt < CACHE_TTL) {
    return NextResponse.json({ currencies: cachedList });
  }

  try {
    const res = await fetch('https://api.frankfurter.app/currencies', { cache: 'no-store' });
    if (!res.ok) throw new Error('Frankfurter unavailable');
    const data = (await res.json()) as Record<string, string>;
    const list = Object.entries(data)
      .map(([code, name]) => ({ code, name: String(name) }))
      .sort((a, b) => a.code.localeCompare(b.code));
    cachedList = list;
    cachedAt = Date.now();
    return NextResponse.json({ currencies: list });
  } catch {
    return NextResponse.json({ currencies: [] }, { status: 502 });
  }
}
