import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Allow slow upstream responses when requests still route through this proxy. */
export const maxDuration = 300;

const DEFAULT_BACKEND_BASE = 'https://api2.hryantra.com/api/v1';
const backendBase = (process.env.BACKEND_INTERNAL_URL || DEFAULT_BACKEND_BASE).replace(/\/$/, '');
const NEW_API_ROOT_PATHS = new Set(['team', 'roles', 'permissions', 'departments']);

const buildTargetUrl = (req: NextRequest, pathParts: string[]) => {
  const pathname = pathParts.join('/');
  const query = req.nextUrl.search || '';
  const rootPath = pathParts[0] || '';
  const normalizedBase = NEW_API_ROOT_PATHS.has(rootPath) ? backendBase.replace(/\/api\/v1$/, '/api') : backendBase;
  return `${normalizedBase}/${pathname}${query}`;
};

/** HTTP header values / statusText must be ByteString (code points ≤ 255). */
function toByteString(value: string, fallback = ''): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 255) out += value[i];
  }
  return out || fallback;
}

function sanitizeOutgoingHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    const safeKey = toByteString(key);
    const safeValue = toByteString(value);
    if (!safeKey) return;
    try {
      headers.append(safeKey, safeValue);
    } catch {
      // Skip any header Node/undici still rejects.
    }
  });
  headers.delete('host');
  headers.delete('origin');
  headers.delete('accept-encoding');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  headers.delete('connection');
  return headers;
}

async function proxyRequest(req: NextRequest, pathParts: string[]) {
  try {
    const targetUrl = buildTargetUrl(req, pathParts);

    const headers = sanitizeOutgoingHeaders(req.headers);

    const method = req.method.toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);

    // Buffer the body instead of streaming req.body — duplex streaming often fails on Vercel
    // for JSON POSTs (e.g. /auth/login) and surfaces as a misleading 502 to the client.
    let body: ArrayBuffer | undefined;
    if (hasBody) {
      const raw = await req.arrayBuffer();
      body = raw.byteLength > 0 ? raw : undefined;
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const respHeaders = sanitizeOutgoingHeaders(response.headers);

    // Buffer upstream body so we never hand a locked/disturbed ReadableStream to NextResponse.
    const responseBody = await response.arrayBuffer();

    if (response.status >= 500 && responseBody.byteLength === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Backend returned ${response.status} with no response body. The API server may be down.`,
        },
        { status: response.status, headers: respHeaders }
      );
    }

    return new NextResponse(responseBody, {
      status: response.status,
      // Never forward emoji / non-Latin-1 statusText (throws ByteString TypeError).
      statusText: toByteString(response.statusText || '', 'OK'),
      headers: respHeaders,
    });
  } catch (error) {
    console.error('[api/proxy] Upstream request failed', {
      backendBase,
      method: req.method,
      path: pathParts.join('/'),
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: 'Backend is unreachable from Vercel proxy. Check BACKEND_INTERNAL_URL and backend CORS/network.',
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyRequest(req, path || []);
}
