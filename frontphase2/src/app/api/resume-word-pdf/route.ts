import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../lib/sessionTransferEmailProxy';
import {
  convertWordResumeToPdf,
  readCachedWordPdfForUrl,
  rememberWordPdfForUrl,
  warmWordExporter,
} from '../../../lib/convertWordResumeToPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Shows a Word resume as Word rendered it: Microsoft Word exports a PDF,
 * and the HRYantra CV popup displays that page.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || '';
  if (!req.nextUrl.searchParams.get('url')) {
    return new NextResponse('Missing url', { status: 400 });
  }

  const sourceUrl = req.nextUrl.searchParams.get('url') || '';
  const target = `${backendApiBase(req)}/resume-preview/bytes${search}`;
  warmWordExporter();

  try {
    const cached = await readCachedWordPdfForUrl(sourceUrl);
    if (cached) {
      return new NextResponse(Buffer.from(cached), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="resume.pdf"',
          'Cache-Control': 'private, max-age=300',
        },
      });
    }
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/octet-stream,*/*' },
    });
    if (!upstream.ok) {
      const message = await upstream.text().catch(() => 'Failed to load document');
      return new NextResponse(message, { status: upstream.status });
    }
    const docxBytes = new Uint8Array(await upstream.arrayBuffer());
    const pdf = await convertWordResumeToPdf(docxBytes);
    await rememberWordPdfForUrl(sourceUrl, pdf);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[api/resume-word-pdf] conversion failed', {
      target,
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Word preview unavailable', { status: 502 });
  }
}

/** Re-render an already edited .docx with Microsoft Word. */
export async function POST(req: NextRequest) {
  try {
    const docxBytes = new Uint8Array(await req.arrayBuffer());
    if (docxBytes.byteLength < 1000) {
      return new NextResponse('Word document was empty', { status: 400 });
    }
    const pdf = await convertWordResumeToPdf(docxBytes);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/resume-word-pdf] conversion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Word preview unavailable', { status: 502 });
  }
}
