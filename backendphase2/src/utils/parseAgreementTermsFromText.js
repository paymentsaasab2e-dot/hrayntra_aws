const LEVEL_OPTIONS = ['All levels', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Executive'];

/** Map recruitment agreement tier labels (Entry/Middle/Top) to form level options. */
const DOCUMENT_TIER_TO_LEVEL = [
  { pattern: /entry\s*level/i, level: 'Level 1' },
  { pattern: /middle\s*level/i, level: 'Level 2' },
  { pattern: /top\s*level/i, level: 'Level 3' },
];

const ALL_LEVELS_FEE_RE =
  /(?:for|across|at|to|of)\s+all\s+levels?\b|\ball\s+levels?\b|\bany\s+level\b|\ball\s+grades?\b/i;

function hasAllLevelsFeeLanguage(text = '') {
  return ALL_LEVELS_FEE_RE.test(String(text || ''));
}

function firstPercentIn(text = '') {
  const match = String(text || '').match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/);
  return match?.[1] ? String(match[1]).trim() : '';
}

function todayIsoDate() {
  const now = new Date();
  return padIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addDurationToIsoDate(startIso, count, unit) {
  const parts = String(startIso || '').split('-').map((part) => Number(part));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return '';
  const [year, month, day] = parts;
  const endDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(endDate.getTime()) || count <= 0) return '';
  if (String(unit || '').toLowerCase().startsWith('year')) {
    endDate.setUTCFullYear(endDate.getUTCFullYear() + count);
  } else {
    endDate.setUTCMonth(endDate.getUTCMonth() + count);
  }
  return endDate.toISOString().slice(0, 10);
}

function normalizeText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function countFilled(terms) {
  return Object.values(terms).filter((v) => v != null && String(v).trim() !== '').length;
}

function professionalFeesSection(text) {
  const match = text.match(
    /professional\s*fees?[\s\S]{0,1800}?(?=payment\s*terms|background\s*verification|time\s*frame|replacement\s*:|validity\s*:|$)/i,
  );
  return match ? match[0] : text;
}

/**
 * Extract Entry / Middle / Top tier table (e.g. 8.33%, 10%, 12%).
 * Defaults to Middle Level (Level 2, 10%) when multiple tiers exist.
 */
function pickFeeTierLevelAndCharge(text) {
  const block = professionalFeesSection(text);
  if (hasAllLevelsFeeLanguage(block)) {
    return {
      agreementLevel: 'All levels',
      agreementServiceChargePercent: firstPercentIn(block) || firstPercentIn(text),
    };
  }
  const tiers = [];

  for (const tier of DOCUMENT_TIER_TO_LEVEL) {
    const row = block.match(
      new RegExp(
        `${tier.pattern.source}[^\\d%]{0,120}?(\\d{1,2}(?:\\.\\d{1,2})?)\\s*%`,
        'i',
      ),
    );
    if (row?.[1]) {
      tiers.push({
        level: tier.level,
        percent: String(row[1]).trim(),
      });
    }
  }

  if (!tiers.length) {
    const percents = [...block.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) => m[1]);
    if (percents.length >= 3) {
      tiers.push(
        { level: 'Level 1', percent: percents[0] },
        { level: 'Level 2', percent: percents[1] },
        { level: 'Level 3', percent: percents[2] },
      );
    }
  }

  if (!tiers.length) return { agreementLevel: '', agreementServiceChargePercent: '' };

  const preferred =
    tiers.find((t) => t.level === 'Level 2') ||
    tiers.find((t) => t.level === 'Level 3') ||
    tiers[0];

  return {
    agreementLevel: preferred.level,
    agreementServiceChargePercent: preferred.percent,
  };
}

function pickLevel(text) {
  if (hasAllLevelsFeeLanguage(professionalFeesSection(text)) || hasAllLevelsFeeLanguage(text)) {
    return 'All levels';
  }

  const tier = pickFeeTierLevelAndCharge(text);
  if (tier.agreementLevel) return tier.agreementLevel;

  for (const level of LEVEL_OPTIONS) {
    if (level === 'All levels') continue;
    const re = new RegExp(`\\b${level.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (!re.test(text)) continue;
    if (level === 'Executive' && /senior\s+executive/i.test(text)) continue;
    return level;
  }

  const generic = text.match(/\blevel\s*([1-4]|one|two|three|four)\b/i);
  if (generic && !hasAllLevelsFeeLanguage(text)) {
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
    };
    return map[token] || '';
  }

  return '';
}

function pickServiceChargePercent(text) {
  const tier = pickFeeTierLevelAndCharge(text);
  if (tier.agreementServiceChargePercent) return tier.agreementServiceChargePercent;

  const block = professionalFeesSection(text);
  const patterns = [
    /service\s*charges?\s*(?:will\s*be\s*|are\s*)?(?:as\s*)?(?:below\s*)?[^%]{0,40}?(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /service\s*charge\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /service\s*fee\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /professional\s*fees?\s*(?:of|at|:|-)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /commission\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:of\s*(?:the\s*)?(?:annual|ctc|gross|candidate)|service\s*charge|commission|fee)/i,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m?.[1]) return String(m[1]).trim();
  }
  return '';
}

function pickFreeReplacement(text) {
  const patterns = [
    /(?:leaving|left)\s*within\s*(\d{1,3})\s*(months?|days?)\s*(?:from|of)\s*(?:the\s*)?(?:date\s*of\s*)?joining/i,
    /(?:free\s*)?replacement[^.]{0,80}?within\s*(\d{1,3})\s*(months?|days?)/i,
    /(?:guarantee|warranty)[^.]{0,80}?within\s*(\d{1,3})\s*(months?|days?)/i,
    /free\s*(?:of\s*)?cost[^.]{0,80}?within\s*(\d{1,3})\s*(months?|days?)/i,
    /re-?\s*conduct\s*the\s*search[^.]{0,120}?within\s*(\d{1,3})\s*(months?|days?)/i,
    /free\s*replacement\s*[:\-]?\s*(\d{1,3})\s*(months?|days?)/i,
    /replacement\s*(?:period|guarantee|warranty)\s*[:\-]?\s*(\d{1,3})\s*(months?|days?)/i,
    /(?:replacement\s*)?guarantee\s*(?:period|of)?\s*[:\-]?\s*(\d{1,3})\s*(months?|days?)/i,
    /(\d{1,3})\s*(months?|days?)\s*free\s*replacement/i,
    /replacement\s*within\s*(\d{1,3})\s*(months?|days?)/i,
    /(\d{1,3})\s*(months?|days?)\s*(?:free\s*)?(?:replacement|guarantee|warranty)/i,
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
    /professional\s*fee\s*is\s*payable[^.\n]{5,200}/i,
    /payment\s*terms?\s*[:\-]?\s*([^\n.;]{5,200})/i,
    /(?:pay(?:ment)?|fee)\s*(?:is\s*)?(?:due|payable)\s*within\s*[^.\n]{5,200}/i,
    /within\s*\d{1,3}\s*days?\s*(?:from|of)\s*(?:the\s*)?(?:date\s*of\s*)?(?:candidate\s*)?joining[^.\n]{0,100}/i,
    /(?:pay(?:ment)?|fee)\s*(?:due|payable)\s*(?:after|upon|on)\s*[^.\n]{5,120}/i,
    /after\s*(?:the\s*)?candidate\s*(?:has\s*)?join(?:ed|s)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      let chunk = String(m[1] != null ? m[0].replace(/^payment\s*terms?\s*[:\-]?\s*/i, '') : m[0]).trim();
      chunk = chunk.replace(/\s+/g, ' ').replace(/[.;]+$/, '').trim();
      if (chunk.length >= 10 && chunk.length <= 220) return chunk;
    }
  }
  if (/payable\s*within\s*\d{1,3}\s*days?\s*from\s*(?:the\s*)?date\s*of\s*joining/i.test(text)) {
    return 'Professional fee is payable within 30 days from the date of joining by the candidate';
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

function wordOrNumberToCount(token) {
  const raw = String(token || '').trim().toLowerCase();
  const words = { one: 1, two: 2, three: 3, six: 6, twelve: 12 };
  if (words[raw] != null) return words[raw];
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickContractValiditySummary(text) {
  const patterns = [
    /valid\s*for\s*(?:a\s*)?period\s*of\s*(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
    /(?:shall\s*)?remain\s*(?:in\s*force|valid)\s*for\s*(?:a\s*)?(?:period\s*of\s*)?(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
    /contract\s*will\s*be\s*valid\s*for\s*(?:a\s*)?period\s*of\s*(\d{1,3})\s*(months?|years?)/i,
    /validity\s*[:\-]?\s*[^.]{0,120}?(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m?.[2]) {
      const count = wordOrNumberToCount(m[1]) || m[1];
      const unit = String(m[2]).toLowerCase().startsWith('year') ? 'years' : 'months';
      return `${count} ${unit} from contract signing date`;
    }
  }
  return '';
}

const MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function padIsoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toIsoDate(token) {
  const raw = String(token || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  const isoDateTime = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoDateTime) return padIsoDate(isoDateTime[1], isoDateTime[2], isoDateTime[3]);

  const directIso = normalized.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (directIso) return padIsoDate(directIso[1], directIso[2], directIso[3]);

  const dmy = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return padIsoDate(dmy[3], dmy[2], dmy[1]);

  const dayMonthYear = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYear) {
    const month = MONTH_INDEX[String(dayMonthYear[2]).toLowerCase()];
    if (month) return padIsoDate(dayMonthYear[3], month, dayMonthYear[1]);
  }

  const monthDayYear = normalized.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);
  if (monthDayYear) {
    const month = MONTH_INDEX[String(monthDayYear[1]).toLowerCase()];
    if (month) return padIsoDate(monthDayYear[3], month, monthDayYear[2]);
  }

  const dayOfMonth = normalized.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+),?\s+(\d{4})$/i,
  );
  if (dayOfMonth) {
    const month = MONTH_INDEX[String(dayOfMonth[2]).toLowerCase()];
    if (month) return padIsoDate(dayOfMonth[3], month, dayOfMonth[1]);
  }

  return '';
}

function pickAgreementDates(text) {
  const dateToken =
    '(?:\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\s+\\d{4}|[A-Za-z]{3,9}\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+\\d{4})';

  let start = '';
  let end = '';

  const range = text.match(
    new RegExp(
      `(?:valid|period|term|agreement)[^\\n]{0,40}?(?:from|between)\\s+(${dateToken})\\s+(?:to|till|until|and)\\s+(${dateToken})`,
      'i',
    ),
  );
  if (range?.[1] && range?.[2]) {
    start = toIsoDate(range[1]) || start;
    end = toIsoDate(range[2]) || end;
  }

  const madeOn = text.match(
    /made\s+(?:on\s+)?(?:this\s+)?(\d{1,2}(?:st|nd|rd|th)?)\s+day\s+of\s+([A-Za-z]+),?\s+(\d{4})/i,
  );
  if (madeOn) {
    start = toIsoDate(`${madeOn[1]} day of ${madeOn[2]} ${madeOn[3]}`) || start;
  }

  const startPatterns = [
    new RegExp(`(?:start\\s*date|effective\\s*date|commencement\\s*date|entering\\s*the\\s*contract)\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
    new RegExp(`valid\\s*from\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
    new RegExp(`date\\s*of\\s*entering\\s*the\\s*contract\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
    new RegExp(`(?:this\\s+)?agreement\\s+dated\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
  ];
  const endPatterns = [
    new RegExp(`(?:end\\s*date|expiry\\s*date|expiration\\s*date|termination\\s*date)\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
    new RegExp(`valid\\s*(?:till|until|to)\\s*[:\\-]?\\s*(${dateToken})`, 'i'),
  ];

  for (const re of startPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const parsed = toIsoDate(m[1]);
      if (parsed) {
        start = parsed;
        break;
      }
    }
  }
  for (const re of endPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const parsed = toIsoDate(m[1]);
      if (parsed) {
        end = parsed;
        break;
      }
    }
  }

  const validityDuration =
    text.match(
      /(?:contract|agreement)\s+will\s+be\s+valid\s+for\s+(?:a\s+)?period\s+of\s+(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
    ) ||
    text.match(
      /valid\s+for\s+(?:a\s+)?period\s+of\s+(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
    ) ||
    text.match(
      /(?:shall\s*)?remain\s*(?:in\s*force|valid)\s*for\s*(?:a\s*)?(?:period\s*of\s*)?(one|two|three|six|twelve|1|12|\d{1,3})\s*(?:\(\s*\d+\s*\)\s*)?(months?|years?)/i,
    );
  if (validityDuration) {
    const count = wordOrNumberToCount(validityDuration[1]);
    const unit = String(validityDuration[2] || '').toLowerCase();
    if (count > 0) {
      if (!start) start = todayIsoDate();
      if (!end) end = addDurationToIsoDate(start, count, unit);
    }
  }

  return { start, end };
}

/**
 * Parse commercial terms from agreement document text (regex/heuristics).
 */
export function parseAgreementTermsFromText(rawText = '') {
  const text = normalizeText(rawText);
  const tier = pickFeeTierLevelAndCharge(text);
  const replacement = pickFreeReplacement(text);
  const dates = pickAgreementDates(text);
  const validitySummary = pickContractValiditySummary(text);

  const terms = {
    agreementLevel: tier.agreementLevel || pickLevel(text),
    agreementServiceChargePercent: tier.agreementServiceChargePercent || pickServiceChargePercent(text),
    agreementContractValidity:
      validitySummary ||
      (dates.start || dates.end ? [dates.start, dates.end].filter(Boolean).join(' to ') : ''),
    agreementContractStartDate: dates.start,
    agreementContractEndDate: dates.end,
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
