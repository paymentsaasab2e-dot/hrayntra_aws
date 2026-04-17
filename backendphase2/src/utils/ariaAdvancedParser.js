function normalizeText(value) {
  return String(value || '').trim();
}

function firstDate(text) {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) {
    const mm = us[1].padStart(2, '0');
    const dd = us[2].padStart(2, '0');
    return `${us[3]}-${mm}-${dd}`;
  }
  return '';
}

function detectSource(text) {
  const lower = text.toLowerCase();
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('website') || lower.includes('web site')) return 'Website';
  if (lower.includes('referral') || lower.includes('referred')) return 'Referral';
  if (lower.includes('email')) return 'Email';
  if (lower.includes('campaign')) return 'Campaign';
  return '';
}

function detectCompany(text) {
  const cleanCompany = (value) => {
    let out = String(value || '').trim();
    out = out.replace(
      /\b(contact(?:\s+name)?|source|type|status|priority|email|phone|from)\b[\s\S]*$/i,
      ''
    );
    out = out.replace(/[,:;.\-–\s]+$/g, '').trim();
    return out;
  };

  const companyPattern = /([A-Za-z0-9&.,'\- ]{2,}(?:inc|llc|pvt|ltd|solutions))/i;
  const match = text.match(companyPattern);
  if (match?.[1]) return cleanCompany(normalizeText(match[1]));
  const leadForMatch = text.match(
    /lead\s+for\s+(.+?)(?:[\.,;]|(?:\s+(?:from|contact(?:\s+name)?|source|type|status|priority|email|phone)\b)|$)/i
  );
  if (leadForMatch?.[1]) return cleanCompany(normalizeText(leadForMatch[1]));
  return '';
}

function detectDirector(text, companyName) {
  const directorMatch = text.match(/(?:director|contact|owner|founder|ceo|cto|hr)\s*(?:name)?\s*(?:is|:)?\s*([A-Za-z][A-Za-z .'-]{2,60})/i);
  if (directorMatch?.[1]) return normalizeText(directorMatch[1]);
  const cleaned = text
    .replace(companyName, '')
    .replace(/\b(email|phone|from|source|services|value|team|location|city|country|sector)\b/gi, ' ')
    .trim();
  const tokenCandidate = cleaned.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  return tokenCandidate?.[1] ? normalizeText(tokenCandidate[1]) : '';
}

export const parseAdvancedLead = (input) => {
  const raw = normalizeText(input);
  const tokens = raw.split(/[\t,]+|\n|\s{2,}/).map((token) => token.trim()).filter(Boolean);

  const lead = {
    companyName: '',
    companyLinks: [],
    directorName: '',
    teamName: '',
    email: '',
    phone: '',
    location: '',
    city: '',
    country: '',
    sector: '',
    status: 'New',
    interestLevel: 'Medium',
    nextFollowUpAt: '',
    assignedTo: '',
    servicesNeeded: '',
    expectedBusinessValue: null,
    source: '',
    type: '',
  };

  const fullText = tokens.join(' ');
  lead.companyName = detectCompany(fullText);
  lead.source = detectSource(fullText);
  lead.nextFollowUpAt = firstDate(fullText);

  tokens.forEach((token) => {
    const t = token.toLowerCase();

    if (token.includes('@') && !lead.email) {
      lead.email = token;
      return;
    }
    if (/^\+?[\d\s()-]{8,}$/.test(token) && !lead.phone) {
      lead.phone = token.replace(/\s+/g, '');
      return;
    }
    if (/^\d{4,}$/.test(token) && lead.expectedBusinessValue == null) {
      lead.expectedBusinessValue = Number(token);
      return;
    }
    if (/https?:\/\//i.test(token)) {
      lead.companyLinks.push(token);
      return;
    }
    if (!lead.teamName && t.includes('team')) {
      lead.teamName = token;
      return;
    }
    if (!lead.location && /(street|road|avenue|tower|building|block|park|city|india|usa|uae)/i.test(token)) {
      lead.location = token;
      return;
    }
    if (!lead.companyName && (t.includes('llc') || t.includes('pvt') || t.includes('inc') || t.includes('solutions') || t.includes('ltd'))) {
      lead.companyName = token;
      return;
    }
    if (!lead.servicesNeeded && /(hire|hiring|need|recruit|staff|engineer|developer|sales|support)/i.test(token)) {
      lead.servicesNeeded = token;
    }
  });

  lead.directorName = detectDirector(fullText, lead.companyName);

  const cityMatch = fullText.match(/\b(Dubai|Mumbai|Delhi|Bangalore|Chennai|Pune|Hyderabad|London|New York|San Francisco)\b/i);
  if (cityMatch) lead.city = cityMatch[1];

  const countryMatch = fullText.match(/\b(India|UAE|United Arab Emirates|USA|United States|UK|United Kingdom|Canada|Singapore)\b/i);
  if (countryMatch) lead.country = countryMatch[1];

  if (!lead.type && lead.companyName) {
    lead.type = 'Company';
  }
  if (!lead.source) {
    lead.source = 'Website';
  }
  if (!lead.servicesNeeded) {
    const leftovers = tokens.filter((token) => token.length > 3 && !token.includes('@') && !/^\+?[\d\s()-]{8,}$/.test(token));
    lead.servicesNeeded = leftovers.slice(0, 12).join(' ');
  }

  return lead;
};

export const parseAdvancedLeadBulk = (input) => {
  const text = normalizeText(input);
  if (!text) return [];
  const rows = text.split(/\n+/).map((row) => row.trim()).filter(Boolean);
  if (rows.length <= 1) {
    return [parseAdvancedLead(text)];
  }
  return rows.map((row) => parseAdvancedLead(row));
};

export const parseLeadFromText = parseAdvancedLead;
