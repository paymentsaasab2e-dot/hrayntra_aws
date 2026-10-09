import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../lib/sessionTransferEmailProxy';
import { convertWordResumeToPdf } from '../../../../lib/convertWordResumeToPdf';
import {
  stampPdfBufferWithExportWatermark,
  type ServerExportWatermark,
} from '../../../../lib/stampPdfExportWatermark.server';
import { buildDocxPreviewShellHtml } from '../../../../lib/resumePreviewShellHtml';

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

function wantsRawBytes(req: NextRequest): boolean {
  const raw = String(req.nextUrl.searchParams.get('raw') || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function wordContentType(disposition: string, formatHint: string): string {
  if (formatHint === 'doc' || /\.doc\b/i.test(disposition)) {
    return 'application/msword';
  }
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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

function htmlPreviewResponse(req: NextRequest, title: string): NextResponse {
  const bytesUrl = new URL(req.url);
  bytesUrl.searchParams.set('raw', '1');
  const html = buildDocxPreviewShellHtml({
    docxBytesUrl: `${bytesUrl.pathname}${bytesUrl.search}`,
    title: title || 'Resume',
  });
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const matchId = req.nextUrl.searchParams.get('matchId') || '';
  const source = req.nextUrl.searchParams.get('source') || '';
  const formatHint = String(req.nextUrl.searchParams.get('format') || '')
    .trim()
    .toLowerCase();
  const params = new URLSearchParams();
  if (matchId) params.set('matchId', matchId);
  if (source) params.set('source', source);
  const query = params.toString() ? `?${params.toString()}` : '';
  const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}/resume${query}`;
  const rawMode = wantsRawBytes(req);

  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
    });

    // Buffer instead of streaming — empty/aborted upstream bodies can crash Next on some hosts.
    let bytes: Buffer = Buffer.from(await upstream.arrayBuffer());
    let contentType = upstream.headers.get('content-type') || 'application/pdf';
    let disposition =
      upstream.headers.get('content-disposition') || 'inline; filename="Resume.pdf"';

    if (!upstream.ok) {
      const detail = bytes.toString('utf8').slice(0, 240).trim();
      console.error('[client-review/resume] upstream HTTP error', {
        target,
        status: upstream.status,
        detail,
      });
      return NextResponse.json(
        {
          success: false,
          message: detail || `Unable to load resume (API ${upstream.status}).`,
        },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const wasWord =
      isWordDocumentResponse(bytes, contentType, disposition) ||
      formatHint === 'docx' ||
      formatHint === 'doc';

    // Raw bytes for docx-preview / Office Online — never run Word→PDF here.
    if (rawMode) {
      if (wasWord && !isPdfBuffer(bytes)) {
        contentType = wordContentType(disposition, formatHint);
        if (!/\.docx?\b/i.test(disposition)) {
          disposition = `inline; filename="Resume.${formatHint === 'doc' ? 'doc' : 'docx'}"`;
        }
      }
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
          'Cache-Control': 'private, max-age=120',
          'Content-Length': String(bytes.length),
        },
      });
    }

    if (wasWord && !isPdfBuffer(bytes)) {
      // Prefer real PDF (browser PDF viewer, same as local Word export). Fall back to HTML only
      // when neither Microsoft Word nor LibreOffice can convert on this host.
      try {
        const pdf = await convertWordResumeToPdf(new Uint8Array(bytes));
        bytes = Buffer.from(pdf);
        contentType = 'application/pdf';
        const pdfName = disposition.replace(/\.docx?/gi, '.pdf');
        disposition = /\.pdf/i.test(pdfName) ? pdfName : 'inline; filename="Resume.pdf"';
      } catch (conversionError) {
        console.warn(
          '[client-review/resume] Word/LibreOffice→PDF unavailable, falling back to HTML preview:',
          conversionError instanceof Error ? conversionError.message : String(conversionError),
        );
        return htmlPreviewResponse(req, 'Candidate resume');
      }
    }

    // DOCX/DOC cannot be stamped upstream — stamp after Word→PDF conversion.
    const needsClientStamp =
      isPdfBuffer(bytes) && (wasWord || formatHint === 'docx' || formatHint === 'doc');

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
      status: 200,
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
        message:
          'Unable to load resume from the API. Check BACKEND_INTERNAL_URL / NEXT_PUBLIC_API_URL on the frontend host.',
      },
      { status: 502 },
    );
  }
}
