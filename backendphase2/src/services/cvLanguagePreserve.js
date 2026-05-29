/** When true (default), parsed text fields are stored in the CV's language — never auto-translated to English. */
export function cvParsePreserveSourceLanguage() {
  const raw = process.env.CV_PARSE_PRESERVE_SOURCE_LANGUAGE;
  if (raw == null || String(raw).trim() === '') return true;
  const v = String(raw).trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

const LANG_MARKERS = {
  en: /\b(the|and|with|your|experience|skills|education|years?\s+of)\b/giu,
  es: /\b(el|la|los|con|experiencia|habilidades|educación|formación|años?\s+de)\b/giu,
  fr: /\b(le|la|les|et|avec|expérience|compétences|formation|années?\s+d')\b/giu,
  de: /\b(und|mit|berufserfahrung|kenntnisse|ausbildung|jahre)\b/giu,
  it: /\b(il|la|e|con|esperienza|competenze|istruzione|anni?\s+di)\b/giu,
  pt: /\b(e|com|experiência|habilidades|formação|anos?\s+de)\b/giu,
};

const ISO_LANG = /^(en|es|fr|de|it|pt|nl|ar|hi)$/;

/**
 * Lightweight heuristic on resume text (used when the LLM omits sourceLanguage).
 */
export function detectCvDocumentLanguage(text = '') {
  const sample = String(text || '').slice(0, 28000);
  if (!sample.trim()) return 'unknown';

  let best = 'unknown';
  let bestScore = 0;
  for (const [code, rx] of Object.entries(LANG_MARKERS)) {
    const count = (sample.match(rx) || []).length;
    if (count > bestScore) {
      bestScore = count;
      best = code;
    }
  }
  return bestScore >= 3 ? best : 'unknown';
}

export function normalizeSourceLanguageCode(value) {
  const code = String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return ISO_LANG.test(code) ? code : '';
}

export function resolveCvSourceLanguage(aiParsed, cleanedText = '') {
  const fromAi = normalizeSourceLanguageCode(aiParsed?.sourceLanguage);
  if (fromAi) return fromAi;
  const detected = detectCvDocumentLanguage(cleanedText);
  return detected === 'unknown' ? 'en' : detected;
}

/** Notice period label in the document language when only day count is known. */
export function formatNoticePeriodInLanguage(days, sourceLanguage = 'en') {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return '';
  const lang = normalizeSourceLanguageCode(sourceLanguage) || 'en';
  if (lang === 'es') return `${n} días`;
  if (lang === 'fr') return `${n} jours`;
  if (lang === 'de') return `${n} Tage`;
  if (lang === 'it') return `${n} giorni`;
  if (lang === 'pt') return `${n} dias`;
  return `${n} days`;
}

export function buildCvLanguagePreservePromptBlock() {
  if (!cvParsePreserveSourceLanguage()) {
    return `
OUTPUT LANGUAGE:
- Translate all free-text fields (summary, skills, responsibilities, education titles, job titles) into English before returning JSON.
`;
  }
  return `
LANGUAGE PRESERVATION (required — do not translate):
- Detect the primary language of the resume and set sourceLanguage to ISO 639-1 (en, es, fr, de, it, pt, etc.).
- Store every text field in that same language: summary, workHistory, skills[], certifications[], honoursAndAwards[], educationEntries (qualification, instituteName), workExperienceEntries (title, company, location, responsibilities, endDate when ongoing).
- Spanish CV → Spanish output. French CV → French output. English CV → English output.
- NEVER translate to English (or any other language) unless the entire CV is written in that language.
- Ongoing roles: endDate in CV language (Present / Actualidad / Présent / Heute / Attuale), not forced English.
- languageProficiency[] lists spoken languages as written on the CV.
- Only emails, phones, and URLs stay language-neutral.
`;
}
