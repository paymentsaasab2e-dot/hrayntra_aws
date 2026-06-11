/**
 * Display-time translation for candidate-facing job text.
 * Source data in MongoDB is never modified — translations are cached in memory.
 */

const SUPPORTED = new Set(['en', 'fr']);

const translationCache = new Map();

const EXACT_PHRASES_TO_FR = new Map([
  ['Frontend Engineer', 'Ingénieur frontend'],
  ['Frontend developer', 'Développeur frontend'],
  ['Backend Engineer', 'Ingénieur backend'],
  ['Software Engineer', 'Ingénieur logiciel'],
  ['Full Stack Developer', 'Développeur full stack'],
  ['Data Scientist', 'Scientifique des données'],
  ['Product Manager', 'Chef de produit'],
  ['Project Manager', 'Chef de projet'],
  ['HR Manager', 'Responsable RH'],
  ['Data Structures', 'Structures de données'],
  ['System Design', 'Conception système'],
  ['Machine Learning', 'Apprentissage automatique'],
  ['Artificial Intelligence', 'Intelligence artificielle'],
  ['Cloud Computing', 'Informatique en nuage'],
  ['India', 'Inde'],
  ['Spain', 'Espagne'],
  ['France', 'France'],
  ['United Kingdom', 'Royaume-Uni'],
  ['UK', 'Royaume-Uni'],
  ['USA', 'États-Unis'],
  ['United States', 'États-Unis'],
  ['Maharashtra', 'Maharashtra'],
  ['Aragon', 'Aragon'],
  ['SummitSphere Media', 'SummitSphere Médias'],
  ['OrbitEdge Commerce', 'OrbitEdge Commerce'],
]);

/** Common business words in company names — brand token kept, descriptor translated. */
const COMPANY_DESCRIPTOR_FR = new Map([
  ['media', 'Médias'],
  ['commerce', 'Commerce'],
  ['solutions', 'Solutions'],
  ['technology', 'Technologie'],
  ['technologies', 'Technologies'],
  ['group', 'Groupe'],
  ['holdings', 'Participations'],
  ['services', 'Services'],
  ['consulting', 'Conseil'],
  ['partners', 'Partenaires'],
  ['industries', 'Industries'],
  ['logistics', 'Logistique'],
  ['global', 'Mondial'],
  ['international', 'International'],
  ['systems', 'Systèmes'],
  ['software', 'Logiciel'],
  ['digital', 'Numérique'],
  ['health', 'Santé'],
  ['healthcare', 'Santé'],
  ['financial', 'Financier'],
  ['finance', 'Finance'],
  ['bank', 'Banque'],
  ['banking', 'Bancaire'],
  ['labs', 'Labos'],
  ['studio', 'Studio'],
  ['studios', 'Studios'],
  ['enterprises', 'Entreprises'],
  ['enterprise', 'Entreprise'],
  ['corp', 'Corp.'],
  ['corporation', 'Société'],
  ['inc', 'Inc.'],
  ['limited', 'Limitée'],
  ['ltd', 'Ltd'],
]);

function normalizeContentLocale(value) {
  const raw = String(value || '').trim().toLowerCase();
  return SUPPORTED.has(raw) ? raw : 'en';
}

function cacheKey(text, sourceLocale, targetLocale) {
  return `${sourceLocale}|${targetLocale}|${text}`;
}

function applyExactPhraseMap(text, targetLocale) {
  if (targetLocale !== 'fr') return null;
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;
  if (EXACT_PHRASES_TO_FR.has(trimmed)) {
    return EXACT_PHRASES_TO_FR.get(trimmed);
  }
  return null;
}

function applyCompanyDescriptorTranslation(text, targetLocale) {
  if (targetLocale !== 'fr') return null;
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;

  const exact = EXACT_PHRASES_TO_FR.get(trimmed);
  if (exact) return exact;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let changed = false;
  const translatedParts = parts.map((part) => {
    const trailing = part.match(/([^\w]+)$/);
    const trailingPunct = trailing ? trailing[1] : '';
    const core = trailing ? part.slice(0, -trailingPunct.length) : part;
    const lower = core.toLowerCase();
    const mapped = COMPANY_DESCRIPTOR_FR.get(lower);
    if (mapped && parts.length > 1) {
      changed = true;
      return `${mapped}${trailingPunct}`;
    }
    return part;
  });

  return changed ? translatedParts.join(' ') : null;
}

async function fetchMyMemoryTranslation(text, sourceLocale, targetLocale) {
  const langpair = `${sourceLocale}|${targetLocale}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Translation HTTP ${response.status}`);
  }
  const payload = await response.json();
  const translated = String(payload?.responseData?.translatedText || '').trim();
  if (!translated) return text;
  return translated;
}

async function translateText(text, targetLocale, sourceLocale = 'en') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;
  if (targetLocale === sourceLocale) return trimmed;

  const key = cacheKey(trimmed, sourceLocale, targetLocale);
  if (translationCache.has(key)) {
    return translationCache.get(key);
  }

  const exact = applyExactPhraseMap(trimmed, targetLocale);
  if (exact) {
    translationCache.set(key, exact);
    return exact;
  }

  try {
    const translated = await fetchMyMemoryTranslation(trimmed, sourceLocale, targetLocale);
    translationCache.set(key, translated);
    return translated;
  } catch (error) {
    console.warn('contentTranslation: fallback to source text:', error?.message || error);
    return trimmed;
  }
}

async function translateBatch(texts, targetLocale, sourceLocale = 'en') {
  const unique = [...new Set(texts.map((text) => String(text || '').trim()).filter(Boolean))];
  const result = new Map();

  for (const text of unique) {
    result.set(text, await translateText(text, targetLocale, sourceLocale));
  }

  return result;
}

async function translateCompanyName(name, targetLocale, sourceLocale = 'en') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return trimmed;
  if (targetLocale === sourceLocale) return trimmed;

  const key = cacheKey(`company:${trimmed}`, sourceLocale, targetLocale);
  if (translationCache.has(key)) {
    return translationCache.get(key);
  }

  const descriptorMatch = applyCompanyDescriptorTranslation(trimmed, targetLocale);
  if (descriptorMatch && descriptorMatch !== trimmed) {
    translationCache.set(key, descriptorMatch);
    return descriptorMatch;
  }

  const exact = applyExactPhraseMap(trimmed, targetLocale);
  if (exact && exact !== trimmed) {
    translationCache.set(key, exact);
    return exact;
  }

  try {
    const apiTranslated = await fetchMyMemoryTranslation(trimmed, sourceLocale, targetLocale);
    const normalized = apiTranslated.trim();
    const finalText =
      normalized &&
      normalized.toLowerCase() !== trimmed.toLowerCase() &&
      !/^mymemory warning/i.test(normalized)
        ? normalized
        : descriptorMatch || trimmed;
    translationCache.set(key, finalText);
    return finalText;
  } catch (error) {
    console.warn('contentTranslation: company fallback:', error?.message || error);
    const fallback = descriptorMatch || trimmed;
    translationCache.set(key, fallback);
    return fallback;
  }
}

module.exports = {
  normalizeContentLocale,
  translateText,
  translateBatch,
  translateCompanyName,
};
