import { NextRequest, NextResponse } from 'next/server';
import {
  buildDocxPreviewShellHtml,
  inferResumeTitleFromUrl,
} from '../../../lib/resumePreviewShellHtml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves a client-side docx-preview page (Word layout fidelity).
 * Fetches bytes via /api/resume-docx — avoids Mammoth plain-text HTML conversion.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || '';
  const sourceUrl = req.nextUrl.searchParams.get('url');
  if (!sourceUrl) {
    return new NextResponse('Missing url', { status: 400 });
  }

  const docxBytesUrl = `/api/resume-docx${search}`;
  const title = inferResumeTitleFromUrl(sourceUrl);
  const html = buildDocxPreviewShellHtml({ docxBytesUrl, title });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
