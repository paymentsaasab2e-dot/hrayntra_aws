/** Private-use marker so a Word column break can be found after docx-preview. */
const COLUMN_BREAK_MARK = '\uE000';

export type DocxSectionLayout = {
  /** Unequal column widths in twips, left then right. Null when the section is one column. */
  widths: [number, number] | null;
  gapTwips: number;
};

export type DocxPlacedImage = {
  dataUrl: string;
  leftTwip: number;
  topTwip: number;
  widthTwip: number;
  heightTwip: number;
  /** Highlight color for a Word duotone (shadows stay black). */
  duotoneLight: [number, number, number] | null;
};

export type DocxPlacedLine = {
  leftTwip: number;
  topTwip: number;
  widthTwip: number;
  heightTwip: number;
  color: string;
};

export type DocxPageDecoration = {
  pageWidthTwip: number;
  pageHeightTwip: number;
  images: DocxPlacedImage[];
  lines: DocxPlacedLine[];
};

export type DocxPreviewLayout = {
  sections: DocxSectionLayout[];
  /** Index of the section that contains a column break, or -1. */
  breakSection: number;
  pages: DocxPageDecoration[];
};

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function setU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function setU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipEntry = {
  name: string;
  method: number;
  gpFlag: number;
  modTime: number;
  modDate: number;
  crc: number;
  compressed: Uint8Array;
  uncompressedSize: number;
  extra: Uint8Array;
};

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (u32(bytes, offset) !== 0x04034b50) break;
    const gpFlag = u16(bytes, offset + 6);
    const method = u16(bytes, offset + 8);
    const modTime = u16(bytes, offset + 10);
    const modDate = u16(bytes, offset + 12);
    let crc = u32(bytes, offset + 14);
    let compressedSize = u32(bytes, offset + 18);
    let uncompressedSize = u32(bytes, offset + 22);
    const nameLen = u16(bytes, offset + 26);
    const extraLen = u16(bytes, offset + 28);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    const extraStart = nameStart + nameLen;
    const extra = bytes.subarray(extraStart, extraStart + extraLen);
    let dataStart = extraStart + extraLen;
    const hasDescriptor = (gpFlag & 0x8) !== 0;
    if (hasDescriptor && compressedSize === 0) {
      throw new Error('Unsupported docx zip descriptor');
    }
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    offset = dataStart + compressedSize;
    if (hasDescriptor) {
      if (u32(bytes, offset) === 0x08074b50) offset += 4;
      crc = u32(bytes, offset);
      compressedSize = u32(bytes, offset + 4);
      uncompressedSize = u32(bytes, offset + 8);
      offset += 12;
    }
    entries.push({
      name,
      method,
      gpFlag: gpFlag & ~0x8,
      modTime,
      modDate,
      crc,
      compressed,
      uncompressedSize,
      extra,
    });
  }
  return entries;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const local = new Uint8Array(30 + nameBytes.length + entry.extra.length);
    setU32(local, 0, 0x04034b50);
    setU16(local, 4, 20);
    setU16(local, 6, entry.gpFlag);
    setU16(local, 8, entry.method);
    setU16(local, 10, entry.modTime);
    setU16(local, 12, entry.modDate);
    setU32(local, 14, entry.crc);
    setU32(local, 18, entry.compressed.length);
    setU32(local, 22, entry.uncompressedSize);
    setU16(local, 26, nameBytes.length);
    setU16(local, 28, entry.extra.length);
    local.set(nameBytes, 30);
    local.set(entry.extra, 30 + nameBytes.length);
    locals.push(local, entry.compressed);

    const central = new Uint8Array(46 + nameBytes.length + entry.extra.length);
    setU32(central, 0, 0x02014b50);
    setU16(central, 4, 20);
    setU16(central, 6, 20);
    setU16(central, 8, entry.gpFlag);
    setU16(central, 10, entry.method);
    setU16(central, 12, entry.modTime);
    setU16(central, 14, entry.modDate);
    setU32(central, 16, entry.crc);
    setU32(central, 20, entry.compressed.length);
    setU32(central, 24, entry.uncompressedSize);
    setU16(central, 28, nameBytes.length);
    setU16(central, 30, entry.extra.length);
    setU16(central, 32, 0);
    setU16(central, 34, 0);
    setU16(central, 36, 0);
    setU32(central, 38, 0);
    setU32(central, 42, offset);
    central.set(nameBytes, 46);
    central.set(entry.extra, 46 + nameBytes.length);
    centrals.push(central);
    offset += local.length + entry.compressed.length;
  }
  const centralBytes = concatBytes(centrals);
  const eocd = new Uint8Array(22);
  setU32(eocd, 0, 0x06054b50);
  setU16(eocd, 4, 0);
  setU16(eocd, 6, 0);
  setU16(eocd, 8, entries.length);
  setU16(eocd, 10, entries.length);
  setU32(eocd, 12, centralBytes.length);
  setU32(eocd, 16, offset);
  setU16(eocd, 20, 0);
  return concatBytes([...locals, centralBytes, eocd]);
}

async function readZipText(entry: ZipEntry): Promise<string> {
  const raw = entry.method === 0 ? entry.compressed : await inflateRaw(entry.compressed);
  return new TextDecoder().decode(raw);
}

const EMPTY_LAYOUT: DocxPreviewLayout = { sections: [], breakSection: -1, pages: [] };

function attrNum(tag: string, name: string, fallback = 0): number {
  const match = tag.match(new RegExp(`\\b${name}="(-?\\d+)"`));
  return match ? Number(match[1]) : fallback;
}

function emuToTwip(emu: number): number {
  return emu / 635;
}

function parseSections(xml: string): DocxSectionLayout[] {
  return [...xml.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)].map((match) => {
    const sect = match[0];
    const cols = sect.match(/<w:cols\b([^>]*)>([\s\S]*?)<\/w:cols>/);
    if (!cols) return { widths: null, gapTwips: 0 };
    const colTags = [...cols[2].matchAll(/<w:col\b([^/]*)\/>/g)];
    const widths = colTags
      .map((col) => Number((col[1].match(/\bw:w="(\d+)"/) || [])[1] || '0'))
      .filter((width) => width > 0);
    const gapTwips = Number(
      (colTags[0]?.[1].match(/\bw:space="(\d+)"/) || cols[1].match(/\bw:space="(\d+)"/) || [])[1] || '720'
    );
    if (widths.length < 2) return { widths: null, gapTwips: 0 };
    return { widths: [widths[0], widths[1]], gapTwips };
  });
}

function sectionAt(xml: string, index: number): string {
  const next = xml.slice(index).match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  return next?.[0] ?? '';
}

function pageBox(sectXml: string): { w: number; h: number; top: number; right: number; bottom: number; left: number } {
  const sz = sectXml.match(/<w:pgSz\b[^/]*\/>/)?.[0] ?? '';
  const mar = sectXml.match(/<w:pgMar\b[^/]*\/>/)?.[0] ?? '';
  return {
    w: attrNum(sz, 'w:w', 12240),
    h: attrNum(sz, 'w:h', 15840),
    top: attrNum(mar, 'w:top', 0),
    right: attrNum(mar, 'w:right', 0),
    bottom: attrNum(mar, 'w:bottom', 0),
    left: attrNum(mar, 'w:left', 0),
  };
}

function axisOrigin(
  block: string | undefined,
  pageExtent: number,
  marginStart: number,
  marginEnd: number,
  shapeExtent: number
): number {
  if (!block) return marginStart;
  const relative = (block.match(/relativeFrom="([^"]+)"/) || [])[1] || 'page';
  const align = (block.match(/<wp:align>([^<]+)<\/wp:align>/) || [])[1];
  const offset = emuToTwip(Number((block.match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/) || [])[1] || '0'));
  const origin = relative === 'page' ? 0 : marginStart;
  const space = relative === 'page' ? pageExtent : Math.max(0, pageExtent - marginStart - marginEnd);
  if (align === 'right' || align === 'bottom') return origin + space - shapeExtent;
  if (align === 'center') return origin + (space - shapeExtent) / 2;
  if (align === 'left' || align === 'top') return origin;
  return origin + offset;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function duotoneHighlight(themeXml: string, tint: number, satMod: number): [number, number, number] {
  const dk2 = themeXml.match(/<a:dk2>\s*<a:srgbClr\s+val="([A-Fa-f0-9]{6})"/);
  const hex = dk2?.[1] || '1F497D';
  const base = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const tinted = base.map((channel) => channel + (255 - channel) * tint);
  const avg = (tinted[0] + tinted[1] + tinted[2]) / 3;
  return tinted.map((channel) => clampByte(avg + (channel - avg) * satMod)) as [number, number, number];
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function mimeForMedia(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  return null;
}

async function mediaDataUrls(entries: ZipEntry[]): Promise<Map<string, string>> {
  const rels = entries.find((entry) => entry.name === 'word/_rels/document.xml.rels');
  const urls = new Map<string, string>();
  if (!rels) return urls;
  const relXml = await readZipText(rels);
  for (const match of relXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const target = match[2].replace(/^\//, '');
    const path = target.startsWith('word/') ? target : `word/${target.replace(/^\.\.\//, '')}`;
    const mime = mimeForMedia(path);
    const media = entries.find((entry) => entry.name === path);
    if (!mime || !media) continue;
    const raw = media.method === 0 ? media.compressed : await inflateRaw(media.compressed);
    urls.set(match[1], bytesToDataUrl(raw, mime));
  }
  return urls;
}

function placedPictures(
  anchorXml: string,
  page: { w: number; h: number; top: number; right: number; bottom: number; left: number },
  images: Map<string, string>,
  duotoneLight: [number, number, number]
): DocxPlacedImage[] {
  const extent = anchorXml.match(/<wp:extent\b[^/]*\/>/)?.[0] ?? '';
  const groupWidth = emuToTwip(attrNum(extent, 'cx'));
  const groupHeight = emuToTwip(attrNum(extent, 'cy'));
  const posH = anchorXml.match(/<wp:positionH[\s\S]*?<\/wp:positionH>/)?.[0];
  const posV = anchorXml.match(/<wp:positionV[\s\S]*?<\/wp:positionV>/)?.[0];
  const groupLeft = axisOrigin(posH, page.w, page.left, page.right, groupWidth);
  const groupTop = axisOrigin(posV, page.h, page.top, page.bottom, groupHeight);
  const xfrm = anchorXml.match(/<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/)?.[1] ?? '';
  const chOff = xfrm.match(/<a:chOff\b[^/]*\/>/)?.[0] ?? '';
  const chExt = xfrm.match(/<a:chExt\b[^/]*\/>/)?.[0] ?? '';
  const childW = attrNum(chExt, 'cx', 1) || 1;
  const childH = attrNum(chExt, 'cy', 1) || 1;
  const childX = attrNum(chOff, 'x');
  const childY = attrNum(chOff, 'y');
  const scaleX = groupWidth / childW;
  const scaleY = groupHeight / childH;
  const placed: DocxPlacedImage[] = [];
  for (const match of anchorXml.matchAll(/<pic:pic[\s\S]*?<\/pic:pic>/g)) {
    const pic = match[0];
    const embed = (pic.match(/r:embed="([^"]+)"/) || [])[1];
    const dataUrl = embed ? images.get(embed) : undefined;
    const off = pic.match(/<a:off\b[^/]*\/>/)?.[0] ?? '';
    const ext = pic.match(/<a:ext\b[^/]*\/>/)?.[0] ?? '';
    const widthTwip = attrNum(ext, 'cx') * scaleX;
    const heightTwip = attrNum(ext, 'cy') * scaleY;
    if (!dataUrl || (widthTwip < 120 && heightTwip < 200)) continue;
    placed.push({
      dataUrl,
      leftTwip: groupLeft + (attrNum(off, 'x') - childX) * scaleX,
      topTwip: groupTop + (attrNum(off, 'y') - childY) * scaleY,
      widthTwip,
      heightTwip,
      duotoneLight: /<a:duotone\b/.test(pic) ? duotoneLight : null,
    });
  }
  return placed;
}

async function decorationsFromXml(xml: string, entries: ZipEntry[]): Promise<DocxPageDecoration[]> {
  const images = await mediaDataUrls(entries);
  const themeEntry = entries.find((entry) => entry.name === 'word/theme/theme1.xml');
  const themeXml = themeEntry ? await readZipText(themeEntry) : '';
  const highlight = duotoneHighlight(themeXml, 0.45, 4);
  const pages = new Map<number, DocxPageDecoration>();
  const ensure = (pageIndex: number, sectXml: string) => {
    const existing = pages.get(pageIndex);
    if (existing) return existing;
    const box = pageBox(sectXml);
    const created: DocxPageDecoration = { pageWidthTwip: box.w, pageHeightTwip: box.h, images: [], lines: [] };
    pages.set(pageIndex, created);
    return created;
  };
  for (const match of xml.matchAll(/<wp:anchor[\s\S]*?<\/wp:anchor>/g)) {
    const anchor = match[0];
    const pageIndex = (xml.slice(0, match.index ?? 0).match(/lastRenderedPageBreak/g) || []).length;
    const sect = sectionAt(xml, match.index ?? 0);
    const page = pageBox(sect);
    const bucket = ensure(pageIndex, sect);
    if (/<wpg:wgp\b/.test(anchor)) {
      bucket.images.push(...placedPictures(anchor, page, images, highlight));
    }
  }
  const ordered: DocxPageDecoration[] = [];
  const maxPage = Math.max(-1, ...pages.keys());
  for (let i = 0; i <= maxPage; i += 1) {
    ordered.push(pages.get(i) ?? { pageWidthTwip: 12240, pageHeightTwip: 15840, images: [], lines: [] });
  }
  return ordered;
}

function markColumnBreaks(xml: string): string {
  return xml.replace(/<w:br\b([^>]*?)\bw:type="column"([^>]*?)\/>/g, `<w:t xml:space="preserve">${COLUMN_BREAK_MARK}</w:t>`);
}

/**
 * Word column breaks and grouped drawings are dropped by the preview library.
 * Mark the breaks and collect the header art so the page can be rebuilt.
 */
export async function prepareDocxBlobForPreview(blob: Blob): Promise<{
  blob: Blob;
  layout: DocxPreviewLayout;
}> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = readZipEntries(bytes);
    const entry = entries.find((item) => item.name === 'word/document.xml');
    if (!entry) return { blob, layout: EMPTY_LAYOUT };
    const xml = await readZipText(entry);
    const sections = parseSections(xml);
    const breakAt = xml.search(/<w:br\b[^>]*w:type="column"/);
    const breakSection =
      breakAt < 0 ? -1 : (xml.slice(0, breakAt).match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || []).length;
    const pages = await decorationsFromXml(xml, entries);
    const layout: DocxPreviewLayout = { sections, breakSection, pages };
    if (breakAt < 0) return { blob, layout };
    const nextXml = markColumnBreaks(xml);
    const uncompressed = new TextEncoder().encode(nextXml);
    entry.compressed = await deflateRaw(uncompressed);
    entry.method = 8;
    entry.extra = new Uint8Array(0);
    entry.crc = crc32(uncompressed);
    entry.uncompressedSize = uncompressed.length;
    const packed = await writeZip(entries);
    return {
      blob: new Blob([packed], { type: blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      layout,
    };
  } catch {
    return { blob, layout: EMPTY_LAYOUT };
  }
}

function widenDocxArticles(root: HTMLElement): void {
  root.querySelectorAll('section.docx-preview-resume').forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    section.style.setProperty('width', '100%', 'important');
    section.style.setProperty('max-width', '100%', 'important');
    section.style.setProperty('min-width', '0', 'important');
    section.style.setProperty('box-sizing', 'border-box', 'important');
    section.style.setProperty('align-items', 'stretch', 'important');
    section.style.setProperty('overflow', 'hidden', 'important');
    section.style.position = 'relative';
  });
  root.querySelectorAll('section.docx-preview-resume > article').forEach((article) => {
    if (!(article instanceof HTMLElement)) return;
    article.style.setProperty('width', '100%', 'important');
    article.style.setProperty('max-width', '100%', 'important');
    article.style.setProperty('min-width', '100%', 'important');
    article.style.setProperty('align-self', 'stretch', 'important');
    article.style.boxSizing = 'border-box';
    article.style.position = 'relative';
    article.style.zIndex = '1';
    article.style.background = 'transparent';
  });
}

function findColumnMark(root: HTMLElement): Text | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data.includes(COLUMN_BREAK_MARK)) return node;
    node = walker.nextNode();
  }
  return null;
}

function frameColumns(article: HTMLElement, widths: [number, number], gapTwips: number): { left: HTMLDivElement; right: HTMLDivElement } {
  const left = article.ownerDocument.createElement('div');
  const right = article.ownerDocument.createElement('div');
  left.className = 'saasa-docx-column';
  right.className = 'saasa-docx-column';
  const total = widths[0] + widths[1];
  const leftPct = (widths[0] / total) * 100;
  const gapPx = (gapTwips / 1440) * 96;
  article.style.setProperty('column-count', 'auto', 'important');
  article.style.setProperty('column-gap', 'normal', 'important');
  article.style.setProperty('display', 'flex', 'important');
  article.style.setProperty('flex-direction', 'row', 'important');
  article.style.setProperty('align-items', 'flex-start', 'important');
  article.style.setProperty('gap', `${gapPx}px`, 'important');
  article.style.setProperty('width', '100%', 'important');
  article.style.setProperty('min-width', '100%', 'important');
  left.style.flex = `0 0 calc(${leftPct}% - ${gapPx / 2}px)`;
  right.style.flex = '1 1 0';
  left.style.minWidth = '0';
  right.style.minWidth = '0';
  return { left, right };
}

function splitArticleAtColumnBreak(article: HTMLElement, section: DocxSectionLayout): void {
  if (!section.widths) return;
  const mark = findColumnMark(article);
  if (!mark) {
    balanceArticleColumns(article, section);
    return;
  }
  const index = mark.data.indexOf(COLUMN_BREAK_MARK);
  const range = article.ownerDocument.createRange();
  range.setStart(article, 0);
  range.setEnd(mark, index);
  const { left, right } = frameColumns(article, section.widths, section.gapTwips);
  left.append(range.extractContents());
  mark.data = mark.data.replaceAll(COLUMN_BREAK_MARK, '');
  while (article.firstChild) right.append(article.firstChild);
  article.append(left, right);
}

function balanceArticleColumns(article: HTMLElement, section: DocxSectionLayout): void {
  if (!section.widths) return;
  const { left, right } = frameColumns(article, section.widths, section.gapTwips);
  while (article.firstChild) right.append(article.firstChild);
  article.append(left, right);
  while (right.childNodes.length > 1 && left.offsetHeight < right.offsetHeight) {
    left.appendChild(right.childNodes[0]);
  }
  if (!left.childNodes.length || !right.childNodes.length) return;
  const before = Math.abs(left.offsetHeight - right.offsetHeight);
  const moved = left.lastChild;
  if (!moved) return;
  right.insertBefore(moved, right.firstChild);
  const after = Math.abs(left.offsetHeight - right.offsetHeight);
  if (before <= after && right.firstChild) left.appendChild(right.firstChild);
}

function stripColumnMarks(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data.includes(COLUMN_BREAK_MARK)) {
      node.data = node.data.replaceAll(COLUMN_BREAK_MARK, '');
    }
    node = walker.nextNode();
  }
}

async function applyDuotone(img: HTMLImageElement, light: [number, number, number]): Promise<void> {
  try {
    await img.decode();
  } catch {
    return;
  }
  const width = img.naturalWidth || 1;
  const height = img.naturalHeight || 1;
  const canvas = img.ownerDocument.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    data[i] = Math.round(light[0] * lum);
    data[i + 1] = Math.round(light[1] * lum);
    data[i + 2] = Math.round(light[2] * lum);
  }
  ctx.putImageData(pixels, 0, 0);
  img.src = canvas.toDataURL('image/png');
}

async function paintPageDecorations(root: HTMLElement, pages: DocxPageDecoration[]): Promise<void> {
  const sections = [...root.querySelectorAll('section.docx-preview-resume')];
  for (let index = 0; index < pages.length; index += 1) {
    const page = sections[index];
    const decoration = pages[index];
    if (!(page instanceof HTMLElement) || !decoration) continue;
    if (!decoration.images.length && !decoration.lines.length) continue;
    const scale = page.clientWidth > 0 ? page.clientWidth / decoration.pageWidthTwip : 96 / 1440;
    const layer = page.ownerDocument.createElement('div');
    layer.className = 'saasa-docx-backdrop';
    for (const image of decoration.images) {
      const img = page.ownerDocument.createElement('img');
      img.alt = '';
      img.src = image.dataUrl;
      img.style.position = 'absolute';
      img.style.left = `${image.leftTwip * scale}px`;
      img.style.top = `${image.topTwip * scale}px`;
      img.style.width = `${Math.max(1, image.widthTwip * scale)}px`;
      img.style.height = `${Math.max(1, image.heightTwip * scale)}px`;
      img.style.objectFit = 'fill';
      if (image.duotoneLight) await applyDuotone(img, image.duotoneLight);
      layer.append(img);
    }
    for (const line of decoration.lines) {
      const el = page.ownerDocument.createElement('div');
      el.style.position = 'absolute';
      el.style.left = `${line.leftTwip * scale}px`;
      el.style.top = `${line.topTwip * scale}px`;
      el.style.width = `${Math.max(1, line.widthTwip * scale)}px`;
      el.style.height = `${Math.max(1, line.heightTwip * scale)}px`;
      el.style.background = line.color;
      layer.append(el);
    }
    page.insertBefore(layer, page.firstChild);
  }
}

/** Stretch each Word page and restore columns plus the drawings the preview library drops. */
export async function fixRenderedDocxLayout(root: HTMLElement, layout: DocxPreviewLayout | null): Promise<void> {
  widenDocxArticles(root);
  if (!layout) {
    stripColumnMarks(root);
    return;
  }
  await paintPageDecorations(root, layout.pages);
  const articles = [...root.querySelectorAll('section.docx-preview-resume > article')];
  articles.forEach((article, index) => {
    if (!(article instanceof HTMLElement)) return;
    const section = layout.sections[index];
    if (!section?.widths) return;
    if (index === layout.breakSection) splitArticleAtColumnBreak(article, section);
    else balanceArticleColumns(article, section);
  });
  stripColumnMarks(root);
}
