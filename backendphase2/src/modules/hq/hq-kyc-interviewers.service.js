/**
 * HQ Employees → KYC verified interviewers.
 * Reads Phase 1 Mongo collections (job portal), not the HQ Prisma Candidate model.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';

const APPLICATIONS = 'interviewer_applications';
const PROFILES = 'interviewer_profiles';
const CANDIDATE_PROFILES = 'candidate_profiles';
const CANDIDATES = 'candidates';
const RESUMES = 'resumes';
const NOTIFICATIONS = 'notifications';

let portalClient = null;

function idStr(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.toString) return String(value.toString());
  return String(value);
}

function asObjectId(value) {
  const raw = idStr(value);
  if (!raw || !ObjectId.isValid(raw)) return null;
  try {
    return new ObjectId(raw);
  } catch {
    return null;
  }
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function evaluateKyc(candidate, profile) {
  const missing = [];
  const fullName =
    profile?.fullName || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ');
  if (!hasText(fullName)) missing.push('Full name');
  if (!profile?.dateOfBirth) missing.push('Date of birth');
  const phone = profile?.phoneNumber || candidate?.phone || candidate?.whatsappNumber;
  if (!hasText(phone)) missing.push('Phone number');
  if (!hasText(profile?.passportNumber)) missing.push('Passport / ID number');
  if (!hasText(profile?.profilePhotoUrl) && !hasText(candidate?.avatar)) missing.push('Profile photo');
  return { kycVerified: missing.length === 0, missing };
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function getPortalDb() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) {
    const err = new Error('JOB_PORTAL_DATABASE_URL is not configured');
    err.statusCode = 500;
    throw err;
  }
  if (!portalClient) {
    portalClient = new MongoClient(url);
    await portalClient.connect();
  }
  return portalClient.db();
}

function candidateIdVariants(id) {
  const str = idStr(id);
  const oid = asObjectId(str);
  return oid ? [str, oid] : [str];
}

function rememberById(map, id, doc) {
  const str = idStr(id);
  if (!str || !doc) return;
  map.set(str, doc);
  const oid = asObjectId(str);
  if (oid) map.set(idStr(oid), doc);
}

function lookupById(map, id) {
  const str = idStr(id);
  return map.get(str) || (asObjectId(str) ? map.get(idStr(asObjectId(str))) : null) || null;
}

function nested(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const value = obj[key];
    if (hasText(value)) return value;
  }
  const personal = obj.personalInfo || obj.personal_info || {};
  for (const key of keys) {
    const value = personal[key];
    if (hasText(value)) return value;
  }
  return '';
}

function pickText(...values) {
  return values.find((value) => hasText(value)) || '';
}

export const hqKycInterviewersService = {
  async listInterviewers() {
    const db = await getPortalDb();
    const [applications, profiles] = await Promise.all([
      db.collection(APPLICATIONS).find({}).sort({ updatedAt: -1 }).limit(500).toArray(),
      db.collection(PROFILES).find({}).sort({ updatedAt: -1 }).limit(500).toArray(),
    ]);

    const byCandidate = new Map();
    for (const app of applications) {
      const candidateId = idStr(app.candidateId);
      if (!candidateId) continue;
      const existing = byCandidate.get(candidateId) || {};
      const newer =
        !existing.application ||
        new Date(app.updatedAt || app.createdAt || 0).getTime() >=
          new Date(existing.application.updatedAt || existing.application.createdAt || 0).getTime();
      byCandidate.set(candidateId, {
        ...existing,
        candidateId,
        application: newer ? app : existing.application,
      });
    }
    for (const profile of profiles) {
      const candidateId = idStr(profile.candidateId);
      if (!candidateId) continue;
      const existing = byCandidate.get(candidateId) || { candidateId };
      byCandidate.set(candidateId, { ...existing, profile });
    }

    const ids = [...byCandidate.keys()];
    const idQuery = ids.flatMap((id) => candidateIdVariants(id));
    const [candidateDocs, profileDocs, resumeDocs] = ids.length
      ? await Promise.all([
          db
            .collection(CANDIDATES)
            .find({ $or: [{ _id: { $in: idQuery } }, { id: { $in: ids } }] })
            .toArray(),
          db
            .collection(CANDIDATE_PROFILES)
            .find({
              $or: [{ candidateId: { $in: idQuery } }, { candidate_id: { $in: idQuery } }],
            })
            .toArray(),
          db
            .collection(RESUMES)
            .find({
              $or: [{ candidateId: { $in: idQuery } }, { candidate_id: { $in: idQuery } }],
            })
            .toArray(),
        ])
      : [[], [], []];

    const candidateById = new Map();
    for (const row of candidateDocs) {
      rememberById(candidateById, row._id, row);
      rememberById(candidateById, row.id, row);
    }
    const profileById = new Map();
    for (const row of profileDocs) {
      rememberById(profileById, row.candidateId || row.candidate_id, row);
    }
    const resumeById = new Map();
    for (const row of resumeDocs) {
      rememberById(resumeById, row.candidateId || row.candidate_id, row);
    }

    const interviewers = [...byCandidate.values()]
      .map((row) => {
        const candidate = lookupById(candidateById, row.candidateId) || {};
        const profile = lookupById(profileById, row.candidateId) || {};
        const resume = lookupById(resumeById, row.candidateId) || {};
        const app = row.application || {};
        const interviewer = row.profile || {};
        const kyc = evaluateKyc(candidate, profile);
        const appStatus = String(app.status || '').toUpperCase();
        const profileActive =
          Boolean(row.profile) && String(interviewer.status || '').toUpperCase() !== 'INACTIVE';
        const hqVerified = appStatus === 'APPROVED' || (profileActive && appStatus !== 'REJECTED');
        const name =
          interviewer.fullName ||
          app.fullName ||
          profile.fullName ||
          [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') ||
          '—';
        return {
          id: row.candidateId,
          applicationId: idStr(app._id) || null,
          name,
          email: candidate.email || profile.email || '',
          phone: candidate.phone || profile.phoneNumber || candidate.whatsappNumber || '',
          currentRole: interviewer.currentRole || app.currentRole || '',
          currentCompany: interviewer.currentCompany || app.currentCompany || '',
          yearsOfExperience: Number(interviewer.yearsOfExperience || app.yearsOfExperience || 0),
          interviewPrice: Number(interviewer.interviewPrice || app.interviewPrice || 50),
          expertiseAreas: interviewer.expertiseAreas || app.expertiseAreas || [],
          interviewTypes: interviewer.interviewTypes || app.interviewTypes || [],
          languages: interviewer.languages || app.languages || [],
          weeklyAvailability: pickText(interviewer.weeklyAvailability, app.weeklyAvailability),
          aboutYourself: pickText(interviewer.aboutYourself, app.aboutYourself),
          feedbackStyle: pickText(interviewer.feedbackStyle, app.feedbackStyle),
          linkedinUrl: pickText(
            interviewer.linkedinUrl,
            app.linkedinUrl,
            nested(profile, 'linkedinUrl', 'linkedin', 'linkedIn'),
            nested(candidate, 'linkedIn', 'linkedinUrl', 'linkedin'),
          ),
          resumeUrl: pickText(
            interviewer.resumeUrl,
            app.resumeUrl,
            nested(profile, 'resumeUrl', 'resume'),
            nested(candidate, 'resumeUrl', 'resume'),
            resume.fileUrl,
            resume.url,
          ),
          profilePhotoUrl: pickText(
            interviewer.profilePhotoUrl,
            app.profilePhotoUrl,
            nested(profile, 'profilePhotoUrl'),
            candidate.avatar,
          ),
          dateOfBirth: toIso(
            profile.dateOfBirth ||
              profile.dob ||
              nested(profile, 'dateOfBirth', 'dob') ||
              candidate.dateOfBirth ||
              nested(candidate, 'dateOfBirth', 'dob'),
          ),
          passportNumber: pickText(
            nested(profile, 'passportNumber', 'passport', 'idNumber'),
            nested(candidate, 'passportNumber', 'passport'),
          ),
          applicationStatus: appStatus || (profileActive ? 'APPROVED' : 'SUBMITTED'),
          profileStatus: interviewer.status || null,
          reviewedBy: app.reviewedBy || null,
          reviewNotes: app.reviewNotes || null,
          kycVerified: kyc.kycVerified,
          kycMissing: kyc.missing,
          hqVerified,
          liveForCandidates: Boolean(kyc.kycVerified && hqVerified),
          kind: hqVerified ? 'interviewer' : 'applicant',
          createdAt: toIso(app.createdAt || interviewer.createdAt || candidate.createdAt),
          updatedAt: toIso(interviewer.updatedAt || app.updatedAt || candidate.updatedAt),
        };
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

    return {
      interviewers,
      stats: {
        total: interviewers.length,
        applicants: interviewers.filter((row) => row.kind === 'applicant').length,
        interviewers: interviewers.filter((row) => row.kind === 'interviewer').length,
        kycVerified: interviewers.filter((row) => row.kycVerified).length,
        pendingHqVerify: interviewers.filter((row) => row.kycVerified && !row.hqVerified).length,
        liveForCandidates: interviewers.filter((row) => row.liveForCandidates).length,
      },
    };
  },

  async verifyInterviewer(candidateId, reqUser) {
    const id = idStr(candidateId);
    if (!id) {
      const err = new Error('Interviewer candidate id is required');
      err.statusCode = 400;
      throw err;
    }

    const db = await getPortalDb();
    const idQuery = candidateIdVariants(id);
    const [candidate, profile, application, existingProfile] = await Promise.all([
      db.collection(CANDIDATES).findOne({ _id: asObjectId(id) || id }),
      db.collection(CANDIDATE_PROFILES).findOne({ candidateId: { $in: idQuery } }),
      db.collection(APPLICATIONS).findOne(
        { candidateId: { $in: idQuery } },
        { sort: { createdAt: -1 } },
      ),
      db.collection(PROFILES).findOne({ candidateId: { $in: idQuery } }),
    ]);

    const kyc = evaluateKyc(candidate, profile);
    if (!application && !existingProfile) {
      const err = new Error('No interviewer application found for this candidate');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const source = application || existingProfile || {};
    const candidateOid = asObjectId(id);
    const reviewedBy = String(reqUser?.email || reqUser?.name || 'hq').trim();

    if (application?._id) {
      await db.collection(APPLICATIONS).updateOne(
        { _id: application._id },
        {
          $set: {
            status: 'APPROVED',
            reviewedBy,
            reviewedAt: now,
            reviewNotes: kyc.kycVerified
              ? 'Verified by HQ after KYC'
              : `Verified by HQ. KYC incomplete: ${(kyc.missing || []).join(', ') || 'identity fields'}.`,
            updatedAt: now,
          },
        },
      );
    }

    const profileDoc = {
      candidateId: candidateOid || id,
      fullName: source.fullName || profile?.fullName || [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' '),
      currentCompany: source.currentCompany || null,
      currentRole: source.currentRole || null,
      yearsOfExperience: Number(source.yearsOfExperience || 0),
      expertiseAreas: source.expertiseAreas || [],
      interviewTypes: source.interviewTypes || [],
      languages: source.languages || [],
      weeklyAvailability: source.weeklyAvailability || '',
      aboutYourself: source.aboutYourself || '',
      feedbackStyle: source.feedbackStyle || '',
      linkedinUrl:
        source.linkedinUrl ||
        nested(profile, 'linkedinUrl', 'linkedin', 'linkedIn') ||
        nested(candidate, 'linkedIn', 'linkedinUrl') ||
        null,
      resumeUrl: source.resumeUrl || nested(profile, 'resumeUrl') || nested(candidate, 'resumeUrl') || null,
      profilePhotoUrl: profile?.profilePhotoUrl || source.profilePhotoUrl || candidate?.avatar || null,
      interviewPrice: Number(source.interviewPrice || 50),
      status: 'AVAILABLE',
      updatedAt: now,
    };

    await db.collection(PROFILES).updateOne(
      { candidateId: { $in: idQuery } },
      {
        $set: profileDoc,
        $setOnInsert: {
          ratingAverage: 0,
          totalRatings: 0,
          totalInterviews: 0,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return {
      candidateId: id,
      hqVerified: true,
      kycVerified: Boolean(kyc.kycVerified),
      liveForCandidates: Boolean(kyc.kycVerified),
    };
  },

  async rejectInterviewer(candidateId, reqUser, reviewNotes) {
    const id = idStr(candidateId);
    if (!id) {
      const err = new Error('Interviewer candidate id is required');
      err.statusCode = 400;
      throw err;
    }

    const db = await getPortalDb();
    const idQuery = candidateIdVariants(id);
    const [application, existingProfile] = await Promise.all([
      db.collection(APPLICATIONS).findOne(
        { candidateId: { $in: idQuery } },
        { sort: { createdAt: -1 } },
      ),
      db.collection(PROFILES).findOne({ candidateId: { $in: idQuery } }),
    ]);

    if (!application && !existingProfile) {
      const err = new Error('No interviewer application found for this candidate');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const reviewedBy = String(reqUser?.email || reqUser?.name || 'hq').trim();
    const notes = String(reviewNotes || '').trim() ||
      'Your Become Interviewer form was rejected. Update it and send it for re-verification.';
    const candidateOid = asObjectId(id);

    if (application?._id) {
      await db.collection(APPLICATIONS).updateOne(
        { _id: application._id },
        {
          $set: {
            status: 'REJECTED',
            reviewedBy,
            reviewedAt: now,
            reviewNotes: notes,
            updatedAt: now,
          },
        },
      );
    }

    if (existingProfile) {
      await db.collection(PROFILES).updateOne(
        { _id: existingProfile._id },
        {
          $set: {
            status: 'INACTIVE',
            updatedAt: now,
          },
        },
      );
    }

    await db.collection(NOTIFICATIONS).insertOne({
      candidateId: candidateOid || id,
      type: 'interview',
      title: 'Interviewer application rejected',
      description: notes,
      actionButton: 'Send for re-verification',
      actionPath: '/lms/interview-prep/become-interviewer',
      metadata: { source: 'hq', status: 'REJECTED' },
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      candidateId: id,
      hqVerified: false,
      applicationStatus: 'REJECTED',
      reviewNotes: notes,
    };
  },
};
