import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_BASE = 'http://x5yt9k0kzhb6gg0yeqt12v1q.187.124.169.162.sslip.io/api/v1';
const backendBase = (process.env.BACKEND_INTERNAL_URL || DEFAULT_BACKEND_BASE).replace(/\/$/, '');

const buildTargetUrl = (req: NextRequest, pathParts: string[]) => {
  const pathname = pathParts.join('/');
  const query = req.nextUrl.search || '';
  return `${backendBase}/${pathname}${query}`;
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

    const response = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? req.body : undefined,
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    } as RequestInit & { duplex?: 'half' });

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
