import { NextRequest, NextResponse } from 'next/server';
import { backendApiBase } from '../../../lib/sessionTransferEmailProxy';
import { applyWordTextEdits, type WordTextReplacement } from '../../../lib/convertWordResumeToPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Writes HRYantra CV text edits into the real Word file with Microsoft Word.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  const rawDocx = contentType.includes('wordprocessingml');
  let url = '';
  let format = '';
  let docxBase64 = '';
  let replacements: WordTextReplacement[] = [];
  let rawBytes: Uint8Array | null = null;

  if (rawDocx) {
    try {
      replacements = JSON.parse(req.nextUrl.searchParams.get('replacements') || '[]') as WordTextReplacement[];
    } catch {
      return new NextResponse('Invalid request', { status: 400 });
    }
    rawBytes = new Uint8Array(await req.arrayBuffer());
  } else {
    let body: {
      url?: string;
      format?: string;
      docxBase64?: string;
      replacements?: WordTextReplacement[];
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return new NextResponse('Invalid request', { status: 400 });
    }
    url = String(body.url || '').trim();
    format = String(body.format || '').toLowerCase();
    docxBase64 = String(body.docxBase64 || '').trim();
    replacements = Array.isArray(body.replacements) ? body.replacements : [];
  }
  if ((!url && !docxBase64 && !rawBytes) || !replacements.length) {
    return new NextResponse('Missing Word edits', { status: 400 });
  }

  try {
    let docxBytes: Uint8Array;
    if (rawBytes) {
      docxBytes = rawBytes;
    } else if (docxBase64) {
      docxBytes = new Uint8Array(Buffer.from(docxBase64, 'base64'));
    } else {
      const params = new URLSearchParams({ url });
      if (format === 'doc' || format === 'docx') params.set('format', format);
      else if (/\.docx($|[?#])/i.test(url)) params.set('format', 'docx');
      else if (/\.doc($|[?#])/i.test(url)) params.set('format', 'doc');
      const target = `${backendApiBase(req)}/resume-preview/bytes?${params.toString()}`;
      const upstream = await fetch(target, {
        cache: 'no-store',
        headers: { Accept: 'application/octet-stream,*/*' },
      });
      if (!upstream.ok) {
        const message = await upstream.text().catch(() => 'Failed to load document');
        return new NextResponse(message, { status: upstream.status });
      }
      docxBytes = new Uint8Array(await upstream.arrayBuffer());
    }
    if (docxBytes.byteLength < 1000) {
      return new NextResponse('Word document was empty', { status: 400 });
    }
    const edited = await applyWordTextEdits(docxBytes, replacements);
    if (!edited.applied) {
      return NextResponse.json(
        { error: 'Those words were not found in the Word document.', missed: edited.missed },
        { status: 422 }
      );
    }
    return new NextResponse(Buffer.from(edited.docx), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="resume.docx"',
        'X-Word-Edits-Applied': String(edited.applied),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/resume-word-edit] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Could not update the Word document', { status: 502 });
  }
}
