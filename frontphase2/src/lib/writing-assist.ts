export type WritingSpanSuggestion = {
  id: string;
  start: number;
  end: number;
  original: string;
  /** Corrected text only — shown in the tooltip, no “refine” wording. */
  suggestion: string;
  kind: 'spelling' | 'grammar' | 'punctuation' | 'rephrase';
};

/** @deprecated Prefer WritingSpanSuggestion / getWritingSpanSuggestions */
export type WritingSuggestion = {
  id: string;
  label: string;
  original: string;
  suggestion: string;
};

type Rule = {
  pattern: RegExp;
  replace: string | ((match: string, ...args: string[]) => string);
  kind: WritingSpanSuggestion['kind'];
};

const SPELLINGS: Array<[RegExp, string]> = [
  [/\bonwing\b/gi, 'owning'],
  [/\bonwed\b/gi, 'owned'],
  [/\bteh\b/gi, 'the'],
  [/\bthier\b/gi, 'their'],
  [/\btheres\b/gi, "there's"],
  [/\bwheres\b/gi, "where's"],
  [/\brecieve\b/gi, 'receive'],
  [/\bexperiance\b/gi, 'experience'],
  [/\bexprience\b/gi, 'experience'],
  [/\bdevelopement\b/gi, 'development'],
  [/\bseperate\b/gi, 'separate'],
  [/\boccurence\b/gi, 'occurrence'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\boccured\b/gi, 'occurred'],
  [/\buntill\b/gi, 'until'],
  [/\bwether\b/gi, 'whether'],
  [/\bbeleive\b/gi, 'believe'],
  [/\baccomodate\b/gi, 'accommodate'],
  [/\brecommand\b/gi, 'recommend'],
  [/\bproffessional\b/gi, 'professional'],
  [/\bresposibility\b/gi, 'responsibility'],
  [/\bmanagment\b/gi, 'management'],
  [/\bsucess\b/gi, 'success'],
  [/\bstrenght\b/gi, 'strength'],
  [/\bknowlege\b/gi, 'knowledge'],
  [/\bcommited\b/gi, 'committed'],
  [/\boppurtunity\b/gi, 'opportunity'],
  [/\boppertunity\b/gi, 'opportunity'],
  [/\bacheive\b/gi, 'achieve'],
  [/\benviroment\b/gi, 'environment'],
  [/\bintersted\b/gi, 'interested'],
  [/\bskils\b/gi, 'skills'],
  [/\bgrammer\b/gi, 'grammar'],
  [/\bsentense\b/gi, 'sentence'],
  [/\bspleing\b/gi, 'spelling'],
  [/\bpunctuaiton\b/gi, 'punctuation'],
  [/\brefecmed\b/gi, 'reframed'],
  [/\bproeprly\b/gi, 'properly'],
  [/\bproepr\b/gi, 'proper'],
  [/\bcorcet\b/gi, 'correct'],
  [/\baplication\b/gi, 'application'],
  [/\bapplicaton\b/gi, 'application'],
  [/\bprofil\b/gi, 'profile'],
  [/\bresmue\b/gi, 'resume'],
  [/\bresum\b/gi, 'resume'],
  [/\bcv\b/g, 'CV'],
  [/\binterveiw\b/gi, 'interview'],
  [/\bintreview\b/gi, 'interview'],
  [/\bcandidatee\b/gi, 'candidate'],
  [/\brecruiter\b/gi, 'recruiter'],
  [/\bemployement\b/gi, 'employment'],
  [/\bcompaney\b/gi, 'company'],
  [/\bcompnay\b/gi, 'company'],
  [/\bavailabe\b/gi, 'available'],
  [/\bresponsbile\b/gi, 'responsible'],
  [/\bcomunication\b/gi, 'communication'],
  [/\bcomunicate\b/gi, 'communicate'],
  [/\blangauge\b/gi, 'language'],
  [/\btehcnical\b/gi, 'technical'],
  [/\btecnical\b/gi, 'technical'],
  [/\benginering\b/gi, 'engineering'],
  [/\bsoftwear\b/gi, 'software'],
  [/\bsofware\b/gi, 'software'],
  [/\bdatabse\b/gi, 'database'],
  [/\bprojcet\b/gi, 'project'],
  [/\bleadrship\b/gi, 'leadership'],
  [/\bcolleage\b/gi, 'college'],
  [/\buniveristy\b/gi, 'university'],
  [/\bcertficate\b/gi, 'certificate'],
  [/\bquallification\b/gi, 'qualification'],
  [/\bachivement\b/gi, 'achievement'],
  [/\bresposnible\b/gi, 'responsible'],
  [/\bimprovment\b/gi, 'improvement'],
  [/\brequirment\b/gi, 'requirement'],
  [/\brequirments\b/gi, 'requirements'],
  [/\bneccessary\b/gi, 'necessary'],
  [/\bbenifit\b/gi, 'benefit'],
  [/\bbenificial\b/gi, 'beneficial'],
  [/\bfreindly\b/gi, 'friendly'],
  [/\btruley\b/gi, 'truly'],
  [/\brealy\b/gi, 'really'],
  [/\bbecuase\b/gi, 'because'],
  [/\bbeacause\b/gi, 'because'],
  [/\bwihout\b/gi, 'without'],
  [/\bwih\b/gi, 'with'],
  [/\bwich\b/gi, 'which'],
  [/\bwihch\b/gi, 'which'],
  [/\babotu\b/gi, 'about'],
  [/\bpeopel\b/gi, 'people'],
  [/\bpersnal\b/gi, 'personal'],
  [/\bpersoanl\b/gi, 'personal'],
];

const RULES: Rule[] = [
  // —— Phrase / grammar (before single words) ——
  { pattern: /\bi\s+am\s+owning\b/gi, replace: 'I own', kind: 'rephrase' },
  { pattern: /\bi\s+am\s+onwing\b/gi, replace: 'I own', kind: 'rephrase' },
  { pattern: /\bthe\s+car\s+is\s+onwed\s+by\s+me\b/gi, replace: 'I own the car', kind: 'rephrase' },
  { pattern: /\bthe\s+car\s+is\s+owned\s+by\s+me\b/gi, replace: 'I own the car', kind: 'rephrase' },
  { pattern: /\bi\s+am\s+having\b/gi, replace: 'I have', kind: 'rephrase' },
  { pattern: /\bi\s+am\s+wanting\b/gi, replace: 'I want', kind: 'rephrase' },
  { pattern: /\bi\s+am\s+needing\b/gi, replace: 'I need', kind: 'rephrase' },
  { pattern: /\bi\s+can\s+able\s+to\b/gi, replace: 'I am able to', kind: 'grammar' },
  { pattern: /\bmore\s+better\b/gi, replace: 'better', kind: 'grammar' },
  { pattern: /\bmost\s+unique\b/gi, replace: 'unique', kind: 'grammar' },
  { pattern: /\bin\s+regards\s+to\b/gi, replace: 'regarding', kind: 'rephrase' },
  { pattern: /\bdue\s+to\s+the\s+fact\s+that\b/gi, replace: 'because', kind: 'rephrase' },

  // Subject–verb: is / are / was / were / has / have
  // this/that first (plural sense) before he/she/it singular rules
  { pattern: /\bthis\s+are\b/gi, replace: 'these are', kind: 'grammar' },
  { pattern: /\bthat\s+are\b/gi, replace: 'those are', kind: 'grammar' },
  { pattern: /\bthese\s+is\b/gi, replace: 'these are', kind: 'grammar' },
  { pattern: /\bthose\s+is\b/gi, replace: 'those are', kind: 'grammar' },
  { pattern: /\b(he|she|it)\s+are\b/gi, replace: '$1 is', kind: 'grammar' },
  { pattern: /\b(he|she|it)\s+were\b/gi, replace: '$1 was', kind: 'grammar' },
  { pattern: /\b(he|she|it)\s+have\b/gi, replace: '$1 has', kind: 'grammar' },
  { pattern: /\b(they|we|you|these|those)\s+is\b/gi, replace: '$1 are', kind: 'grammar' },
  { pattern: /\b(they|we|you|these|those)\s+was\b/gi, replace: '$1 were', kind: 'grammar' },
  { pattern: /\b(they|we|you|these|those)\s+has\b/gi, replace: '$1 have', kind: 'grammar' },
  { pattern: /\bthere\s+is\s+(many|several|few|two|three|four|five|\d+)\b/gi, replace: 'there are $1', kind: 'grammar' },
  { pattern: /\bthere\s+are\s+(a|an|one)\b/gi, replace: 'there is $1', kind: 'grammar' },
  { pattern: /\bone\s+of\s+the\s+(\w+)\s+are\b/gi, replace: 'one of the $1 is', kind: 'grammar' },
  { pattern: /\beach\s+of\s+(?:the\s+)?(\w+)\s+are\b/gi, replace: 'each of the $1 is', kind: 'grammar' },
  { pattern: /\b(everyone|everybody|someone|somebody|anyone|anybody|nobody|no one)\s+are\b/gi, replace: '$1 is', kind: 'grammar' },
  { pattern: /\b(everyone|everybody|someone|somebody|anyone|anybody|nobody|no one)\s+have\b/gi, replace: '$1 has', kind: 'grammar' },
  { pattern: /\bi\s+is\b/gi, replace: 'I am', kind: 'grammar' },
  { pattern: /\bi\s+are\b/gi, replace: 'I am', kind: 'grammar' },
  { pattern: /\bi\s+has\b/gi, replace: 'I have', kind: 'grammar' },
  { pattern: /\bi\s+was\s+been\b/gi, replace: 'I have been', kind: 'grammar' },
  { pattern: /\bhe\s+don't\b/gi, replace: "he doesn't", kind: 'grammar' },
  { pattern: /\bshe\s+don't\b/gi, replace: "she doesn't", kind: 'grammar' },
  { pattern: /\bit\s+don't\b/gi, replace: "it doesn't", kind: 'grammar' },
  { pattern: /\bthey\s+doesn't\b/gi, replace: "they don't", kind: 'grammar' },
  { pattern: /\bwe\s+doesn't\b/gi, replace: "we don't", kind: 'grammar' },
  { pattern: /\byou\s+doesn't\b/gi, replace: "you don't", kind: 'grammar' },
  {
    pattern: /\ba\s+(apple|orange|offer|opportunity|interview|email|update|idea|hour|honest)\b/gi,
    replace: 'an $1',
    kind: 'grammar',
  },
  {
    pattern: /\ban\s+(job|resume|cv|company|candidate|skill|project|role|team|university|user|unique)\b/gi,
    replace: 'a $1',
    kind: 'grammar',
  },

  // Contractions / informal → proper
  { pattern: /\bdont\b/gi, replace: "don't", kind: 'grammar' },
  { pattern: /\bcant\b/gi, replace: "can't", kind: 'grammar' },
  { pattern: /\bwont\b/gi, replace: "won't", kind: 'grammar' },
  { pattern: /\bdidnt\b/gi, replace: "didn't", kind: 'grammar' },
  { pattern: /\bisnt\b/gi, replace: "isn't", kind: 'grammar' },
  { pattern: /\barent\b/gi, replace: "aren't", kind: 'grammar' },
  { pattern: /\bwasnt\b/gi, replace: "wasn't", kind: 'grammar' },
  { pattern: /\bwerent\b/gi, replace: "weren't", kind: 'grammar' },
  { pattern: /\bhavent\b/gi, replace: "haven't", kind: 'grammar' },
  { pattern: /\bhasnt\b/gi, replace: "hasn't", kind: 'grammar' },
  { pattern: /\bcouldnt\b/gi, replace: "couldn't", kind: 'grammar' },
  { pattern: /\bwouldnt\b/gi, replace: "wouldn't", kind: 'grammar' },
  { pattern: /\bshouldnt\b/gi, replace: "shouldn't", kind: 'grammar' },
  { pattern: /\bim\b/gi, replace: "I'm", kind: 'grammar' },
  { pattern: /\bive\b/gi, replace: "I've", kind: 'grammar' },
  { pattern: /\bid\b/gi, replace: "I'd", kind: 'grammar' },
  { pattern: /\bill\b/gi, replace: "I'll", kind: 'grammar' },
  { pattern: /\byoure\b/gi, replace: "you're", kind: 'grammar' },
  { pattern: /\btheyre\b/gi, replace: "they're", kind: 'grammar' },
  { pattern: /\bweve\b/gi, replace: "we've", kind: 'grammar' },
  { pattern: /\blets\b/gi, replace: "let's", kind: 'grammar' },
  { pattern: /\bthats\b/gi, replace: "that's", kind: 'grammar' },
  { pattern: /\bwhats\b/gi, replace: "what's", kind: 'grammar' },
  { pattern: /\bwhos\b/gi, replace: "who's", kind: 'grammar' },

  // Spelling dictionary
  ...SPELLINGS.map(([pattern, replace]) => ({ pattern, replace, kind: 'spelling' as const })),
];

function preserveCase(original: string, replacement: string): string {
  if (!original) return replacement;
  if (original === original.toUpperCase() && /[A-Za-z]/.test(original)) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(original) && replacement.length > 0) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function applyCaptureReplace(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\d+)/g, (_, n: string) => {
    const idx = Number(n);
    const part = match[idx] ?? '';
    return part;
  });
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function pushSpan(
  found: WritingSpanSuggestion[],
  span: WritingSpanSuggestion,
  max: number,
): boolean {
  if (found.some((s) => overlaps(s.start, s.end, span.start, span.end))) return false;
  if (span.original === span.suggestion) return false;
  found.push(span);
  return found.length >= max;
}

function addPunctuationIssues(text: string, found: WritingSpanSuggestion[], max: number) {
  // Space before punctuation: "hello ," → "hello,"
  {
    const re = /\s+([,.;:!?])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        pushSpan(
          found,
          {
            id: `punctuation-space-before-${start}`,
            start,
            end,
            original: match[0],
            suggestion: match[1],
            kind: 'punctuation',
          },
          max,
        )
      )
        return;
    }
  }

  // Missing space after punctuation (not decimals / emails / urls / ellipsis)
  {
    const re = /([,.;:!?])([A-Za-z])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // Skip decimals like 3.14
      if (match[1] === '.' && /\d/.test(text[start - 1] || '') && /\d/.test(match[2])) continue;
      // Skip abbreviations like e.g. / i.e. lightly when next is lowercase after single letter
      if (match[1] === '.' && /[A-Za-z]/.test(text[start - 1] || '') && match[2] === match[2].toLowerCase()) {
        // still suggest space for sentence starts when next is uppercase — handled below
        if (match[2] === match[2].toLowerCase()) continue;
      }
      if (
        pushSpan(
          found,
          {
            id: `punctuation-space-after-${start}`,
            start,
            end,
            original: match[0],
            suggestion: `${match[1]} ${match[2]}`,
            kind: 'punctuation',
          },
          max,
        )
      )
        return;
    }
  }

  // Repeated punctuation: "!!!" → "!", "??" → "?", ".." (not "...") → "."
  {
    const re = /([!?])\1{1,}|,{2,}|\.{2}(?!\.)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const ch = match[0][0];
      if (
        pushSpan(
          found,
          {
            id: `punctuation-repeat-${start}`,
            start,
            end,
            original: match[0],
            suggestion: ch,
            kind: 'punctuation',
          },
          max,
        )
      )
        return;
    }
  }

  // Missing capitalization after sentence end: ". hello" → ". Hello"
  {
    const re = /([.!?])(\s+)([a-z])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        pushSpan(
          found,
          {
            id: `punctuation-cap-${start}`,
            start,
            end,
            original: match[0],
            suggestion: `${match[1]}${match[2]}${match[3].toUpperCase()}`,
            kind: 'punctuation',
          },
          max,
        )
      )
        return;
    }
  }

  // Leading lowercase sentence (start of text or after newline)
  {
    const re = /(^|\n)(\s*)([a-z])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        pushSpan(
          found,
          {
            id: `punctuation-start-cap-${start}`,
            start,
            end,
            original: match[0],
            suggestion: `${match[1]}${match[2]}${match[3].toUpperCase()}`,
            kind: 'punctuation',
          },
          max,
        )
      )
        return;
    }
  }

  // Missing terminal punctuation on a long single-line sentence (no .!? yet)
  {
    const trimmed = text.trim();
    if (
      trimmed.length >= 48 &&
      !/[.!?…]["')\]]*$/.test(trimmed) &&
      !trimmed.includes('\n') &&
      /[a-zA-Z]/.test(trimmed)
    ) {
      const end = text.length - (text.length - text.trimEnd().length);
      const start = Math.max(0, end - 1);
      const last = text.slice(start, end);
      if (last && !/[.!?]$/.test(last)) {
        pushSpan(
          found,
          {
            id: `punctuation-end-${end}`,
            start,
            end,
            original: last,
            suggestion: `${last}.`,
            kind: 'punctuation',
          },
          max,
        );
      }
    }
  }

}

/**
 * Grammarly-style span suggestions: spelling, grammar (is/are…), punctuation.
 */
export function getWritingSpanSuggestions(
  raw: string,
  options?: { max?: number },
): WritingSpanSuggestion[] {
  const text = String(raw || '');
  if (!text.trim()) return [];

  const found: WritingSpanSuggestion[] = [];
  const max = options?.max ?? 16;

  for (const rule of RULES) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const original = match[0];
      let replaced: string;
      if (typeof rule.replace === 'function') {
        replaced = rule.replace(original, ...(match.slice(1) as string[]));
      } else if (rule.replace.includes('$')) {
        replaced = applyCaptureReplace(rule.replace, match);
        // Preserve leading subject capitalization from the match
        if (/^[A-Z]/.test(original) && replaced.length > 0) {
          replaced = replaced.charAt(0).toUpperCase() + replaced.slice(1);
        } else if (/^[a-z]/.test(original) && replaced.length > 0) {
          replaced = replaced.charAt(0).toLowerCase() + replaced.slice(1);
        }
      } else {
        replaced = preserveCase(original, rule.replace);
      }
      if (replaced === original) continue;
      const start = match.index;
      const end = start + original.length;
      if (
        pushSpan(
          found,
          {
            id: `${rule.kind}-${start}-${end}`,
            start,
            end,
            original,
            suggestion: replaced,
            kind: rule.kind,
          },
          max,
        )
      ) {
        return found.sort((a, b) => a.start - b.start);
      }
    }
  }

  // Standalone lowercase "i" → "I"
  {
    const re = /\bi\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + 1;
      if (
        pushSpan(
          found,
          {
            id: `grammar-i-${start}`,
            start,
            end,
            original: 'i',
            suggestion: 'I',
            kind: 'grammar',
          },
          max,
        )
      )
        break;
    }
  }

  // Double spaces
  {
    const re = / {2,}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (
        pushSpan(
          found,
          {
            id: `punctuation-spaces-${start}`,
            start,
            end,
            original: match[0],
            suggestion: ' ',
            kind: 'punctuation',
          },
          max,
        )
      )
        break;
    }
  }

  if (found.length < max) {
    addPunctuationIssues(text, found, max);
  }

  return found.sort((a, b) => a.start - b.start).slice(0, max);
}

export function applyWritingSpan(
  text: string,
  span: Pick<WritingSpanSuggestion, 'start' | 'end' | 'suggestion'>,
): string {
  return text.slice(0, span.start) + span.suggestion + text.slice(span.end);
}

/** Nearest issue to caret. */
export function pickSpanNearCaret(
  spans: WritingSpanSuggestion[],
  caret: number,
): WritingSpanSuggestion | null {
  if (!spans.length) return null;
  const inside = spans.find((s) => caret >= s.start && caret <= s.end);
  if (inside) return inside;
  let best: WritingSpanSuggestion | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of spans) {
    const dist = caret < s.start ? s.start - caret : caret - s.end;
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  if (best && bestDist <= 18) return best;
  return null;
}

export function getWritingSuggestions(raw: string, options?: { max?: number }): WritingSuggestion[] {
  return getWritingSpanSuggestions(raw, options).map((s) => ({
    id: s.id,
    label: s.suggestion,
    original: s.original,
    suggestion: s.suggestion,
  }));
}

/** Mirror technique: caret pixel coords relative to the input/textarea. */
export function getCaretViewportRect(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number,
): { top: number; left: number; height: number } {
  const isTextArea = el instanceof HTMLTextAreaElement;
  const style = window.getComputedStyle(el);
  const div = document.createElement('div');
  const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'whiteSpace',
    'wordWrap',
    'wordBreak',
  ] as const;

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = isTextArea ? 'pre-wrap' : 'pre';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '-9999px';

  for (const prop of properties) {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  }
  if (!isTextArea) {
    div.style.width = `${el.offsetWidth}px`;
    div.style.overflow = 'hidden';
    div.style.whiteSpace = 'nowrap';
  } else {
    div.style.height = 'auto';
  }

  div.textContent = el.value.slice(0, position);
  const span = document.createElement('span');
  span.textContent = el.value.slice(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);

  const elRect = el.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const top =
    elRect.top +
    (spanRect.top - divRect.top) -
    (isTextArea ? el.scrollTop : 0) +
    parseFloat(style.borderTopWidth || '0');
  const left =
    elRect.left +
    (spanRect.left - divRect.left) -
    (isTextArea ? el.scrollLeft : 0) +
    parseFloat(style.borderLeftWidth || '0');

  document.body.removeChild(div);

  return {
    top,
    left,
    height: parseFloat(style.lineHeight) || spanRect.height || 18,
  };
}
