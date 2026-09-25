import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dev trace for the DOCX tab. Shows up in the frontphase2 terminal. */
export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const step = body && typeof body === 'object' && 'step' in body ? String((body as { step: unknown }).step) : 'log';
  const ms = body && typeof body === 'object' && 'ms' in body ? (body as { ms: unknown }).ms : '';
  console.log(`[resume-docx] ${step}${ms === '' ? '' : ` ${ms}ms`}`, JSON.stringify(body));
  return new NextResponse(null, { status: 204 });
}
