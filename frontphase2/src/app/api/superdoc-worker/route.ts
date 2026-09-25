import { createRequire } from 'node:module';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WORKER_PREFIX = {
  document: 'browser-worker-entry-',
  review: 'review-index-worker-entry-',
} as const;

const globalCache = globalThis as typeof globalThis & {
  __hryantraSuperDocWorkers?: Map<string, Uint8Array>;
};
const workerBytes = (globalCache.__hryantraSuperDocWorkers ??= new Map<string, Uint8Array>());

/**
 * SuperDoc opens a DOCX in a module worker. Next does not emit that file next to
 * the bundled engine, so `new Worker(new URL('./assets/...'))` fails and the
 * resume shows "Couldn't open document". Serve the real worker from this route.
 * The script is ~9.5MB; keep it in memory so later opens are not a disk read.
 */
async function loadWorker(kind: keyof typeof WORKER_PREFIX): Promise<Uint8Array | null> {
  const cached = workerBytes.get(kind);
  if (cached) return cached;
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const entry = await realpath(require.resolve('superdoc'));
  const assetsDir = path.join(path.dirname(entry), '..', '..', '@superdoc', 'docx-engine', 'dist', 'assets');
  const name = (await readdir(assetsDir)).find(
    (file) => file.startsWith(WORKER_PREFIX[kind]) && file.endsWith('.js')
  );
  if (!name) return null;
  const body = new Uint8Array(await readFile(path.join(assetsDir, name)));
  workerBytes.set(kind, body);
  return body;
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') === 'review' ? 'review' : 'document';
  try {
    const body = await loadWorker(kind);
    if (!body) return new NextResponse('Worker unavailable', { status: 404 });
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Worker unavailable', { status: 404 });
  }
}
