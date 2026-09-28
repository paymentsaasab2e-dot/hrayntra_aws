import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../lib/sessionTransferEmailProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const matchId = req.nextUrl.searchParams.get('matchId') || '';
  const source = req.nextUrl.searchParams.get('source') || '';
  const params = new URLSearchParams();
  if (matchId) params.set('matchId', matchId);
  if (source) params.set('source', source);
  const query = params.toString() ? `?${params.toString()}` : '';
  const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}/resume${query}`;

  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/pdf,*/*' },
    });

    // Buffer instead of streaming — empty/aborted upstream bodies can crash Next on some hosts.
    const bytes = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(bytes, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
        'Content-Disposition':
          upstream.headers.get('content-disposition') || 'inline; filename="Resume.pdf"',
        'Cache-Control': 'private, max-age=120',
        'Content-Length': String(bytes.length),
      },
    });
  } catch (error) {
    console.error('[client-review/resume] upstream failed', {
      target,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to load resume from the API. Check BACKEND_INTERNAL_URL on the frontend host.',
      },
      { status: 502 },
    );
  }
}
