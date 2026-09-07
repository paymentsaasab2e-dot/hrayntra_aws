import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_BASE = 'http://127.0.0.1:5001/api/v1';

function backendApiBase(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND_BASE
  ).replace(/\/+$/, '');
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string; fileId: string }> },
) {
  const { token, fileId } = await context.params;
  const matchId = req.nextUrl.searchParams.get('matchId') || '';
  const query = matchId ? `?matchId=${encodeURIComponent(matchId)}` : '';
  const target = `${backendApiBase()}/interviews/public/review/${encodeURIComponent(token)}/files/${encodeURIComponent(fileId)}${query}`;

  const upstream = await fetch(target, {
    cache: 'no-store',
    headers: { Accept: 'application/pdf,*/*' },
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
      'Content-Disposition':
        upstream.headers.get('content-disposition') || 'inline; filename="Document.pdf"',
      'Cache-Control': 'private, max-age=120',
    },
  });
}
