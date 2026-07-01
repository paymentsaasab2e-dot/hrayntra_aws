import { normalizePortfolioLinksForCommon } from './portfolioLinkFilter.util.js';
import { pickRecruiterCvExtraFields } from './candidateRecruiterCvExtra.util.js';

function mapGenderLabel(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'MALE') return 'Male';
  if (raw === 'FEMALE') return 'Female';
  if (raw === 'OTHER') return 'Other';
  return String(value || '').trim();
}

function mapEmploymentLabel(status) {
  const map = {
    EMPLOYED: 'Employed',
    UNEMPLOYED: 'Unemployed',
    FREELANCING: 'Freelancing',
    STUDENT: 'Student',
    OTHER: 'Other',
  };
  return map[String(status || '').trim().toUpperCase()] || String(status || '').trim();
}

function personalInfoNeedsHydration(personalInfo) {
  if (!personalInfo || typeof personalInfo !== 'object') return true;
  return (
    !String(personalInfo.employment || '').trim() ||
    !String(personalInfo.nationality || '').trim() ||
    !String(personalInfo.passportNumber || '').trim() ||
    !String(personalInfo.address || '').trim()
  );
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: null, middleName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], middleName: null, lastName: null };
  if (parts.length === 2) return { firstName: parts[0], middleName: null, lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function pickPortalValue(portalValue, existingValue) {
  const portal = String(portalValue || '').trim();
  if (portal) return portal;
  return String(existingValue || '').trim() || null;
}

function resolveLinkedInFromPortfolioSources(snapshot, candidate) {
  const direct = String(snapshot?.personalInfo?.linkedinUrl || candidate?.linkedIn || '').trim();
  if (direct) return direct;

  const lists = [
    ...(Array.isArray(snapshot?.portfolioLinks) ? snapshot.portfolioLinks : []),
    ...(Array.isArray(candidate?.cvPortfolioLinks) ? candidate.cvPortfolioLinks : []),
  ];

  for (const link of lists) {
    const url = String(link?.url || '').trim();
    if (!url) continue;
    const host = url.replace(/^https?:\/\//i, '').toLowerCase();
    if (host === 'gmail.com' || host === 'b.com') continue;
    const type = String(link?.linkType || link?.type || link?.title || '').toLowerCase();
    if (type.includes('linkedin') || /linkedin\.com/i.test(url)) return url;
  }

  return '';
}

function patchSnapshotAddressFromCandidate(candidate, profile, personalInfo) {
  const fromProfile = String(profile?.address || '').trim();
  if (fromProfile) return fromProfile;
  return String(candidate?.addressLine || candidate?.address || personalInfo?.address || '').trim();
}

function isPhase1LinkedCandidate(candidate) {
  const source = String(candidate?.source || '').trim().toLowerCase();
  if (source === 'phase1') return true;
  if (candidate?.isPhase1Candidate === true) return true;
  const extra =
    candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  if (extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object') return true;
  if (candidate?.profileSnapshot && typeof candidate.profileSnapshot === 'object') return true;
  return false;
}

export function patchPhase1SnapshotPersonalInfo(snapshot, profile, { preferPortal = false } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !profile) return snapshot;
  const personalInfo = { ...(snapshot.personalInfo || {}) };
  const apply = (key, value) => {
    if (!value) return;
    const next = String(value).trim();
    if (!next) return;
    if (preferPortal || !String(personalInfo[key] || '').trim()) {
      personalInfo[key] = next;
    }
  };

  if (profile.employmentStatus) {
    apply('employment', mapEmploymentLabel(profile.employmentStatus));
  }
  apply('nationality', profile.nationality);
  apply('passportNumber', profile.passportNumber);
  apply('address', profile.address);
  if (profile.gender) apply('gender', mapGenderLabel(profile.gender));
  if (profile.dateOfBirth) {
    apply('dob', new Date(profile.dateOfBirth).toISOString().split('T')[0]);
  }
  apply('linkedinUrl', profile.linkedinUrl);
  apply('email', profile.email);
  apply('phone', profile.phoneNumber);
  apply('city', profile.city);
  apply('country', profile.country);
  if (profile.profilePhotoUrl) apply('profilePhotoUrl', profile.profilePhotoUrl);

  if (!String(personalInfo.nationality || '').trim()) {
    const countryFallback =
      String(personalInfo.country || '').trim() || String(profile.country || '').trim();
    if (countryFallback) personalInfo.nationality = countryFallback;
  }

  const fromName = splitFullName(profile.fullName);
  if (fromName.firstName) apply('firstName', fromName.firstName);
  if (fromName.middleName) apply('middleName', fromName.middleName);
  if (fromName.lastName) apply('lastName', fromName.lastName);

  return {
    ...snapshot,
    personalInfo,
  };
}

/** Prefer live job-portal profile over stale candidatecommon snapshot (production sync lag). */
export function mergeLivePortalProfileIntoSnapshot(snapshot, profile) {
  return patchPhase1SnapshotPersonalInfo(snapshot || { personalInfo: {} }, profile, {
    preferPortal: true,
  });
}

function applyPortalScalarsToCandidate(candidate, profile) {
  const fromName = splitFullName(profile.fullName);
  if (fromName.firstName) candidate.firstName = fromName.firstName;
  if (fromName.middleName) candidate.middleName = fromName.middleName;
  if (fromName.lastName) candidate.lastName = fromName.lastName;

  const email = String(profile.email || '').trim();
  if (email) candidate.email = email;

  const phone = String(profile.phoneNumber || '').trim();
  if (phone) candidate.phone = phone;

  const city = String(profile.city || '').trim();
  if (city) candidate.city = city;

  const country = String(profile.country || '').trim();
  if (country) candidate.country = country;

  const address = String(profile.address || candidate.addressLine || candidate.address || '').trim();
  if (address) {
    candidate.address = address;
    candidate.addressLine = address;
  }

  if (profile.employmentStatus) {
    candidate.employmentStatus = profile.employmentStatus;
  }
  if (profile.passportNumber) {
    candidate.passportNumber = String(profile.passportNumber).trim();
  }
  if (profile.nationality) {
    candidate.nationality = String(profile.nationality).trim();
  } else if (country && !String(candidate.nationality || '').trim()) {
    candidate.nationality = country;
  }

  if (profile.gender) candidate.gender = mapGenderLabel(profile.gender);
  if (profile.dateOfBirth) {
    candidate.dateOfBirth = new Date(profile.dateOfBirth);
  }

  const linkedin = String(profile.linkedinUrl || '').trim();
  if (linkedin) candidate.linkedIn = linkedin;

  const extra =
    candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  if (extra.cvEditorContentSaved !== true) {
    const photo = String(profile.profilePhotoUrl || '').trim();
    if (photo) candidate.avatar = photo;
  }

  const location = [city, country].filter(Boolean).join(', ');
  if (location) candidate.location = location;
}

function normalizePortalProfileDoc(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const readDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return value;
    if (value.$date) return value.$date;
    return null;
  };

  return {
    fullName: doc.fullName || doc.full_name || '',
    email: doc.email || '',
    phoneNumber: doc.phoneNumber || doc.phone_number || null,
    profilePhotoUrl: doc.profilePhotoUrl || doc.profile_photo_url || null,
    gender: doc.gender || null,
    dateOfBirth: readDate(doc.dateOfBirth || doc.date_of_birth),
    address: doc.address || null,
    city: doc.city || null,
    country: doc.country || null,
    nationality: doc.nationality || null,
    passportNumber: doc.passportNumber || doc.passport_number || null,
    linkedinUrl: doc.linkedinUrl || doc.linkedin_url || null,
    employmentStatus: doc.employmentStatus || doc.employment_status || null,
  };
}

/** Live portfolio links from job-portal Mongo (source of truth for Phase 1). */
async function fetchPortalPortfolioLinksRaw(portalClient, candidateId) {
  const idStr = String(candidateId || '').trim();
  if (!idStr || !portalClient) return null;

  if (portalClient.candidatePortfolioLinks?.findUnique) {
    try {
      const row = await portalClient.candidatePortfolioLinks.findUnique({
        where: { candidateId: idStr },
      });
      if (row?.links) return row.links;
    } catch {
      /* fall through to raw */
    }
  }

  if (!portalClient.$runCommandRaw) return null;

  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);
  const filters = isObjectIdHex
    ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
    : [{ candidateId: idStr }];

  for (const filter of filters) {
    try {
      const result = await portalClient.$runCommandRaw({
        find: 'candidate_portfolio_links',
        filter,
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      if (doc?.links) return doc.links;
    } catch {
      /* try next filter */
    }
  }

  return null;
}

/** Job-portal Prisma on backendphase2 may not expose CandidateProfile — read Mongo directly. */
async function fetchPortalCandidateProfileRaw(portalClient, candidateId) {
  const idStr = String(candidateId || '').trim();
  if (!idStr || !portalClient) return null;

  if (portalClient.candidateProfile?.findUnique) {
    try {
      const row = await portalClient.candidateProfile.findUnique({
        where: { candidateId: idStr },
      });
      if (row) return row;
    } catch {
      /* fall through to raw */
    }
  }

  if (!portalClient.$runCommandRaw) return null;

  const isObjectIdHex = /^[a-fA-F0-9]{24}$/.test(idStr);
  const filters = isObjectIdHex
    ? [{ candidateId: { $oid: idStr } }, { candidateId: idStr }]
    : [{ candidateId: idStr }];

  for (const filter of filters) {
    try {
      const result = await portalClient.$runCommandRaw({
        find: 'candidate_profiles',
        filter,
        limit: 1,
      });
      const doc = result?.cursor?.firstBatch?.[0];
      const normalized = normalizePortalProfileDoc(doc);
      if (normalized) return normalized;
    } catch {
      /* try next filter */
    }
  }

  return null;
}

function resolveSnapshotFromCandidate(candidate) {
  const extra =
    candidate?.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
      ? candidate.extraData
      : {};
  if (extra.phase1ProfileSnapshot && typeof extra.phase1ProfileSnapshot === 'object') {
    return { container: 'extraData', extra, snapshot: extra.phase1ProfileSnapshot };
  }
  if (candidate?.profileSnapshot && typeof candidate.profileSnapshot === 'object') {
    return { container: 'profileSnapshot', extra, snapshot: candidate.profileSnapshot };
  }
  return null;
}

/**
 * Overlay the live job-portal CandidateProfile onto CRM drawer data.
 * Fixes production lag when candidatecommon has not been re-synced yet.
 */
export async function overlayLivePortalProfileOnCandidate(candidate, portalClient) {
  if (!candidate?.id || !portalClient) return candidate;
  if (!isPhase1LinkedCandidate(candidate)) return candidate;

  try {
    const profile = await fetchPortalCandidateProfileRaw(portalClient, candidate.id);
    if (!profile) return candidate;

    applyPortalScalarsToCandidate(candidate, profile);

    const resolved = resolveSnapshotFromCandidate(candidate);
    const baseSnapshot = resolved?.snapshot || { personalInfo: {} };
    let patchedSnapshot = mergeLivePortalProfileIntoSnapshot(baseSnapshot, profile);

    const address = patchSnapshotAddressFromCandidate(
      candidate,
      profile,
      patchedSnapshot.personalInfo || {},
    );
    if (address) {
      patchedSnapshot = {
        ...patchedSnapshot,
        personalInfo: {
          ...(patchedSnapshot.personalInfo || {}),
          address,
        },
      };
    }

    const livePortfolioRaw = await fetchPortalPortfolioLinksRaw(portalClient, candidate.id);
    const livePortfolioLinks = normalizePortfolioLinksForCommon(
      Array.isArray(livePortfolioRaw) ? livePortfolioRaw : [],
    );
    if (livePortfolioLinks?.length) {
      patchedSnapshot = {
        ...patchedSnapshot,
        portfolioLinks: livePortfolioLinks,
      };
      candidate.cvPortfolioLinks = livePortfolioLinks;
    } else if (Array.isArray(patchedSnapshot.portfolioLinks) && patchedSnapshot.portfolioLinks.length) {
      const filtered = normalizePortfolioLinksForCommon(patchedSnapshot.portfolioLinks);
      patchedSnapshot = {
        ...patchedSnapshot,
        portfolioLinks: filtered || [],
      };
      if (filtered?.length) {
        candidate.cvPortfolioLinks = filtered;
      }
    }

    const linkedIn = resolveLinkedInFromPortfolioSources(patchedSnapshot, candidate);
    if (linkedIn) {
      candidate.linkedIn = linkedIn;
      patchedSnapshot = {
        ...patchedSnapshot,
        personalInfo: {
          ...(patchedSnapshot.personalInfo || {}),
          linkedinUrl: linkedIn,
        },
      };
    }

    const extra =
      resolved?.extra ||
      (candidate.extraData && typeof candidate.extraData === 'object' && !Array.isArray(candidate.extraData)
        ? candidate.extraData
        : {});
    const recruiterCvExtra = pickRecruiterCvExtraFields(extra);

    candidate.extraData = {
      ...extra,
      phase1ProfileSnapshot: patchedSnapshot,
      ...(profile.employmentStatus ? { employmentStatus: profile.employmentStatus } : {}),
      ...(profile.passportNumber ? { passportNumber: String(profile.passportNumber).trim() } : {}),
      ...(profile.nationality ? { nationality: String(profile.nationality).trim() } : {}),
      ...recruiterCvExtra,
    };
    candidate.profileSnapshot = patchedSnapshot;
  } catch (err) {
    console.warn(
      '[phase1SnapshotHydrate] live portal overlay failed for candidate',
      candidate.id,
      err?.message || err,
    );
  }

  return candidate;
}

/** Backfill Phase 1 basic-info from the live job-portal profile row (drawer open). */
export async function hydratePhase1SnapshotPersonalInfoFromPortal(candidate, portalClient) {
  return overlayLivePortalProfileOnCandidate(candidate, portalClient);
}
