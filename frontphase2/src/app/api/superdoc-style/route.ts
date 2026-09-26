import { NextResponse } from 'next/server';
import { readSuperdocStyle } from '../../../lib/superdocServerAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalCache = globalThis as typeof globalThis & {
  __hryantraSuperDocStyleV5?: string;
};

/**
 * SuperDoc's stylesheet uses `::highlight()`, which Turbopack cannot parse.
 * Serve the copy written to public/superdoc, with a node_modules fallback.
 */
export async function GET() {
  try {
    if (!globalCache.__hryantraSuperDocStyleV5) {
      const css = await readSuperdocStyle();
      if (!css) return new NextResponse('Styles unavailable', { status: 404 });
      globalCache.__hryantraSuperDocStyleV5 = css.toString('utf8');
    }
    return new NextResponse(globalCache.__hryantraSuperDocStyleV5, {
      status: 200,
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[superdoc-style]', error);
    return new NextResponse('Styles unavailable', { status: 404 });
  }
}
