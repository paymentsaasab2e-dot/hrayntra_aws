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

export function patchPhase1SnapshotPersonalInfo(snapshot, profile) {
  if (!snapshot || typeof snapshot !== 'object' || !profile) return snapshot;
  const personalInfo = { ...(snapshot.personalInfo || {}) };

  if (!String(personalInfo.employment || '').trim() && profile.employmentStatus) {
    personalInfo.employment = mapEmploymentLabel(profile.employmentStatus);
  }
  if (!String(personalInfo.nationality || '').trim() && profile.nationality) {
    personalInfo.nationality = String(profile.nationality).trim();
  }
  if (!String(personalInfo.passportNumber || '').trim() && profile.passportNumber) {
    personalInfo.passportNumber = String(profile.passportNumber).trim();
  }
  if (!String(personalInfo.address || '').trim() && profile.address) {
    personalInfo.address = String(profile.address).trim();
  }
  if (!String(personalInfo.gender || '').trim() && profile.gender) {
    personalInfo.gender = mapGenderLabel(profile.gender);
  }
  if (!String(personalInfo.dob || '').trim() && profile.dateOfBirth) {
    personalInfo.dob = new Date(profile.dateOfBirth).toISOString().split('T')[0];
  }
  if (!String(personalInfo.linkedinUrl || '').trim() && profile.linkedinUrl) {
    personalInfo.linkedinUrl = String(profile.linkedinUrl).trim();
  }

  return {
    ...snapshot,
    personalInfo,
  };
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

/** Backfill missing Phase 1 basic-info fields from the live job-portal profile row. */
export async function hydratePhase1SnapshotPersonalInfoFromPortal(candidate, portalClient) {
  if (!candidate?.id || !portalClient?.candidateProfile?.findUnique) return candidate;

  const resolved = resolveSnapshotFromCandidate(candidate);
  if (!resolved) return candidate;
  if (!personalInfoNeedsHydration(resolved.snapshot.personalInfo)) return candidate;

  try {
    const profile = await portalClient.candidateProfile.findUnique({
      where: { candidateId: String(candidate.id) },
    });
    if (!profile) return candidate;

    const patchedSnapshot = patchPhase1SnapshotPersonalInfo(resolved.snapshot, profile);
    if (resolved.container === 'extraData') {
      candidate.extraData = {
        ...resolved.extra,
        phase1ProfileSnapshot: patchedSnapshot,
      };
    }
    candidate.profileSnapshot = patchedSnapshot;
  } catch (err) {
    console.warn(
      '[phase1SnapshotHydrate] failed for candidate',
      candidate.id,
      err?.message || err,
    );
  }

  return candidate;
}
