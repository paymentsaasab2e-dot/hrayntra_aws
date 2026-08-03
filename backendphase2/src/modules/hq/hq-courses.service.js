import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import { env } from '../../config/env.js';
import { uploadBufferToS3 } from '../../utils/s3.js';
import { isS3Configured } from '../../utils/publicUploads.util.js';

const COLLECTION = 'lms_courses';
const LESSONS_COLLECTION = 'lms_lessons';
const ENROLLMENTS_COLLECTION = 'lms_enrollments';
const CANDIDATES_COLLECTION = 'candidates';
const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
export const HQ_COURSE_THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
export const HQ_COURSE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

let portalMongoClient = null;

async function getPortalDb() {
  const url = String(env.JOB_PORTAL_DATABASE_URL || env.DATABASE_URL || '').trim();
  if (!url) {
    const err = new Error('JOB_PORTAL_DATABASE_URL (or DATABASE_URL) is not configured');
    err.statusCode = 500;
    throw err;
  }
  if (!portalMongoClient) {
    portalMongoClient = new MongoClient(url);
    await portalMongoClient.connect();
  }
  return portalMongoClient.db();
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
}

function backendPublicBase() {
  return String(
    env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.PUBLIC_BACKEND_URL ||
      `http://localhost:${process.env.PORT || '5001'}`,
  ).replace(/\/+$/, '');
}

export function courseThumbnailMulterFilter(_req, file, cb) {
  const mime = String(file?.mimetype || '').trim().toLowerCase();
  if (!IMAGE_MIMES.has(mime)) {
    cb(new Error('Only images (JPG, PNG, WEBP, GIF) are allowed'));
    return;
  }
  cb(null, true);
}

export function courseVideoMulterFilter(_req, file, cb) {
  const mime = String(file?.mimetype || '').trim().toLowerCase();
  if (!VIDEO_MIMES.has(mime)) {
    cb(new Error('Only videos (MP4, WEBM, MOV) are allowed'));
    return;
  }
  cb(null, true);
}

function normalizeCourseVideoUrl(raw) {
  const value = String(raw || '').trim();
  return value || null;
}

async function storeCourseMediaFile(file, { folder, maxBytes, allowedMimes, tooLargeMessage, invalidMimeMessage }) {
  if (!file?.buffer?.length) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    throw err;
  }
  if (file.size > maxBytes) {
    const err = new Error(tooLargeMessage);
    err.statusCode = 400;
    throw err;
  }
  const mime = String(file.mimetype || '').trim().toLowerCase();
  if (!allowedMimes.has(mime)) {
    const err = new Error(invalidMimeMessage);
    err.statusCode = 400;
    throw err;
  }

  const safeName = sanitizeFilename(file.originalname);
  const storedName = `${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

  if (isS3Configured()) {
    try {
      const uploaded = await uploadBufferToS3(file.buffer, {
        folder,
        originalFilename: storedName,
        contentType: file.mimetype,
      });
      return {
        url: uploaded.secure_url || uploaded.url,
        name: safeName,
        size: file.size,
      };
    } catch (error) {
      console.warn('[hq-courses] S3 upload failed, using local storage:', error?.message || error);
    }
  }

  const dir = path.join(projectRoot, 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, storedName), file.buffer);
  return {
    url: `${backendPublicBase()}/uploads/${folder}/${encodeURIComponent(storedName)}`,
    name: safeName,
    size: file.size,
  };
}

async function storeCourseThumbnailFile(file) {
  return storeCourseMediaFile(file, {
    folder: 'lms-courses',
    maxBytes: HQ_COURSE_THUMBNAIL_MAX_BYTES,
    allowedMimes: IMAGE_MIMES,
    tooLargeMessage: 'Image must be 5 MB or smaller',
    invalidMimeMessage: 'Only images (JPG, PNG, WEBP, GIF) are allowed',
  });
}

async function storeCourseVideoFile(file) {
  return storeCourseMediaFile(file, {
    folder: 'lms-course-videos',
    maxBytes: HQ_COURSE_VIDEO_MAX_BYTES,
    allowedMimes: VIDEO_MIMES,
    tooLargeMessage: 'Video must be 100 MB or smaller',
    invalidMimeMessage: 'Only videos (MP4, WEBM, MOV) are allowed',
  });
}

async function syncIntroVideoLesson(db, courseObjectId, { title, description, videoUrl }) {
  const now = new Date();
  const existing = await db.collection(LESSONS_COLLECTION).findOne({
    courseId: courseObjectId,
    hqIntro: true,
  });

  if (!videoUrl) {
    if (existing) {
      await db.collection(LESSONS_COLLECTION).deleteOne({ _id: existing._id });
    }
    const count = await db.collection(LESSONS_COLLECTION).countDocuments({ courseId: courseObjectId });
    await db.collection(COLLECTION).updateOne(
      { _id: courseObjectId },
      { $set: { totalLessons: count, updatedAt: now } },
    );
    return;
  }

  const lessonDoc = {
    title: 'Introduction',
    description: String(description || '').trim() || `Watch the intro video for ${title}`,
    order: 1,
    durationMinutes: 0,
    videoUrl,
    contentHtml: null,
    type: 'video',
    isLocked: false,
    hqIntro: true,
    updatedAt: now,
  };

  if (existing) {
    await db.collection(LESSONS_COLLECTION).updateOne({ _id: existing._id }, { $set: lessonDoc });
  } else {
    await db.collection(LESSONS_COLLECTION).insertOne({
      ...lessonDoc,
      courseId: courseObjectId,
      createdAt: now,
    });
  }

  const count = await db.collection(LESSONS_COLLECTION).countDocuments({ courseId: courseObjectId });
  await db.collection(COLLECTION).updateOne(
    { _id: courseObjectId },
    { $set: { totalLessons: Math.max(count, Number(lessonDoc.order) || 1), updatedAt: now } },
  );
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseTags(raw) {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,|\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeAccessTier(raw, tokenCost, isCertified) {
  const tier = String(raw || '').trim().toLowerCase();
  if (tier === 'free' || tier === 'premium' || tier === 'certified') return tier;
  if (isCertified) return 'certified';
  if (Number(tokenCost) > 0) return 'premium';
  return 'free';
}

function toCourseRow(doc, extras = {}) {
  if (!doc) return null;
  const tokenCost = Number(doc.tokenCost) || 0;
  const isCertified = Boolean(doc.isCertified);
  const accessTier = normalizeAccessTier(doc.accessTier, tokenCost, isCertified);
  return {
    id: String(doc._id),
    title: String(doc.title || ''),
    description: String(doc.description || ''),
    category: String(doc.category || ''),
    level: String(doc.level || 'beginner'),
    thumbnailUrl: doc.thumbnailUrl ? String(doc.thumbnailUrl) : null,
    videoUrl: doc.videoUrl ? String(doc.videoUrl) : null,
    instructorName: doc.instructorName ? String(doc.instructorName) : null,
    instructorAvatar: doc.instructorAvatar ? String(doc.instructorAvatar) : null,
    totalLessons: Number(doc.totalLessons) || 0,
    estimatedHours: Number(doc.estimatedHours) || 0,
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    isPublished: Boolean(doc.isPublished),
    accessTier,
    tokenCost,
    isCertified: isCertified || accessTier === 'certified',
    enrolledCount: Number(extras.enrolledCount) || 0,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function candidateDisplayName(candidate, profile) {
  const fromProfile = String(profile?.fullName || '').trim();
  if (fromProfile) return fromProfile;
  const first = String(candidate?.firstName || '').trim();
  const last = String(candidate?.lastName || '').trim();
  const joined = [first, last].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  const email = String(profile?.email || candidate?.email || '').trim();
  if (email) return email;
  return 'Unknown learner';
}

function buildCourseDoc(data, { isUpdate = false } = {}) {
  const title = String(data?.title || '').trim();
  if (!title) {
    const err = new Error('Course title is required');
    err.statusCode = 400;
    throw err;
  }

  const description = String(data?.description || '').trim();
  const category = String(data?.category || '').trim() || 'general';
  const level = String(data?.level || 'beginner').trim().toLowerCase() || 'beginner';
  const tokenCost = Math.max(0, Number(data?.tokenCost) || 0);
  const isCertified = Boolean(data?.isCertified);
  const accessTier = normalizeAccessTier(data?.accessTier, tokenCost, isCertified);
  const now = new Date();

  const doc = {
    title,
    description: description || `${title} — HQ LMS course`,
    category,
    level,
    thumbnailUrl: String(data?.thumbnailUrl || '').trim() || null,
    videoUrl: normalizeCourseVideoUrl(data?.videoUrl),
    instructorName: String(data?.instructorName || '').trim() || null,
    instructorAvatar: String(data?.instructorAvatar || '').trim() || null,
    totalLessons: Math.max(0, Number(data?.totalLessons) || 0),
    estimatedHours: Math.max(0, Number(data?.estimatedHours) || 0),
    tags: (() => {
      const tags = parseTags(data?.tags);
      if (tags.length) return tags;
      // Ensure Phase 1 catalog can discover HQ courses even without custom tags
      return [category, 'hq'].filter(Boolean);
    })(),
    isPublished: data?.isPublished === undefined ? true : Boolean(data.isPublished),
    accessTier,
    tokenCost: accessTier === 'free' ? 0 : tokenCost,
    isCertified: isCertified || accessTier === 'certified',
    source: 'hq',
    updatedAt: now,
  };

  if (!isUpdate) {
    doc.createdAt = now;
  }

  return doc;
}

export const hqCoursesService = {
  async listCourses() {
    const db = await getPortalDb();
    const rows = await db
      .collection(COLLECTION)
      .find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(500)
      .toArray();

    const courseIds = rows.map((row) => row._id).filter(Boolean);
    const enrollmentCounts = new Map();
    if (courseIds.length) {
      const courseIdStrings = courseIds.map((id) => String(id));
      const grouped = await db
        .collection(ENROLLMENTS_COLLECTION)
        .aggregate([
          {
            $match: {
              $or: [{ courseId: { $in: courseIds } }, { courseId: { $in: courseIdStrings } }],
            },
          },
          { $group: { _id: { $toString: '$courseId' }, count: { $sum: 1 } } },
        ])
        .toArray();
      for (const row of grouped) {
        enrollmentCounts.set(String(row._id), Number(row.count) || 0);
      }
    }

    const courses = rows
      .map((doc) => toCourseRow(doc, { enrolledCount: enrollmentCounts.get(String(doc._id)) || 0 }))
      .filter(Boolean);
    const published = courses.filter((c) => c.isPublished).length;
    const draft = courses.length - published;
    const premium = courses.filter((c) => c.accessTier !== 'free').length;
    const totalEnrollments = courses.reduce((sum, c) => sum + (Number(c.enrolledCount) || 0), 0);

    return {
      courses,
      stats: {
        total: courses.length,
        published,
        draft,
        premium,
        enrollments: totalEnrollments,
      },
    };
  },

  async listCourseEnrollments(id) {
    const db = await getPortalDb();
    let objectId;
    try {
      objectId = new ObjectId(String(id));
    } catch {
      const err = new Error('Invalid course id');
      err.statusCode = 400;
      throw err;
    }

    const course = await db.collection(COLLECTION).findOne({ _id: objectId });
    if (!course) {
      const err = new Error('Course not found');
      err.statusCode = 404;
      throw err;
    }

    const enrollments = await db
      .collection(ENROLLMENTS_COLLECTION)
      .find({
        $or: [{ courseId: objectId }, { courseId: String(objectId) }],
      })
      .sort({ startedAt: -1, lastAccessedAt: -1 })
      .limit(500)
      .toArray();

    const userIds = [
      ...new Set(
        enrollments
          .map((row) => row.userId)
          .filter(Boolean)
          .map((value) => {
            try {
              return value instanceof ObjectId ? value : new ObjectId(String(value));
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      ),
    ];

    const [candidates, profiles] = await Promise.all([
      userIds.length
        ? db
            .collection(CANDIDATES_COLLECTION)
            .find({ _id: { $in: userIds } })
            .project({
              firstName: 1,
              lastName: 1,
              email: 1,
              phone: 1,
              whatsappNumber: 1,
              avatar: 1,
              currentTitle: 1,
              location: 1,
              city: 1,
            })
            .toArray()
        : [],
      userIds.length
        ? db
            .collection(CANDIDATE_PROFILES_COLLECTION)
            .find({ candidateId: { $in: userIds } })
            .project({
              candidateId: 1,
              fullName: 1,
              email: 1,
              phoneNumber: 1,
              profilePhotoUrl: 1,
              city: 1,
              country: 1,
            })
            .toArray()
        : [],
    ]);

    const candidateById = new Map(candidates.map((c) => [String(c._id), c]));
    const profileByCandidateId = new Map(profiles.map((p) => [String(p.candidateId), p]));

    const learners = enrollments.map((row) => {
      const userId = String(row.userId || '');
      const candidate = candidateById.get(userId) || null;
      const profile = profileByCandidateId.get(userId) || null;
      const progressPercent = Math.max(0, Math.min(100, Math.round(Number(row.progressPercent) || 0)));
      return {
        id: String(row._id),
        userId,
        name: candidateDisplayName(candidate, profile),
        email: String(profile?.email || candidate?.email || '').trim() || null,
        phone: String(profile?.phoneNumber || candidate?.phone || candidate?.whatsappNumber || '').trim() || null,
        avatar: String(profile?.profilePhotoUrl || candidate?.avatar || '').trim() || null,
        title: String(candidate?.currentTitle || '').trim() || null,
        location:
          String(profile?.city || candidate?.city || candidate?.location || profile?.country || '').trim() || null,
        progressPercent,
        completedLessonCount: Array.isArray(row.completedLessonIds) ? row.completedLessonIds.length : 0,
        completedAt: toIso(row.completedAt),
        startedAt: toIso(row.startedAt),
        lastAccessedAt: toIso(row.lastAccessedAt),
        savedAt: toIso(row.savedAt),
        status: row.completedAt ? 'completed' : progressPercent > 0 ? 'in_progress' : 'joined',
      };
    });

    return {
      course: toCourseRow(course, { enrolledCount: learners.length }),
      learners,
      stats: {
        total: learners.length,
        completed: learners.filter((l) => l.status === 'completed').length,
        inProgress: learners.filter((l) => l.status === 'in_progress').length,
        joined: learners.filter((l) => l.status === 'joined').length,
      },
    };
  },

  async createCourse(data) {
    const db = await getPortalDb();
    const doc = buildCourseDoc(data, { isUpdate: false });
    const result = await db.collection(COLLECTION).insertOne(doc);
    await syncIntroVideoLesson(db, result.insertedId, {
      title: doc.title,
      description: doc.description,
      videoUrl: doc.videoUrl,
    });
    const created = await db.collection(COLLECTION).findOne({ _id: result.insertedId });
    return { course: toCourseRow(created) };
  },

  async updateCourse(id, data) {
    const db = await getPortalDb();
    let objectId;
    try {
      objectId = new ObjectId(String(id));
    } catch {
      const err = new Error('Invalid course id');
      err.statusCode = 400;
      throw err;
    }

    const existing = await db.collection(COLLECTION).findOne({ _id: objectId });
    if (!existing) {
      const err = new Error('Course not found');
      err.statusCode = 404;
      throw err;
    }

    const patch = buildCourseDoc(
      {
        ...existing,
        ...data,
        title: data?.title ?? existing.title,
        description: data?.description ?? existing.description,
        category: data?.category ?? existing.category,
        level: data?.level ?? existing.level,
        accessTier: data?.accessTier ?? existing.accessTier,
        tokenCost: data?.tokenCost ?? existing.tokenCost,
        isCertified: data?.isCertified ?? existing.isCertified,
        isPublished: data?.isPublished ?? existing.isPublished,
        tags: data?.tags ?? existing.tags,
        thumbnailUrl: data?.thumbnailUrl ?? existing.thumbnailUrl,
        videoUrl: data?.videoUrl !== undefined ? data.videoUrl : existing.videoUrl,
        instructorName: data?.instructorName ?? existing.instructorName,
        estimatedHours: data?.estimatedHours ?? existing.estimatedHours,
        totalLessons: data?.totalLessons ?? existing.totalLessons,
      },
      { isUpdate: true },
    );

    await db.collection(COLLECTION).updateOne({ _id: objectId }, { $set: patch });
    await syncIntroVideoLesson(db, objectId, {
      title: patch.title,
      description: patch.description,
      videoUrl: patch.videoUrl,
    });
    const updated = await db.collection(COLLECTION).findOne({ _id: objectId });
    return { course: toCourseRow(updated) };
  },

  async deleteCourse(id) {
    const db = await getPortalDb();
    let objectId;
    try {
      objectId = new ObjectId(String(id));
    } catch {
      const err = new Error('Invalid course id');
      err.statusCode = 400;
      throw err;
    }

    const result = await db.collection(COLLECTION).deleteOne({ _id: objectId });
    if (!result.deletedCount) {
      const err = new Error('Course not found');
      err.statusCode = 404;
      throw err;
    }
    await db.collection(LESSONS_COLLECTION).deleteMany({ courseId: objectId });
    return { deleted: true, id: String(id) };
  },

  async deleteCourses(ids) {
    const list = Array.isArray(ids) ? ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
    if (!list.length) {
      const err = new Error('Select at least one course to delete');
      err.statusCode = 400;
      throw err;
    }

    const objectIds = [];
    const invalid = [];
    for (const id of list) {
      try {
        objectIds.push(new ObjectId(id));
      } catch {
        invalid.push(id);
      }
    }

    if (!objectIds.length) {
      const err = new Error('No valid course ids provided');
      err.statusCode = 400;
      throw err;
    }

    const db = await getPortalDb();
    const result = await db.collection(COLLECTION).deleteMany({ _id: { $in: objectIds } });
    await db.collection(LESSONS_COLLECTION).deleteMany({ courseId: { $in: objectIds } });
    return {
      deleted: true,
      deletedCount: result.deletedCount || 0,
      requested: list.length,
      invalid,
    };
  },

  async uploadThumbnail(file) {
    const uploaded = await storeCourseThumbnailFile(file);
    return { thumbnail: uploaded };
  },

  async uploadVideo(file) {
    const uploaded = await storeCourseVideoFile(file);
    return { video: uploaded };
  },
};
