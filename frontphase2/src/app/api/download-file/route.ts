import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_API_BASE = 'http://localhost:5000/api/v1';

function getBackendOrigin() {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
  return apiBase.replace(/\/api\/v1\/?$/, '');
}

function sanitizeFilename(name: string | null, fallback: string) {
  const value = String(name || '').trim();
  const candidate = value || fallback;
  return candidate.replace(/[\\/:*?"<>|]+/g, '_');
}

function inferFilename(sourceUrl: string, explicitFilename: string | null) {
  if (explicitFilename) return sanitizeFilename(explicitFilename, 'download');
  try {
    const pathname = new URL(sourceUrl).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() || 'download';
    return sanitizeFilename(lastSegment, 'download');
  } catch {
    return sanitizeFilename('download', 'download');
  }
}

function resolveSourceUrl(rawUrl: string, backendOrigin: string) {
  if (!rawUrl) return null;

  try {
    if (/^https?:\/\//i.test(rawUrl)) {
      const parsed = new URL(rawUrl);
      const allowedHost = new URL(backendOrigin).host;
      if (parsed.host !== allowedHost) return null;
      return parsed.toString();
    }

    if (!rawUrl.startsWith('/uploads/')) return null;
    return new URL(rawUrl, backendOrigin).toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const backendOrigin = getBackendOrigin();
  const rawUrl = req.nextUrl.searchParams.get('url') || req.nextUrl.searchParams.get('path') || '';
  const explicitFilename = req.nextUrl.searchParams.get('filename');
  const sourceUrl = resolveSourceUrl(rawUrl, backendOrigin);

  if (!sourceUrl) {
    return NextResponse.json(
      { success: false, message: 'Invalid download URL' },
      { status: 400 }
    );
  }

  const upstream = await fetch(sourceUrl, {
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `Failed to fetch file (${upstream.status})`,
      },
      { status: upstream.status }
    );
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const filename = inferFilename(sourceUrl, explicitFilename);

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
