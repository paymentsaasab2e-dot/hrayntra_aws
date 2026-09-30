import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../lib/sessionTransferEmailProxy';
import { convertWordResumeToPdf } from '../../../../lib/convertWordResumeToPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function isWordDocumentResponse(bytes: Buffer, contentType: string, disposition: string): boolean {
  const type = contentType.toLowerCase();
  const name = disposition.toLowerCase();
  if (type.includes('wordprocessingml') || type.includes('msword')) return true;
  if (/\.docx\b/.test(name) || /\.doc\b/.test(name)) return true;
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('utf8') === '%PDF-') return false;
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04 &&
    (type.includes('octet-stream') || type.includes('zip'))
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const matchId = req.nextUrl.searchParams.get('matchId') || '';
  const source = req.nextUrl.searchParams.get('source') || '';
  const params = new URLSearchParams();
  if (matchId) params.set('matchId', matchId);
  if (source) params.set('source', source);
  const query = params.toString() ? `?${params.toString()}` : '';
  const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}/resume${query}`;

  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/pdf,*/*' },
    });

    // Buffer instead of streaming — empty/aborted upstream bodies can crash Next on some hosts.
    const bytes = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    const disposition =
      upstream.headers.get('content-disposition') || 'inline; filename="Resume.pdf"';

    if (upstream.ok && isWordDocumentResponse(bytes, contentType, disposition)) {
      const pdf = await convertWordResumeToPdf(new Uint8Array(bytes));
      const pdfName = disposition.replace(/\.docx?/gi, '.pdf');
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': /\.pdf/i.test(pdfName) ? pdfName : 'inline; filename="Resume.pdf"',
          'Cache-Control': 'private, max-age=120',
          'Content-Length': String(pdf.byteLength),
        },
      });
    }

    return new NextResponse(bytes, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=120',
        'Content-Length': String(bytes.length),
      },
    });
  } catch (error) {
    console.error('[client-review/resume] upstream failed', {
      target,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to load resume from the API. Check BACKEND_INTERNAL_URL on the frontend host.',
      },
      { status: 502 },
    );
  }
}
