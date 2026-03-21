import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use `/api/pdf-proxy` — kept for backwards compatibility.
 */
export async function GET(req: NextRequest) {
  const dest = new URL(req.url);
  dest.pathname = '/api/pdf-proxy';
  return NextResponse.redirect(dest, 307);
}
