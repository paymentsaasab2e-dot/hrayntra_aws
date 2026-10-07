import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../lib/sessionTransferEmailProxy';
import { convertWordResumeToPdf } from '../../../../lib/convertWordResumeToPdf';
import {
  stampPdfBufferWithExportWatermark,
  type ServerExportWatermark,
} from '../../../../lib/stampPdfExportWatermark.server';

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

function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString('utf8').startsWith('%PDF');
}

async function fetchPublicReviewWatermark(
  req: NextRequest,
  token: string,
): Promise<ServerExportWatermark | null> {
  try {
    const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}`;
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!upstream.ok) return null;
    const payload = (await upstream.json()) as {
      data?: { exportWatermark?: ServerExportWatermark };
      exportWatermark?: ServerExportWatermark;
    };
    const watermark = payload?.data?.exportWatermark || payload?.exportWatermark;
    if (!watermark || typeof watermark !== 'object') return null;
    return watermark;
  } catch (error) {
    console.warn(
      '[client-review/resume] watermark fetch failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
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
    let bytes: Buffer = Buffer.from(await upstream.arrayBuffer());
    let contentType = upstream.headers.get('content-type') || 'application/pdf';
    let disposition =
      upstream.headers.get('content-disposition') || 'inline; filename="Resume.pdf"';

    const wasWord =
      upstream.ok && isWordDocumentResponse(bytes, contentType, disposition);

    if (wasWord) {
      const pdf = await convertWordResumeToPdf(new Uint8Array(bytes));
      bytes = Buffer.from(pdf);
      contentType = 'application/pdf';
      const pdfName = disposition.replace(/\.docx?/gi, '.pdf');
      disposition = /\.pdf/i.test(pdfName) ? pdfName : 'inline; filename="Resume.pdf"';
    }

    // DOCX/DOC cannot be stamped upstream — stamp after Word→PDF conversion.
    // Also stamp when query says format=docx (Word source) even if sniffing missed.
    const formatHint = String(req.nextUrl.searchParams.get('format') || '')
      .trim()
      .toLowerCase();
    const needsClientStamp =
      upstream.ok &&
      isPdfBuffer(bytes) &&
      (wasWord || formatHint === 'docx' || formatHint === 'doc');

    if (needsClientStamp) {
      const watermark = await fetchPublicReviewWatermark(req, token);
      if (watermark?.enabled) {
        bytes = Buffer.from(await stampPdfBufferWithExportWatermark(bytes, watermark));
        contentType = 'application/pdf';
        if (!/\.pdf/i.test(disposition)) {
          disposition = 'inline; filename="Resume.pdf"';
        }
      }
    }

    return new NextResponse(new Uint8Array(bytes), {
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
