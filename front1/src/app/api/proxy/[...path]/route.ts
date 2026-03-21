import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND_BASE = 'http://bdmsvisfyzyyr2qdfzvdy9om.187.124.169.162.sslip.io/api';

const backendBase = (process.env.BACKEND_INTERNAL_URL || DEFAULT_BACKEND_BASE).replace(/\/$/, '');

const buildTargetUrl = (req: NextRequest, pathParts: string[]) => {
  const pathname = pathParts.join('/');
  const query = req.nextUrl.search || '';
  return `${backendBase}/${pathname}${query}`;
};

async function proxyRequest(req: NextRequest, pathParts: string[]) {
  const targetUrl = buildTargetUrl(req, pathParts);

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  // Let upstream return uncompressed payload to avoid decode mismatches.
  headers.delete('accept-encoding');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? req.body : undefined,
    // Needed for streaming body in Node runtime
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  } as RequestInit & { duplex?: 'half' });

  const respHeaders = new Headers(response.headers);
  // Avoid passing compression/length headers that can mismatch proxied body.
  respHeaders.delete('content-length');
  respHeaders.delete('content-encoding');
  respHeaders.delete('transfer-encoding');
  respHeaders.delete('connection');

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  });
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

