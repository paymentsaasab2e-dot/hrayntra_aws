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

async function proxyRequest(req: NextRequest, pathParts: string[]) {
  try {
    const targetUrl = buildTargetUrl(req, pathParts);

    const headers = new Headers(req.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('accept-encoding');

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

    const respHeaders = new Headers(response.headers);
    respHeaders.delete('content-length');
    respHeaders.delete('content-encoding');
    respHeaders.delete('transfer-encoding');
    respHeaders.delete('connection');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
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
