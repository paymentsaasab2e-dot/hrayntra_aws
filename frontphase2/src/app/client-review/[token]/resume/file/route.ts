import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../../../lib/sessionTransferEmailProxy';
import { convertWordResumeToPdf } from '../../../../../lib/convertWordResumeToPdf';
import {
  stampPdfBufferWithExportWatermark,
  type ServerExportWatermark,
} from '../../../../../lib/stampPdfExportWatermark.server';
import { buildOfficeOnlineResumeShellHtml } from '../../../../../lib/officeOnlineResumeShellHtml';

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

function publicRequestOrigin(req: NextRequest): string {
  const forwarded =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    req.nextUrl.protocol.replace(/:$/, '') ||
    'https';
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    req.nextUrl.host;
  return `${forwarded}://${host}`.replace(/\/$/, '');
}

function watermarkHasVisibleContent(watermark: ServerExportWatermark | null): boolean {
  if (!watermark?.enabled) return false;
  const text = String(watermark.text || '').trim();
  const dataUrl = String(watermark.imageDataUrl || '').trim();
  const imageUrl = String(watermark.imageUrl || '').trim();
  return Boolean(text || dataUrl.startsWith('data:image/') || imageUrl);
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
 * - Default: original DOCX/PDF bytes (Office Online fetches DOCX).
 * - `?view=office`: HTML shell with Office Online + tenant watermark overlay.
 * - `?as=pdf` / `?download=1`: LibreOffice/Word → PDF, then stamp watermark.
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
  const viewOffice =
    String(req.nextUrl.searchParams.get('view') || '')
      .trim()
      .toLowerCase() === 'office';
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

  // Always convert Word→PDF for preview/download, then stamp one watermark per page
  // onto the PDF so the mark stays on the document (not a floating overlay over the viewer).
  const wantPdf = asPdf || forceDownload;
  const stampIntoPdf = true;

  const params = new URLSearchParams();
  if (matchId) params.set('matchId', matchId);
  if (source) params.set('source', source);
  // Clean upstream bytes — we stamp once here (logo OR text, one per page).
  params.set('preview', '1');
  const query = params.toString() ? `?${params.toString()}` : '';
  const target = `${backendApiBase(req)}/interviews/public/review/${encodeURIComponent(token)}/resume${query}`;

  const withDisposition = (filename: string, inline: boolean) =>
    `${inline && !forceDownload ? 'inline' : 'attachment'}; filename="${filename}"`;

  // Word Online shell on public hosts. Localhost uses as=pdf (stamped) instead.
  if (viewOffice && !wantPdf) {
    const watermark = await fetchPublicReviewWatermark(req, token);
    const origin = publicRequestOrigin(req);
    const docxQs = new URLSearchParams();
    if (matchId) docxQs.set('matchId', matchId);
    if (source) docxQs.set('source', source);
    if (formatHint) docxQs.set('format', formatHint);
    docxQs.set('preview', '1');
    const docxPublicUrl = `${origin}/client-review/${encodeURIComponent(token)}/resume/file${
      docxQs.toString() ? `?${docxQs.toString()}` : ''
    }`;
    const pdfQs = new URLSearchParams(docxQs);
    pdfQs.set('as', 'pdf');
    const fallbackPreviewUrl = `${origin}/client-review/${encodeURIComponent(token)}/resume/file?${pdfQs.toString()}`;
    const html = buildOfficeOnlineResumeShellHtml({
      docxPublicUrl,
      title: 'Candidate resume',
      watermark: watermarkHasVisibleContent(watermark)
        ? {
            enabled: true,
            text: watermark?.text,
            imageDataUrl: watermark?.imageDataUrl,
            imageUrl: watermark?.imageUrl,
            opacity: watermark?.opacity,
          }
        : null,
      fallbackPreviewUrl,
    });
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

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

    // Raw Word bytes for Office Online (no download / no PDF conversion).
    if (wasWord && !isPdfBuffer(bytes) && !wantPdf) {
      contentType = wordContentType(disposition, formatHint);
      const ext = formatHint === 'doc' ? 'doc' : 'docx';
      disposition = withDisposition(`Resume.${ext}`, true);
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
          'Cache-Control': forceDownload ? 'private, max-age=120' : 'no-store',
          'Content-Length': String(bytes.length),
        },
      });
    }

    if (wasWord && !isPdfBuffer(bytes) && wantPdf) {
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
      if (stampIntoPdf) {
        const watermark = await fetchPublicReviewWatermark(req, token);
        if (watermarkHasVisibleContent(watermark)) {
          bytes = Buffer.from(await stampPdfBufferWithExportWatermark(bytes, watermark));
        }
      }
      contentType = 'application/pdf';
      disposition = withDisposition('Resume.pdf', true);
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': forceDownload ? 'private, max-age=120' : 'no-store',
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
