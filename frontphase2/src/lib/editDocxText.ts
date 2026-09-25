import { deflateRawSync, inflateRawSync } from 'node:zlib';

export type DocxTextReplacement = { from: string; to: string };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
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
    const dataStart = extraStart + extraLen;
    const hasDescriptor = (gpFlag & 0x8) !== 0;
    if (hasDescriptor && compressedSize === 0) throw new Error('Unsupported docx zip descriptor');
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

function writeZip(entries: ZipEntry[]): Uint8Array {
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
    setU32(central, 42, offset);
    central.set(nameBytes, 46);
    central.set(entry.extra, 46 + nameBytes.length);
    centrals.push(central);
    offset += local.length + entry.compressed.length;
  }
  const centralBytes = concatBytes(centrals);
  const eocd = new Uint8Array(22);
  setU32(eocd, 0, 0x06054b50);
  setU16(eocd, 8, entries.length);
  setU16(eocd, 10, entries.length);
  setU32(eocd, 12, centralBytes.length);
  setU32(eocd, 16, offset);
  return concatBytes([...locals, centralBytes, eocd]);
}

function entryText(entry: ZipEntry): string {
  const raw = entry.method === 0 ? entry.compressed : inflateRawSync(entry.compressed);
  return new TextDecoder().decode(raw);
}

function setEntryText(entry: ZipEntry, text: string): void {
  const raw = new TextEncoder().encode(text);
  const compressed = deflateRawSync(raw);
  entry.method = 8;
  entry.gpFlag &= ~0x8;
  entry.crc = crc32(raw);
  entry.compressed = compressed;
  entry.uncompressedSize = raw.length;
}

function isStoryPart(name: string): boolean {
  return /^word\/(document|footnotes|endnotes|comments|header\d+|footer\d+)\.xml$/i.test(name);
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isSkippable(ch: string): boolean {
  return (
    ch === ' ' ||
    ch === '\t' ||
    ch === '\n' ||
    ch === '\r' ||
    ch === '\u00A0' ||
    ch === '\u2009' ||
    ch === '\u200B' ||
    ch === '\u00AD' ||
    ch === '\uFEFF'
  );
}

type Collapse = { text: string; indexOf: number[] };

function collapse(value: string): Collapse {
  const indexOf: number[] = [];
  let text = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (isSkippable(ch)) continue;
    text += ch;
    indexOf.push(i);
  }
  return { text, indexOf };
}

function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffix(a: string, b: string, prefix: number): number {
  let i = 0;
  const max = Math.min(a.length, b.length) - prefix;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

function isParagraphOpen(xml: string, index: number): boolean {
  const next = xml[index + 4];
  return next === '>' || next === ' ' || next === '\n' || next === '\r' || next === '\t' || next === '/';
}

type TextNode = {
  xmlStart: number;
  xmlEnd: number;
  open: string;
  text: string;
  start: number;
  end: number;
};

function collectOwnTextNodes(paragraphXml: string): TextNode[] {
  const nodes: TextNode[] = [];
  let plain = 0;
  let i = paragraphXml.indexOf('>') + 1;
  const end = paragraphXml.lastIndexOf('</w:p>');
  while (i < end) {
    if (paragraphXml.startsWith('<w:p', i) && isParagraphOpen(paragraphXml, i)) {
      const close = findParagraphEnd(paragraphXml, i);
      i = close > i ? close : i + 4;
      continue;
    }
    if (paragraphXml.startsWith('<w:t', i)) {
      const openEnd = paragraphXml.indexOf('>', i);
      if (openEnd < 0 || openEnd >= end) break;
      const open = paragraphXml.slice(i, openEnd + 1);
      if (open.endsWith('/>')) {
        nodes.push({ xmlStart: i, xmlEnd: openEnd + 1, open, text: '', start: plain, end: plain });
        i = openEnd + 1;
        continue;
      }
      const close = paragraphXml.indexOf('</w:t>', openEnd + 1);
      if (close < 0 || close >= end) break;
      const text = decodeXml(paragraphXml.slice(openEnd + 1, close));
      nodes.push({
        xmlStart: i,
        xmlEnd: close + '</w:t>'.length,
        open,
        text,
        start: plain,
        end: plain + text.length,
      });
      plain += text.length;
      i = close + '</w:t>'.length;
      continue;
    }
    i += 1;
  }
  return nodes;
}

function findParagraphEnd(xml: string, start: number): number {
  let depth = 1;
  let j = xml.indexOf('>', start) + 1;
  while (depth > 0 && j < xml.length) {
    const nextOpen = xml.indexOf('<w:p', j);
    const nextClose = xml.indexOf('</w:p>', j);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose && isParagraphOpen(xml, nextOpen)) {
      depth += 1;
      j = nextOpen + 4;
      continue;
    }
    depth -= 1;
    j = nextClose + '</w:p>'.length;
    if (depth === 0) return j;
  }
  return -1;
}

function renderTextNode(open: string, text: string): string {
  let tag = open;
  if (/\s/.test(text) && !/xml:space\s*=/.test(tag)) {
    tag = tag.replace(/^<w:t\b/, '<w:t xml:space="preserve"');
  }
  return `${tag}${escapeXml(text)}</w:t>`;
}

function applyRange(paragraphXml: string, start: number, end: number, replacement: string): string {
  const nodes = collectOwnTextNodes(paragraphXml);
  if (!nodes.length) return paragraphXml;
  let placed = false;
  const nextTexts = nodes.map((node) => {
    if (end <= node.start || start >= node.end) {
      if (!placed && start === end && start === node.start) {
        placed = true;
        return replacement + node.text;
      }
      return node.text;
    }
    const before = node.text.slice(0, Math.max(0, start - node.start));
    const after = node.text.slice(Math.max(0, end - node.start));
    const mid = placed ? '' : replacement;
    placed = true;
    return before + mid + after;
  });
  if (!placed) nextTexts[nextTexts.length - 1] += replacement;

  let xml = paragraphXml;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nextTexts[i] === nodes[i].text) continue;
    xml = xml.slice(0, nodes[i].xmlStart) + renderTextNode(nodes[i].open, nextTexts[i]) + xml.slice(nodes[i].xmlEnd);
  }
  return xml;
}

function replacementMiddle(to: string, toC: Collapse, prefix: number, suffix: number): string {
  if (prefix >= toC.text.length) return '';
  const start = toC.indexOf[prefix];
  const end = suffix === 0 ? to.length : toC.indexOf[toC.text.length - suffix];
  if (start == null || end < start) return '';
  return to.slice(start, end);
}

function editStoryXml(xml: string, from: string, to: string): { xml: string; applied: boolean } {
  const fromC = collapse(from);
  const toC = collapse(to);
  if (!fromC.text) return { xml, applied: false };

  let applied = false;
  let out = '';
  let i = 0;
  while (i < xml.length) {
    const start = xml.indexOf('<w:p', i);
    if (start < 0 || !isParagraphOpen(xml, start)) {
      if (start < 0) {
        out += xml.slice(i);
        break;
      }
      out += xml.slice(i, start + 4);
      i = start + 4;
      continue;
    }
    const end = findParagraphEnd(xml, start);
    if (end < 0) {
      out += xml.slice(i);
      break;
    }
    const para = xml.slice(start, end);
    out += xml.slice(i, start);
    if (applied) {
      out += para;
      i = end;
      continue;
    }
    const openEnd = xml.indexOf('>', start) + 1;
    const innerEdited = editStoryXml(xml.slice(openEnd, end - '</w:p>'.length), from, to);
    if (innerEdited.applied) {
      out += xml.slice(start, openEnd) + innerEdited.xml + '</w:p>';
      applied = true;
      i = end;
      continue;
    }
    const nodes = collectOwnTextNodes(para);
    const text = nodes.map((node) => node.text).join('');
    const collapsed = collapse(text);
    const at = collapsed.text.indexOf(fromC.text);
    if (at < 0) {
      out += para;
      i = end;
      continue;
    }
    const prefix = commonPrefix(fromC.text, toC.text);
    const suffix = commonSuffix(fromC.text, toC.text, prefix);
    const sameLetters = fromC.text === toC.text;
    const changeStart = sameLetters ? at : at + prefix;
    const changeEnd = sameLetters ? at + fromC.text.length : at + fromC.text.length - suffix;
    const rangeStart =
      changeStart >= changeEnd
        ? changeStart >= collapsed.indexOf.length
          ? text.length
          : collapsed.indexOf[changeStart]
        : collapsed.indexOf[changeStart];
    const rangeEnd =
      changeStart >= changeEnd
        ? rangeStart
        : collapsed.indexOf[changeEnd - 1] + 1;
    const replacement = sameLetters ? to : replacementMiddle(to, toC, prefix, suffix);
    out += applyRange(para, rangeStart, rangeEnd, replacement);
    applied = true;
    i = end;
  }
  return { xml: out, applied };
}

/** Write text edits into the .docx, keeping each run's formatting. */
export function editDocxTextBytes(
  docxBytes: Uint8Array,
  replacements: DocxTextReplacement[]
): { docx: Uint8Array; applied: number; missed: string[] } {
  const usable = replacements.filter((item) => item.from.trim() && item.from !== item.to);
  if (!usable.length) return { docx: docxBytes, applied: 0, missed: [] };

  const entries = readZipEntries(docxBytes);
  let applied = 0;
  const missed: string[] = [];

  for (const item of usable) {
    let found = false;
    for (const entry of entries) {
      if (!isStoryPart(entry.name)) continue;
      const xml = entryText(entry);
      const edited = editStoryXml(xml, item.from, item.to);
      if (!edited.applied) continue;
      setEntryText(entry, edited.xml);
      found = true;
      break;
    }
    if (found) applied += 1;
    else missed.push(item.from);
  }

  if (!applied) return { docx: docxBytes, applied: 0, missed };
  return { docx: writeZip(entries), applied, missed };
}
