import type { Priority } from '@/app/leads/types';
import {
  createEmptyTeamMember,
  normalizeTeamMemberList,
  teamMemberHasAnyValue,
  type TeamMemberListItem,
} from './teamMemberFormDetails';
import { combineDMYAndTimeToISO, parseDMYToYMD } from '../utils/formatLeadDateTime';
import { resolveSalutationForName } from '../constants/salutations';
import { getCountryByCodeOrName, inferLocationFromCityName } from './cscData';

export type LeadAiGeneratedPayload = {
  companyName?: string;
  contactPerson?: string;
  directorSalutation?: string;
  designation?: string;
  email?: string;
  phone?: string;
  emails?: string[];
  phones?: string[];
  type?: string;
  source?: string;
  status?: string;
  priority?: Priority | string;
  interestedNeeds?: string;
  notes?: string;
  expectedBusinessValue?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  linkedIn?: string;
  companyLinks?: string[];
  location?: string;
  country?: string;
  city?: string;
  state?: string;
  campaignName?: string;
  campaignLink?: string;
  referralName?: string;
  sourceWebsiteUrl?: string;
  sourceLinkedInUrl?: string;
  sourceEmail?: string;
  otherDetails?: Array<{ label: string; value: string }>;
  lastFollowUp?: string;
  nextFollowUp?: string;
  assignedToId?: string;
  assignedToName?: string;
  teamMemberSalutation?: string;
  teamMemberName?: string;
  teamMemberDesignation?: string;
  teamMemberEmail?: string;
  teamMemberPhone?: string;
};

export type LeadAiInsights = {
  score: number;
  priority: Priority;
  nextAction: string;
  followUpHint: string;
  packageSuggestion: string;
};

export function buildLeadAiMissingMessage(form: {
  companyName?: string;
  email?: string;
  emails?: string[];
}): string | null {
  const missing: string[] = [];
  if (!String(form.companyName || '').trim()) missing.push('Company name');
  if (!String(form.email || '').trim()) missing.push('Valid email address');

  if (!missing.length) return null;

  return `I filled what I could. Still needed before you can create this lead: ${missing.join(', ')}. Everything else (director phone, team member, location, industry, source, follow-up, services, business value, assignee) is optional — say "that's all" when ready.`;
}

export function normalizeLeadDateTimeInput(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T09:00:00`;
  }

  const slashWithTime = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
  );
  if (slashWithTime) {
    const [, month, day, year, hour, minute, ampm] = slashWithTime;
    const dmy = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    let h = Number(hour || 9);
    const m = String(minute || '00').padStart(2, '0');
    if (ampm) {
      const upper = ampm.toUpperCase();
      if (upper === 'PM' && h < 12) h += 12;
      if (upper === 'AM' && h === 12) h = 0;
    }
    const iso = combineDMYAndTimeToISO(dmy, `${String(h).padStart(2, '0')}:${m}`);
    if (iso) return iso;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const dmy = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    const iso = combineDMYAndTimeToISO(dmy, '09:00');
    if (iso) return iso;
  }

  if (parseDMYToYMD(trimmed.replace(/-/g, '/'))) {
    const iso = combineDMYAndTimeToISO(trimmed, '09:00');
    if (iso) return iso;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return trimmed;
}

export function mergeAiCompanyLinks(
  generated: Pick<LeadAiGeneratedPayload, 'companyLinks' | 'website' | 'linkedIn' | 'sourceWebsiteUrl' | 'sourceLinkedInUrl'>,
  existingWebsite = '',
): { website: string; linkedIn: string } {
  const links = [
    ...(Array.isArray(generated.companyLinks) ? generated.companyLinks : []),
    ...(generated.website ? String(generated.website).split('\n') : []),
    ...(generated.sourceWebsiteUrl ? [generated.sourceWebsiteUrl] : []),
    ...(generated.sourceLinkedInUrl ? [generated.sourceLinkedInUrl] : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const uniqueLinks = [...new Set(links)];
  const linkedInFromLinks =
    uniqueLinks.find((url) => /linkedin\.com/i.test(url)) ||
    String(generated.linkedIn || generated.sourceLinkedInUrl || '').trim();
  const nonLinkedInLinks = uniqueLinks.filter((url) => !/linkedin\.com/i.test(url));
  const websiteFromLinks = nonLinkedInLinks.length
    ? nonLinkedInLinks.join('\n')
    : String(generated.website || generated.sourceWebsiteUrl || existingWebsite).trim();

  return {
    website: websiteFromLinks || existingWebsite,
    linkedIn: linkedInFromLinks || String(generated.linkedIn || '').trim(),
  };
}

function firstUrlMatching(links: string[], matcher: (url: string) => boolean): string {
  return links.find((url) => matcher(url)) || '';
}

export function mergeAiSourceFields(
  generated: Pick<
    LeadAiGeneratedPayload,
    | 'source'
    | 'website'
    | 'companyLinks'
    | 'linkedIn'
    | 'sourceWebsiteUrl'
    | 'sourceLinkedInUrl'
    | 'sourceEmail'
    | 'email'
    | 'referralName'
    | 'campaignName'
    | 'campaignLink'
  >,
  existing: {
    source?: string;
    sourceWebsiteUrl?: string;
    sourceLinkedInUrl?: string;
    sourceEmail?: string;
    referralName?: string;
    campaignName?: string;
    campaignLink?: string;
  },
  linkFields: { website: string; linkedIn: string },
): {
  sourceWebsiteUrl: string;
  sourceLinkedInUrl: string;
  sourceEmail: string;
  referralName: string;
  campaignName: string;
  campaignLink: string;
} {
  const allUrls = [
    ...(Array.isArray(generated.companyLinks) ? generated.companyLinks : []),
    ...String(linkFields.website || '').split('\n'),
    ...String(generated.website || '').split('\n'),
    String(generated.sourceWebsiteUrl || '').trim(),
    String(generated.sourceLinkedInUrl || '').trim(),
    String(linkFields.linkedIn || '').trim(),
    String(generated.linkedIn || '').trim(),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const primaryWebsite = firstUrlMatching(allUrls, (url) => !/linkedin\.com/i.test(url));
  const primaryLinkedIn = firstUrlMatching(allUrls, (url) => /linkedin\.com/i.test(url));
  const source = String(generated.source || existing.source || 'Website').trim();

  return {
    sourceWebsiteUrl:
      String(generated.sourceWebsiteUrl || '').trim() ||
      (source === 'Website' ? primaryWebsite : '') ||
      String(existing.sourceWebsiteUrl || '').trim(),
    sourceLinkedInUrl:
      String(generated.sourceLinkedInUrl || '').trim() ||
      (source === 'LinkedIn' ? primaryLinkedIn || primaryWebsite : '') ||
      String(existing.sourceLinkedInUrl || '').trim(),
    sourceEmail:
      String(generated.sourceEmail || '').trim() ||
      (source === 'Email' ? String(generated.email || '').trim() : '') ||
      String(existing.sourceEmail || '').trim(),
    referralName:
      String(generated.referralName || '').trim() || String(existing.referralName || '').trim(),
    campaignName:
      String(generated.campaignName || '').trim() || String(existing.campaignName || '').trim(),
    campaignLink:
      String(generated.campaignLink || '').trim() || String(existing.campaignLink || '').trim(),
  };
}

export function resolveAiDirectorFields(
  generated: Pick<LeadAiGeneratedPayload, 'directorSalutation' | 'contactPerson'>,
  existing: Pick<LeadAiGeneratedPayload, 'directorSalutation' | 'contactPerson'> = {},
): { directorSalutation: string; contactPerson: string } {
  const resolved = resolveSalutationForName(
    generated.directorSalutation || existing.directorSalutation,
    generated.contactPerson || existing.contactPerson || '',
  );

  return {
    directorSalutation: resolved.salutation,
    contactPerson: resolved.name,
  };
}

export function mergeAiTeamMembers(
  existing: TeamMemberListItem[],
  generated: Pick<
    LeadAiGeneratedPayload,
    | 'teamMemberSalutation'
    | 'teamMemberName'
    | 'teamMemberDesignation'
    | 'teamMemberEmail'
    | 'teamMemberPhone'
  >,
): TeamMemberListItem[] {
  const resolvedTeamMember = resolveSalutationForName(
    generated.teamMemberSalutation,
    generated.teamMemberName || '',
  );

  const candidate: TeamMemberListItem = {
    teamMemberSalutation: resolvedTeamMember.salutation,
    teamMemberName: resolvedTeamMember.name,
    teamMemberDesignation: String(generated.teamMemberDesignation || '').trim(),
    teamMemberEmail: String(generated.teamMemberEmail || '').trim(),
    teamMemberPhone: String(generated.teamMemberPhone || '').trim(),
  };

  if (!teamMemberHasAnyValue(candidate)) {
    return normalizeTeamMemberList(existing);
  }

  const list = normalizeTeamMemberList(existing);
  const [first, ...rest] = list;
  const firstIsEmpty = !teamMemberHasAnyValue(first || createEmptyTeamMember());
  if (firstIsEmpty) {
    return normalizeTeamMemberList([candidate, ...rest.filter((_, i) => i > 0)]);
  }

  return normalizeTeamMemberList([first, candidate, ...rest.slice(1)]);
}

function parseCommaSeparatedLocation(location: string): {
  city: string;
  state: string;
  country: string;
} {
  const parts = String(location || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      city: parts[0],
      state: parts.slice(1, -1).join(', '),
      country: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    const maybeCountry = getCountryByCodeOrName(undefined, parts[1]);
    if (maybeCountry) {
      return { city: parts[0], state: '', country: maybeCountry.name };
    }
    return { city: parts[0], state: parts[1], country: '' };
  }

  if (parts.length === 1) {
    return { city: parts[0], state: '', country: '' };
  }

  return { city: '', state: '', country: '' };
}

export function resolveAiLocationFields(
  generated: Pick<LeadAiGeneratedPayload, 'location' | 'city' | 'state' | 'country'>,
  existing: {
    location?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
): {
  location: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
} {
  const parsed = parseCommaSeparatedLocation(generated.location || '');

  const citySeed = String(generated.city || parsed.city || existing.city || '').trim();
  const stateSeed = String(generated.state || parsed.state || existing.state || '').trim();
  const countrySeed = String(generated.country || parsed.country || existing.country || '').trim();
  const locationSeed = String(generated.location || existing.location || '').trim();

  const inferred = inferLocationFromCityName(citySeed, {
    country: countrySeed,
    countryCode: existing.countryCode,
    state: stateSeed,
  });

  if (inferred) {
    return {
      location: locationSeed || inferred.location,
      city: inferred.city?.trim() || citySeed,
      state: inferred.state?.trim() || stateSeed,
      country: inferred.country?.trim() || countrySeed,
      countryCode: inferred.countryCode?.trim() || existing.countryCode || '',
      latitude: inferred.latitude ?? existing.latitude ?? null,
      longitude: inferred.longitude ?? existing.longitude ?? null,
    };
  }

  const countryRecord = getCountryByCodeOrName(existing.countryCode, countrySeed);
  const location =
    locationSeed || [citySeed, stateSeed, countryRecord?.name || countrySeed].filter(Boolean).join(', ');

  return {
    location,
    city: citySeed,
    state: stateSeed,
    country: countryRecord?.name || countrySeed,
    countryCode: countryRecord?.isoCode || existing.countryCode || '',
    latitude: existing.latitude ?? null,
    longitude: existing.longitude ?? null,
  };
}

function formatLeadAiBulletValue(value: string): string {
  const trimmed = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return trimmed;
}

const LEAD_AI_BULLET_LABEL =
  /^(Company(?:\s+Name)?|Website|Director|Team\s*Member|Location|Industry|Source|Interested\s*Needs|Services(?:\s+Needed)?|Expected(?:\s+Business)?\s*Value|Follow[- ]?Up|Next\s+Follow[- ]?Up|Assigned(?:\s+To)?|Status|Interest(?:\s+Level)?|Priority|Email|Phone|Mobile)$/i;

export type ParsedLeadAiReply = {
  intro: string;
  bullets: Array<{ label: string; value: string }>;
  outro: string;
};

export function parseLeadAiAssistantReply(content: string): ParsedLeadAiReply {
  const plain = String(content || '').trim();
  if (!plain) return { intro: '', bullets: [], outro: '' };

  let normalized = plain
    .replace(/\r\n/g, '\n')
    .replace(/\s+-\s+\*\*([^*]+)\*\*:\s*/g, '\n• $1: ')
    .replace(/\*\*([^*]+)\*\*:\s*/g, '$1: ')
    .replace(/\*\*([^*]+)\*\*/g, '$1');

  if (!normalized.includes('\n• ') && /\s+-\s+/.test(normalized)) {
    normalized = normalized.replace(/\s+-\s+/g, '\n• ');
  }

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets: Array<{ label: string; value: string }> = [];
  const otherLines: string[] = [];

  const pushBullet = (label: string, value: string) => {
    const cleanLabel = label.replace(/\*\*/g, '').trim();
    const cleanValue = formatLeadAiBulletValue(value.replace(/\*\*/g, '').trim());
    if (cleanLabel && cleanValue) bullets.push({ label: cleanLabel, value: cleanValue });
  };

  for (const line of lines) {
    const stripped = line.replace(/^[•\-–]\s*/, '').trim();
    const colonMatch = stripped.match(/^(.+?):\s*(.+)$/);
    if (colonMatch) {
      const [, label, value] = colonMatch;
      if (line.startsWith('•') || line.startsWith('-') || LEAD_AI_BULLET_LABEL.test(label.trim())) {
        pushBullet(label, value);
        continue;
      }
    }
    otherLines.push(stripped);
  }

  if (bullets.length === 0 && /\s+-\s+/.test(plain)) {
    const splitAt = plain.search(/\s+-\s+\*\*/);
    const introPart = splitAt >= 0 ? plain.slice(0, splitAt).trim() : plain.split(/\s+-\s+/)[0]?.trim() || '';
    const tail = splitAt >= 0 ? plain.slice(splitAt) : plain.slice(introPart.length);
    const parts = tail.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      const cleaned = part.replace(/\*\*([^*]+)\*\*:\s*/, '$1: ').replace(/\*\*/g, '');
      const match = cleaned.match(/^(.+?):\s*(.+)$/);
      if (match) pushBullet(match[1], match[2]);
    }

    if (bullets.length > 0) {
      const outroMatch = plain.match(/(please review[\s\S]*)$/i);
      return {
        intro: introPart.replace(/\*\*/g, '').replace(/:\s*$/, ''),
        bullets,
        outro: outroMatch ? outroMatch[1].replace(/\*\*/g, '').trim() : '',
      };
    }
  }

  if (bullets.length === 0) {
    return { intro: plain.replace(/\*\*/g, ''), bullets: [], outro: '' };
  }

  const outroIdx = otherLines.findIndex((line) => /please review|click create|when ready/i.test(line));
  if (outroIdx >= 0) {
    return {
      intro: otherLines.slice(0, outroIdx).join(' ').replace(/\*\*/g, ''),
      bullets,
      outro: otherLines.slice(outroIdx).join(' ').replace(/\*\*/g, ''),
    };
  }

  return {
    intro: (otherLines[0] || '').replace(/\*\*/g, ''),
    bullets,
    outro: otherLines.slice(1).join(' ').replace(/\*\*/g, ''),
  };
}

export function computeLeadAiInsights(
  form: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    interestedNeeds?: string;
    notes?: string;
    website?: string;
    linkedIn?: string;
    nextFollowUp?: string;
    priority?: string;
  },
  sourceText = '',
): LeadAiInsights {
  const text = `${sourceText} ${form.notes || ''} ${form.interestedNeeds || ''}`.toLowerCase();
  let score = 0;

  if (/\b(budget|lakh|crore|₹|\$|usd|inr|value|revenue|deal)\b/i.test(text) || String(form.notes || '').trim()) {
    score += 20;
  }
  if (String(form.contactPerson || '').trim()) score += 20;
  if (String(form.nextFollowUp || '').trim() || /\b(next week|tomorrow|follow up|within \d+ days?)\b/i.test(text)) {
    score += 15;
  }
  if (String(form.website || '').trim() || String(form.linkedIn || '').trim()) score += 10;
  if (String(form.email || '').trim()) score += 15;
  if (String(form.phone || '').trim()) score += 10;
  if (String(form.interestedNeeds || '').trim()) score += 10;

  score = Math.min(100, score);

  const priority: Priority = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
  const service = String(form.interestedNeeds || '').trim() || 'recruitment services';

  return {
    score,
    priority,
    nextAction: service.toLowerCase().includes('ats')
      ? 'Schedule ATS demo'
      : 'Schedule discovery call',
    followUpHint: String(form.nextFollowUp || '').trim()
      ? `Follow up on ${form.nextFollowUp}`
      : 'Contact within 3 business days',
    packageSuggestion: service.toLowerCase().includes('ats')
      ? 'ATS + bulk CV module'
      : `${service} package`,
  };
}
