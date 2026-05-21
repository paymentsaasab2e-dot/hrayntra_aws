const LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Executive'];

function normalizeText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function countFilled(terms) {
  return Object.values(terms).filter((v) => v != null && String(v).trim() !== '').length;
}

function pickLevel(text) {
  for (const level of LEVEL_OPTIONS) {
    const re = new RegExp(`\\b${level.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(text)) return level;
  }
  const generic = text.match(/\blevel\s*([1-4]|one|two|three|four|executive)\b/i);
  if (generic) {
    const token = String(generic[1]).toLowerCase();
    const map = {
      '1': 'Level 1',
      one: 'Level 1',
      '2': 'Level 2',
      two: 'Level 2',
      '3': 'Level 3',
      three: 'Level 3',
      '4': 'Level 4',
      four: 'Level 4',
      executive: 'Executive',
    };
    return map[token] || '';
  }
  return '';
}

function pickServiceChargePercent(text) {
  const patterns = [
    /service\s*charge\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /service\s*fee\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /commission\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:service\s*charge|commission|fee)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return String(m[1]).trim();
  }
  return '';
}

function pickFreeReplacement(text) {
  const patterns = [
    /free\s*replacement\s*[:\-]?\s*(\d{1,3})\s*(months?|days?)/i,
    /replacement\s*period\s*[:\-]?\s*(\d{1,3})\s*(months?|days?)/i,
    /(\d{1,3})\s*(months?|days?)\s*free\s*replacement/i,
    /replacement\s*within\s*(\d{1,3})\s*(months?|days?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m?.[2]) {
      const value = String(m[1]).trim();
      const unitToken = String(m[2]).toLowerCase();
      const unit = unitToken.startsWith('day') ? 'DAYS' : 'MONTHS';
      return { value, unit };
    }
  }
  return { value: '', unit: 'MONTHS' };
}

function pickPaymentTerms(text) {
  const patterns = [
    /payment\s*terms?\s*[:\-]?\s*([^\n.;]{5,120})/i,
    /(?:pay(?:ment)?|fee)\s*(?:due|payable)\s*(?:after|upon|on)\s*([^\n.;]{5,120})/i,
    /after\s*(?:the\s*)?candidate\s*(?:has\s*)?join(?:ed|s)\s*([^\n.;]{0,80})/i,
    /upon\s*(?:successful\s*)?joining\s*([^\n.;]{0,80})/i,
    /client\s*(?:shall|will)\s*pay\s*([^\n.;]{5,120})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const chunk = String(m[0]).trim();
      if (chunk.length >= 5 && chunk.length <= 120) return chunk;
    }
  }
  if (/after\s*(?:the\s*)?candidate\s*join/i.test(text)) {
    return 'Payment to be made by the client after the candidate has joined';
  }
  return '';
}

function pickAdvancePaymentPercent(text) {
  const patterns = [
    /advance\s*(?:payment)?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /upfront\s*(?:payment|fee)?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*advance/i,
    /initial\s*payment\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return String(m[1]).trim();
  }
  return '';
}

/**
 * Parse commercial terms from agreement document text (regex/heuristics).
 */
export function parseAgreementTermsFromText(rawText = '') {
  const text = normalizeText(rawText);
  const replacement = pickFreeReplacement(text);

  const terms = {
    agreementLevel: pickLevel(text),
    agreementServiceChargePercent: pickServiceChargePercent(text),
    agreementTimePeriod: pickPaymentTerms(text),
    agreementAdvancePaymentPercent: pickAdvancePaymentPercent(text),
    agreementFreeReplacementValue: replacement.value,
    agreementFreeReplacementUnit: replacement.unit,
  };

  return {
    terms,
    filledCount: countFilled(terms),
    textLength: text.length,
  };
}
