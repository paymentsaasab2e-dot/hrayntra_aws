import { createRequire } from 'node:module';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalCache = globalThis as typeof globalThis & {
  __hryantraSuperDocStyleV3?: string;
};

/**
 * SuperDoc's stylesheet uses `::highlight()`, which Turbopack cannot parse.
 * The file also `@import`s the engine stylesheet by package name. A browser
 * resolves that against `/api/` and gets a 404, so the document never opens.
 * Inline the engine CSS and serve the result as a normal stylesheet.
 */
async function loadStyle(): Promise<string | null> {
  if (globalCache.__hryantraSuperDocStyleV3) return globalCache.__hryantraSuperDocStyleV3;
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const entry = await realpath(require.resolve('superdoc'));
  const distDir = path.dirname(entry);
  const shell = await readFile(path.join(distDir, 'style.css'), 'utf8');
  const engine = await readFile(
    path.join(distDir, '..', '..', '@superdoc', 'docx-engine', 'dist', 'style.css'),
    'utf8',
  );
  const css = shell.replace(
    /@import\s+["']@superdoc\/docx-engine\/style\.css["']\s*;/,
    engine,
  );
  globalCache.__hryantraSuperDocStyleV3 = css;
  return css;
}

export async function GET() {
  try {
    const css = await loadStyle();
    if (!css) return new NextResponse('Styles unavailable', { status: 404 });
    return new NextResponse(css, {
      status: 200,
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Styles unavailable', { status: 404 });
  }
}
