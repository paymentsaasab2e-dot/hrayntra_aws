const MARKER = 'w:rsidR="00HRYANT"';
const COLUMN_BREAK = '<w:r w:rsidR="00HRYANT"><w:br w:type="column"/></w:r>';

/**
 * SuperDoc line-breaks the first right-hand column using the left column's
 * width, so job titles wrap into a narrow stack and the page no longer matches
 * Word. A column break in front of that paragraph makes SuperDoc measure it
 * at the real column width. The break is marked and removed again on save.
 */
export function widenUnevenColumnsForEditor(xml: string): string {
  if (!xml.includes('w:equalWidth="0"') || xml.includes(MARKER)) return xml;
  const re = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const para = match[0];
    if (!para.includes('<wp:anchor')) continue;
    const offset = para.match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    if (!offset || Number(offset[1]) < 3_000_000) continue;
    const text = para.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (!/[A-Za-z]{4,}/.test(text)) continue;
    const props = para.indexOf('</w:pPr>');
    if (props < 0) continue;
    const at = match.index + props + '</w:pPr>'.length;
    return xml.slice(0, at) + COLUMN_BREAK + xml.slice(at);
  }
  return xml;
}

export function removeEditorColumnBreak(xml: string): string {
  return xml.replace(/<w:r[^>]*w:rsidR="00HRYANT"[^>]*>\s*<w:br[^>]*w:type="column"[^>]*\/>\s*<\/w:r>/g, '');
}

type ZipEntry = {
  name: string;
  method: number;
  data: Uint8Array;
  time: number;
  date: number;
};

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function asBlobPart(data: Uint8Array): BlobPart {
  return new Uint8Array(data) as BlobPart;
}

function findEocd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (readU32(bytes, i) === 0x06054b50) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([asBlobPart(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([asBlobPart(data)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('docx');
  const count = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error('docx');
    const method = readU16(bytes, cursor + 10);
    const time = readU16(bytes, cursor + 12);
    const date = readU16(bytes, cursor + 14);
    const compressedSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const nameLengthLocal = readU16(bytes, localOffset + 26);
    const extraLengthLocal = readU16(bytes, localOffset + 28);
    const dataOffset = localOffset + 30 + nameLengthLocal + extraLengthLocal;
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressed : await inflateRaw(compressed);
    entries.push({ name, method, data, time, date });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const compressed = entry.method === 0 ? entry.data : await deflateRaw(entry.data);
    const local = new Uint8Array(30 + name.length + compressed.length);
    const view = new DataView(local.buffer);
    writeU32(view, 0, 0x04034b50);
    writeU16(view, 4, 20);
    writeU16(view, 8, entry.method === 0 ? 0 : 8);
    writeU16(view, 10, entry.time);
    writeU16(view, 12, entry.date);
    writeU32(view, 14, crc32(entry.data));
    writeU32(view, 18, compressed.length);
    writeU32(view, 22, entry.data.length);
    writeU16(view, 26, name.length);
    local.set(name, 30);
    local.set(compressed, 30 + name.length);
    parts.push(local);

    const dir = new Uint8Array(46 + name.length);
    const dirView = new DataView(dir.buffer);
    writeU32(dirView, 0, 0x02014b50);
    writeU16(dirView, 4, 20);
    writeU16(dirView, 6, 20);
    writeU16(dirView, 10, entry.method === 0 ? 0 : 8);
    writeU16(dirView, 12, entry.time);
    writeU16(dirView, 14, entry.date);
    writeU32(dirView, 16, crc32(entry.data));
    writeU32(dirView, 20, compressed.length);
    writeU32(dirView, 24, entry.data.length);
    writeU16(dirView, 28, name.length);
    writeU32(dirView, 42, offset);
    dir.set(name, 46);
    central.push(dir);
    offset += local.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeU32(eocdView, 0, 0x06054b50);
  writeU16(eocdView, 8, entries.length);
  writeU16(eocdView, 10, entries.length);
  writeU32(eocdView, 12, centralSize);
  writeU32(eocdView, 16, offset);
  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of central) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

export async function prepareResumeDocxForEditor(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const entries = await readZip(bytes);
    const document = entries.find((entry) => entry.name === 'word/document.xml');
    if (!document) return bytes;
    const xml = new TextDecoder().decode(document.data);
    const next = widenUnevenColumnsForEditor(xml);
    if (next === xml) return bytes;
    document.data = new TextEncoder().encode(next);
    document.method = 8;
    return await writeZip(entries);
  } catch {
    return bytes;
  }
}

export async function restoreResumeDocxAfterEditor(blob: Blob): Promise<Blob> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = await readZip(bytes);
    const document = entries.find((entry) => entry.name === 'word/document.xml');
    if (!document) return blob;
    const xml = new TextDecoder().decode(document.data);
    const next = removeEditorColumnBreak(xml);
    if (next === xml) return blob;
    document.data = new TextEncoder().encode(next);
    document.method = 8;
    const restored = await writeZip(entries);
    return new Blob([asBlobPart(restored)], { type: blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  } catch {
    return blob;
  }
}
