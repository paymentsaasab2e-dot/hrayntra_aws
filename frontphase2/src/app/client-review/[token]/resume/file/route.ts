import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../../lib/sessionTransferEmailProxy';
import { convertWordResumeToPdf } from '../../../../../lib/convertWordResumeToPdf';
import {
  stampPdfBufferWithExportWatermark,
  type ServerExportWatermark,
} from '../../../../../lib/stampPdfExportWatermark.server';

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
      '[client-review/resume/file] watermark fetch failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Binary proxy for the React resume page (ResumeWordFileViewer / PDF iframe).
 * Default: original DOCX/PDF bytes. Optional `?as=pdf` runs LibreOffice/Word conversion.
 */
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
  const asPdf =
    String(req.nextUrl.searchParams.get('as') || '')
      .trim()
      .toLowerCase() === 'pdf' ||
    String(req.nextUrl.searchParams.get('renderer') || '')
      .trim()
      .toLowerCase() === 'libreoffice';
  const forceDownload =
    String(req.nextUrl.searchParams.get('download') || '')
      .trim()
      .toLowerCase() === '1' ||
    String(req.nextUrl.searchParams.get('download') || '')
      .trim()
      .toLowerCase() === 'true';

  const params = new URLSearchParams();
  if (matchId) params.set('matchId', matchId);
  if (source) params.set('source', source);
  const query = params.toString() ? `?${params.toString()}` : '';
  const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}/resume${query}`;

  const withDisposition = (filename: string, inline: boolean) =>
    `${inline && !forceDownload ? 'inline' : 'attachment'}; filename="${filename}"`;

  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
    });

    let bytes: Buffer = Buffer.from(await upstream.arrayBuffer());
    let contentType = upstream.headers.get('content-type') || 'application/pdf';
    let disposition =
      upstream.headers.get('content-disposition') || 'inline; filename="Resume.pdf"';

    if (!upstream.ok) {
      const detail = bytes.toString('utf8').slice(0, 240).trim();
      console.error('[client-review/resume/file] upstream HTTP error', {
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

    if (wasWord && !isPdfBuffer(bytes) && !asPdf) {
      contentType = wordContentType(disposition, formatHint);
      const ext = formatHint === 'doc' ? 'doc' : 'docx';
      disposition = withDisposition(`Resume.${ext}`, true);
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

    if (wasWord && !isPdfBuffer(bytes) && asPdf) {
      try {
        const pdf = await convertWordResumeToPdf(new Uint8Array(bytes));
        bytes = Buffer.from(pdf);
        contentType = 'application/pdf';
        disposition = withDisposition('Resume.pdf', true);
      } catch (conversionError) {
        console.warn(
          '[client-review/resume/file] Word/LibreOffice→PDF failed:',
          conversionError instanceof Error ? conversionError.message : String(conversionError),
        );
        return NextResponse.json(
          { success: false, message: 'Unable to convert Word resume to PDF on this host.' },
          { status: 502 },
        );
      }
    }

    if (isPdfBuffer(bytes)) {
      const watermark = await fetchPublicReviewWatermark(req, token);
      if (watermark?.enabled) {
        bytes = Buffer.from(await stampPdfBufferWithExportWatermark(bytes, watermark));
      }
      contentType = 'application/pdf';
      disposition = withDisposition('Resume.pdf', true);
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
    console.error('[client-review/resume/file] upstream failed', {
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
