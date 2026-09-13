/**
 * Convert pasted plain text / light Markdown into HTML for the job description editor.
 * Prefer this over AI-rewritten HTML when the user already pasted a full JD.
 */

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeBasicEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function inlineMarkdown(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value) && /<\/[a-z][a-z0-9]*>/i.test(value);
}

export function stripJobDescriptionHtml(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Many apps (ChatGPT, Docs, Grammarly) paste markdown as one long line.
 * Re-insert line breaks before headings / bullets / labeled fields.
 */
export function normalizePastedJdText(text: string): string {
  let t = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/\t/g, ' ');

  // Always peel labeled fields onto their own lines (works even when newlines exist).
  // Supports both **Label:** and **Label**:
  t = t.replace(/([^\n])[ \t]+(\*\*[^*:\n]{1,80}:\*\*)/g, '$1\n$2');
  t = t.replace(/([^\n])[ \t]+(\*\*[^*:\n]{1,80}\*\*[ \t]*:)/g, '$1\n$2');

  const newlineCount = (t.match(/\n/g) || []).length;
  if (newlineCount < 8 && t.length > 120) {
    t = t
      // Headings
      .replace(/([^\n])[ \t]+(#{1,4}[ \t]+)/g, '$1\n\n$2')
      // Bullets / numbered items
      .replace(/([^\n])[ \t]+([-*•][ \t]+)/g, '$1\n$2')
      .replace(/([^\n])[ \t]+(\d+[.)][ \t]+)/g, '$1\n$2')
      // Bare section titles without #
      .replace(
        /(?<!#)[ \t]+(Job Summary|Key Responsibilities|Required Skills|Nice to Have|Qualifications|Interview Process|Benefits|Key Performance Indicators(?:\s*\(KPIs\))?)\b/gi,
        '\n\n## $1\n',
      )
      // Put section body on the next line after a heading title
      .replace(
        /(^|\n)(#{1,4}[ \t]+(?:Job Summary|Key Responsibilities|Required Skills|Nice to Have|Qualifications|Interview Process|Benefits|Key Performance Indicators(?:\s*\(KPIs\))?))[ \t]+(?=\S)/gi,
        '$1$2\n',
      );
  }

  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Prefer clipboard HTML structure when the plain text was flattened. */
export function clipboardHtmlToPlainText(html: string): string {
  const raw = String(html || '');
  if (!raw.trim()) return '';
  return decodeBasicEntities(
    raw
      .replace(/\r\n/g, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '* ')
      .replace(/<h([1-6])[^>]*>/gi, (_, level) => `${'#'.repeat(Math.min(Number(level) || 2, 4))} `)
      .replace(/<\/?[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n'),
  ).trim();
}

/**
 * Read the best plain JD text from a clipboard paste event.
 */
export function readJdPlainFromClipboard(clipboardData: DataTransfer | null | undefined): string {
  if (!clipboardData) return '';
  const plain = String(clipboardData.getData('text/plain') || '');
  const html = String(clipboardData.getData('text/html') || '');
  const plainNorm = normalizePastedJdText(plain);
  const plainBreaks = (plainNorm.match(/\n/g) || []).length;

  if (html.trim()) {
    const fromHtml = normalizePastedJdText(clipboardHtmlToPlainText(html));
    const htmlBreaks = (fromHtml.match(/\n/g) || []).length;
    if (htmlBreaks > plainBreaks || (plainBreaks < 5 && htmlBreaks >= 5)) {
      return fromHtml;
    }
  }

  return plainNorm;
}

/** Turn pasted JD text into structured HTML (headings, lists, paragraphs). */
export function plainTextToJobDescriptionHtml(text: string): string {
  const raw = normalizePastedJdText(text);
  if (!raw) return '';
  if (looksLikeHtml(raw)) return raw;

  const lines = raw.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    // Bold-only line used as a section title: **Key Responsibilities**
    const boldHeading = trimmed.match(/^\*\*(.+?)\*\*:?$/);
    if (boldHeading && boldHeading[1].length < 80 && !boldHeading[1].includes(':')) {
      closeList();
      out.push(`<h3>${inlineMarkdown(escapeHtml(boldHeading[1]))}</h3>`);
      continue;
    }

    const bullet = trimmed.match(/^([-*•]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const nextType: 'ul' | 'ol' = /^\d+[.)]/.test(bullet[1]) ? 'ol' : 'ul';
      if (listType !== nextType) {
        closeList();
        out.push(`<${nextType}>`);
        listType = nextType;
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(bullet[2]))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineMarkdown(escapeHtml(trimmed))}</p>`);
  }

  closeList();
  return out.join('\n');
}

/**
 * Prefer the user's pasted JD when AI returns a shortened rewrite.
 */
export function preferFullJobDescriptionHtml(
  sourcePlainOrHtml: string,
  aiHtml: string | null | undefined,
): string {
  const source = String(sourcePlainOrHtml || '').trim();
  const ai = String(aiHtml || '').trim();
  if (!source) return ai;
  if (!ai) return plainTextToJobDescriptionHtml(source);

  const sourcePlain = looksLikeHtml(source) ? stripJobDescriptionHtml(source) : source;
  const aiPlain = stripJobDescriptionHtml(ai);

  // Keep the full paste when AI clearly truncated or paraphrased into a short overview.
  if (sourcePlain.length >= 200 && aiPlain.length < Math.floor(sourcePlain.length * 0.85)) {
    return plainTextToJobDescriptionHtml(source);
  }
  return ai;
}
