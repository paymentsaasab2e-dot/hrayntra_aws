import { NextRequest, NextResponse } from 'next/server';
import { readSuperdocWorker } from '../../../lib/superdocServerAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalCache = globalThis as typeof globalThis & {
  __hryantraSuperDocWorkersV5?: Map<string, Uint8Array>;
};
const workerBytes = (globalCache.__hryantraSuperDocWorkersV5 ??= new Map<string, Uint8Array>());

/**
 * SuperDoc opens a DOCX in a module worker. Prefer the static copy in
 * public/superdoc so production still has the file when node_modules is not
 * traced into the standalone server.
 */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') === 'review' ? 'review' : 'document';
  try {
    const cached = workerBytes.get(kind);
    const body = cached ?? (await readSuperdocWorker(kind));
    if (!body) return new NextResponse('Worker unavailable', { status: 404 });
    if (!cached) workerBytes.set(kind, new Uint8Array(body));
    const bytes = workerBytes.get(kind)!;
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[superdoc-worker]', error);
    return new NextResponse('Worker unavailable', { status: 404 });
  }
}
