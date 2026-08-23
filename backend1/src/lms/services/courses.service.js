const { prisma } = require('../../lib/prisma');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  normalizeCertificateConfig,
  normalizeCheckpoints,
  generateCertificateId,
  renderCertificateHtml,
} = require('./course-certificate');

async function learnerDisplayName(userId) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  let profile = null;
  try {
    profile = await prisma.candidateProfile.findFirst({
      where: { candidateId: userId },
      select: { fullName: true, email: true },
    });
  } catch {
    profile = null;
  }
  const fromProfile = String(profile?.fullName || '').trim();
  if (fromProfile) return fromProfile;
  const joined = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  return String(profile?.email || candidate?.email || 'Learner').trim() || 'Learner';
}

function readCheckpoints(course) {
  return normalizeCheckpoints(course?.checkpoints);
}

function readCertificate(course) {
  return normalizeCertificateConfig(course?.certificate);
}

function progressMap(enrollment) {
  const raw = enrollment?.checkpointProgress;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

function requiredCheckpointsPassed(course, progress) {
  const required = readCheckpoints(course).filter((row) => row.required !== false);
  if (!required.length) return true;
  return required.every((row) => Boolean(progress[row.id]?.passed));
}

async function syncQuizCheckpoints(userId, course, progress) {
  const quizCheckpoints = readCheckpoints(course).filter((row) => row.type === 'quiz' && row.quizId);
  if (!quizCheckpoints.length) return progress;
  const next = { ...progress };
  for (const checkpoint of quizCheckpoints) {
    if (next[checkpoint.id]?.passed) continue;
    const attempts = await prisma.lmsQuizAttempt.findMany({
      where: { userId, quizId: checkpoint.quizId },
      orderBy: { score: 'desc' },
      take: 1,
    });
    const best = attempts[0];
    if (best && Number(best.score) >= Number(checkpoint.passPercent || 70)) {
      next[checkpoint.id] = {
        passed: true,
        at: new Date().toISOString(),
        source: 'quiz',
        score: Number(best.score),
      };
    }
  }
  return next;
}

function lessonGatesPassed(course, enrollment, progress, lessonId) {
  const lessons = [...(course.lessons || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const index = lessons.findIndex((row) => row.id === lessonId);
  if (index <= 0) return true;
  const completed = new Set(enrollment?.completedLessonIds || []);
  const prior = lessons.slice(0, index);
  if (!prior.every((row) => completed.has(row.id))) return false;
  const prevId = lessons[index - 1]?.id;
  const blocking = readCheckpoints(course).filter(
    (row) => row.required !== false && row.afterLessonId && row.afterLessonId === prevId,
  );
  return blocking.every((row) => Boolean(progress[row.id]?.passed));
}

async function maybeIssueCertificate(userId, course, enrollment, progress) {
  const certified = Boolean(course.isCertified) || String(course.accessTier || '') === 'certified';
  if (!certified) {
    return prisma.lmsEnrollment.update({
      where: { id: enrollment.id },
      data: { checkpointProgress: progress },
    });
  }
  const totalLessons = Math.max(1, Number(course.totalLessons) || (course.lessons || []).length || 1);
  const lessonDone =
    (enrollment.completedLessonIds || []).length >= totalLessons || Number(enrollment.progressPercent) >= 100;
  if (!lessonDone || !requiredCheckpointsPassed(course, progress)) {
    return prisma.lmsEnrollment.update({
      where: { id: enrollment.id },
      data: { checkpointProgress: progress },
    });
  }
  if (enrollment.certificateId && enrollment.certificateIssuedAt) {
    return prisma.lmsEnrollment.update({
      where: { id: enrollment.id },
      data: { checkpointProgress: progress, completedAt: enrollment.completedAt || new Date(), progressPercent: 100 },
    });
  }
  const certificateId = generateCertificateId(course.title);
  return prisma.lmsEnrollment.update({
    where: { id: enrollment.id },
    data: {
      completedAt: enrollment.completedAt || new Date(),
      progressPercent: 100,
      checkpointProgress: progress,
      certificateId,
      certificateIssuedAt: new Date(),
    },
  });
}

async function checkCareerPathAdvancement(userId, courseId) {
  const careerPath = await prisma.lmsCareerPath.findUnique({ where: { userId } });
  if (!careerPath) return;

  const roadmapItems = careerPath.roadmapItems || [];
  let updated = false;

  const newItems = roadmapItems.map(item => {
    if (item.targetType === 'course' && item.targetId === courseId && item.status !== 'completed') {
      updated = true;
      return { ...item, status: 'completed', completedAt: new Date().toISOString() };
    }
    return item;
  });

  if (updated) {
    await prisma.lmsCareerPath.update({
      where: { userId },
      data: { roadmapItems: newItems }
    });
  }
}

async function fetchCourses(userId, filters) {
  const { search, category, level, tag, saved, focusTopic } = filters;
  
  // Get user's goal to prioritize content (do not hard-exclude other published courses)
  const careerPreferences = await prisma.careerPreferences.findUnique({
    where: { candidateId: userId }
  });
  const userGoal = careerPreferences?.functionalArea;

  const where = { isPublished: true };

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (category) where.category = category;
  if (level) {
    // Accept Beginner / beginner (HQ + legacy seed casing)
    where.level = { equals: String(level).trim(), mode: 'insensitive' };
  }
  
  // Explicit tag filter only — career goal is used for sorting, not exclusion
  if (tag) {
    where.tags = { has: tag };
  }

  let courses = await prisma.lmsCourse.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      enrollments: {
        where: { userId }
      }
    }
  });

  if (saved === 'true') {
    courses = courses.filter(c => c.enrollments[0]?.savedAt);
  }

  const goalStr = String(userGoal || '').trim().toLowerCase();
  const goalKeywords = goalStr
    ? goalStr.split(/\s+/).filter((w) => w.length > 2)
    : [];

  // Map progress wrapper
  let mapped = courses.map(course => {
    const enrollment = course.enrollments[0];
    const { enrollments, ...rest } = course;
    const tokenCost = Number(rest.tokenCost) || 0;
    const accessTier = rest.accessTier || (tokenCost > 0 ? (rest.isCertified ? 'certified' : 'premium') : 'free');
    const tags = Array.isArray(rest.tags) ? rest.tags.map(String) : [];
    const hay = [rest.title, rest.description, rest.category, ...tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const goalMatch =
      Boolean(goalStr) &&
      (hay.includes(goalStr) || goalKeywords.some((w) => hay.includes(w)));
    return {
      ...rest,
      tags,
      accessTier,
      tokenCost,
      isCertified: Boolean(rest.isCertified) || accessTier === 'certified',
      isFree: tokenCost <= 0 || accessTier === 'free',
      isLocked: tokenCost > 0 && !enrollment,
      enrollmentStatus: !!enrollment,
      progressPercent: enrollment ? enrollment.progressPercent : 0,
      isSaved: enrollment ? !!enrollment.savedAt : false,
      isCompleted: enrollment ? !!enrollment.completedAt : false,
      goalMatch,
      focusReason:
        focusTopic && tags.some((t) => String(t).toLowerCase() === String(focusTopic).toLowerCase())
          ? `Prioritized because it covers your focus area: ${focusTopic}.`
          : goalMatch && userGoal
            ? `Related to your career goal: ${userGoal}.`
            : undefined,
    };
  });

  // Newest first, with career-goal / focus matches lifted
  mapped = mapped.sort((a, b) => {
    if (focusTopic) {
      if (a.focusReason && !b.focusReason) return -1;
      if (!a.focusReason && b.focusReason) return 1;
    }
    if (a.goalMatch !== b.goalMatch) return a.goalMatch ? -1 : 1;
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return mapped;
}

async function fetchCourseDetail(userId, courseId) {
  const course = await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { order: 'asc' } },
      enrollments: { where: { userId } }
    }
  });

  if (!course) return null;

  const enrollment = course.enrollments[0];
  const completedIds = enrollment ? enrollment.completedLessonIds : [];
  let progress = progressMap(enrollment);
  if (enrollment) {
    progress = await syncQuizCheckpoints(userId, course, progress);
    if (JSON.stringify(progress) !== JSON.stringify(progressMap(enrollment))) {
      await prisma.lmsEnrollment.update({
        where: { id: enrollment.id },
        data: { checkpointProgress: progress },
      });
    }
  }

  let nextLessonId = null;
  const lessonsWithState = course.lessons.map(lesson => {
    const isCompleted = completedIds.includes(lesson.id);
    const gateOpen = !enrollment || lessonGatesPassed(course, enrollment, progress, lesson.id);
    if (!isCompleted && gateOpen && !nextLessonId) {
      nextLessonId = lesson.id;
    }
    return {
      ...lesson,
      isCompleted,
      isLocked: Boolean(lesson.isLocked) || !gateOpen,
    };
  });

  // Calculate related quizzes and events based on tags
  const relatedQuizzes = await prisma.lmsQuiz.findMany({
    where: {
      isPublished: true,
      skillTags: { hasSome: course.tags }
    },
    take: 3
  });

  const relatedEvents = await prisma.lmsEvent.findMany({
    where: {
      isPublished: true,
      tags: { hasSome: course.tags },
      scheduledAt: { gte: new Date() }
    },
    take: 3
  });

  const { enrollments, ...courseData } = course;
  const tokenCost = Number(courseData.tokenCost) || 0;
  const accessTier = courseData.accessTier || (tokenCost > 0 ? (courseData.isCertified ? 'certified' : 'premium') : 'free');
  return {
    ...courseData,
    accessTier,
    tokenCost,
    isCertified: Boolean(courseData.isCertified) || accessTier === 'certified',
    isFree: tokenCost <= 0 || accessTier === 'free',
    isLocked: tokenCost > 0 && !enrollment,
    enrollmentStatus: !!enrollment,
    progressPercent: enrollment ? enrollment.progressPercent : 0,
    nextLessonId,
    lessons: lessonsWithState,
    checkpoints: readCheckpoints(course).map((row) => ({
      ...row,
      passed: Boolean(progress[row.id]?.passed),
      progress: progress[row.id] || null,
    })),
    certificate: readCertificate(course),
    certificateId: enrollment?.certificateId || null,
    certificateIssuedAt: enrollment?.certificateIssuedAt || null,
    canDownloadCertificate: Boolean(enrollment?.certificateId),
    relatedQuizzes,
    relatedEvents
  };
}

async function enrollUser(userId, courseId) {
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } }
  });

  if (enrollment) {
    return {
      enrollment,
      alreadyEnrolled: true,
      tokenSpend: null,
      course: await prisma.lmsCourse.findUnique({ where: { id: courseId } }),
    };
  }

  const course = await prisma.lmsCourse.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }

  const tokenCost = Number(course.tokenCost) || 0;
  let tokenSpend = null;

  if (tokenCost > 0) {
    const tokenService = require('../../services/token.service');
    const tier = course.accessTier || (course.isCertified ? 'certified' : 'premium');
    tokenSpend = await tokenService.spendTokensAmount(
      userId,
      tokenCost,
      `lms.courses.unlock.${courseId}`,
      `Unlocked ${tier} course: ${course.title} (${tokenCost} tokens)`
    );
  }

  enrollment = await prisma.lmsEnrollment.create({
    data: {
      userId,
      courseId,
      startedAt: new Date()
    }
  });

  return {
    enrollment,
    alreadyEnrolled: false,
    tokenSpend,
    course,
  };
}

async function toggleSaveCourse(userId, courseId, saved) {
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } }
  });

  if (!enrollment) {
    const course = await prisma.lmsCourse.findUnique({ where: { id: courseId } });
    const tokenCost = Number(course?.tokenCost) || 0;
    if (tokenCost > 0 && saved) {
      const err = new Error('Unlock this course with tokens before saving it');
      err.status = 402;
      err.code = 'COURSE_LOCKED';
      err.required = tokenCost;
      throw err;
    }
    enrollment = await prisma.lmsEnrollment.create({
      data: {
        userId,
        courseId,
        savedAt: saved ? new Date() : null,
      }
    });
  } else {
    enrollment = await prisma.lmsEnrollment.update({
      where: { id: enrollment.id },
      data: { savedAt: saved ? new Date() : null }
    });
  }
  return enrollment;
}

async function markLessonComplete(userId, courseId, lessonId) {
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: { include: { lessons: { orderBy: { order: 'asc' } } } } }
  });

  if (!enrollment) {
    const course = await prisma.lmsCourse.findUnique({ where: { id: courseId } });
    const tokenCost = Number(course?.tokenCost) || 0;
    if (tokenCost > 0) {
      const err = new Error('Unlock this course with tokens before continuing');
      err.status = 402;
      err.code = 'COURSE_LOCKED';
      err.required = tokenCost;
      err.balance = 0;
      throw err;
    }
    const result = await enrollUser(userId, courseId);
    enrollment = result.enrollment;
    enrollment.course = course;
  }

  const course = enrollment.course || (await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { order: 'asc' } } },
  }));
  enrollment.course = course;

  const completedIds = new Set(enrollment.completedLessonIds);
  completedIds.add(lessonId);
  const newCompletedIds = Array.from(completedIds);
  
  const totalLessons = course.totalLessons || course.lessons?.length || 1;
  const progressPercent = Math.min((newCompletedIds.length / totalLessons) * 100, 100);
  const lessonComplete = progressPercent >= 100 && !enrollment.completedAt;

  let progress = await syncQuizCheckpoints(userId, course, progressMap(enrollment));
  const gatesOk = lessonGatesPassed(
    { ...course, lessons: course.lessons || [] },
    { ...enrollment, completedLessonIds: enrollment.completedLessonIds },
    progress,
    lessonId,
  );
  if (!gatesOk && !enrollment.completedLessonIds.includes(lessonId)) {
    const err = new Error('Complete the previous lesson and any required checkpoint first.');
    err.status = 403;
    throw err;
  }

  let updatedEnrollment = await prisma.lmsEnrollment.update({
    where: { id: enrollment.id },
    data: {
      completedLessonIds: newCompletedIds,
      progressPercent,
      lastAccessedAt: new Date(),
      checkpointProgress: progress,
      ...(lessonComplete && requiredCheckpointsPassed(course, progress) ? { completedAt: new Date() } : {}),
    }
  });

  updatedEnrollment = await maybeIssueCertificate(userId, { ...course, totalLessons }, {
    ...updatedEnrollment,
    completedLessonIds: newCompletedIds,
    progressPercent,
  }, progress);

  if (updatedEnrollment.completedAt) {
    await checkCareerPathAdvancement(userId, courseId);
  }

  return updatedEnrollment;
}

async function fetchLessonDetail(userId, courseId, lessonId) {
  const lesson = await prisma.lmsLesson.findUnique({
    where: { id: lessonId }
  });

  if (!lesson || lesson.courseId !== courseId) {
    throw new Error('Lesson not found');
  }

  const course = await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { order: 'asc' } }
    }
  });

  const enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } }
  });

  const currentIndex = course.lessons.findIndex(l => l.id === lessonId);
  const progress = progressMap(enrollment);
  const gateOpen = lessonGatesPassed(course, enrollment, progress, lessonId);
  
  if ((lesson.isLocked || !gateOpen) && currentIndex > 0) {
    const err = new Error('This lesson is locked until previous lessons and checkpoints are completed.');
    err.status = 403;
    throw err;
  }

  const prevLesson = currentIndex > 0 ? course.lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < course.lessons.length - 1 ? course.lessons[currentIndex + 1] : null;

  return {
    ...lesson,
    prevLesson: prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null,
    nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
    isCompleted: enrollment ? enrollment.completedLessonIds.includes(lesson.id) : false
  };
}

async function completeCheckpoint(userId, courseId, checkpointId, { file, note } = {}) {
  const course = await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }
  const checkpoint = readCheckpoints(course).find((row) => row.id === String(checkpointId));
  if (!checkpoint) {
    const err = new Error('Checkpoint not found');
    err.status = 404;
    throw err;
  }
  if (checkpoint.type === 'manual') {
    const err = new Error('This checkpoint must be signed off by HQ.');
    err.status = 403;
    throw err;
  }
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    const result = await enrollUser(userId, courseId);
    enrollment = result.enrollment;
  }
  let progress = await syncQuizCheckpoints(userId, course, progressMap(enrollment));
  if (checkpoint.type === 'quiz') {
    progress = await syncQuizCheckpoints(userId, course, progress);
    if (!progress[checkpoint.id]?.passed) {
      const err = new Error(`Pass the linked quiz at ${checkpoint.passPercent || 70}% first.`);
      err.status = 400;
      throw err;
    }
  }
  if (checkpoint.type === 'assignment') {
    let fileMeta = null;
    if (file?.buffer?.length) {
      const dir = path.join(__dirname, '../../../uploads/lms-assignments');
      fs.mkdirSync(dir, { recursive: true });
      const safe = String(file.originalname || 'assignment').replace(/[^a-zA-Z0-9._-]/g, '_');
      const stored = `${Date.now()}_${randomUUID().slice(0, 8)}_${safe}`;
      fs.writeFileSync(path.join(dir, stored), file.buffer);
      fileMeta = {
        name: safe,
        url: `/uploads/lms-assignments/${encodeURIComponent(stored)}`,
      };
    }
    progress[checkpoint.id] = {
      passed: true,
      at: new Date().toISOString(),
      source: 'assignment',
      note: String(note || '').trim() || null,
      file: fileMeta,
    };
  }
  const updated = await maybeIssueCertificate(userId, course, {
    ...enrollment,
    progressPercent: enrollment.progressPercent,
    completedLessonIds: enrollment.completedLessonIds,
  }, progress);
  return { checkpointId: checkpoint.id, progress: progress[checkpoint.id], enrollment: updated };
}

async function fetchCertificateHtml(userId, courseId) {
  const course = await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    const err = new Error('Enroll and complete this course to get a certificate.');
    err.status = 403;
    throw err;
  }
  const progress = await syncQuizCheckpoints(userId, course, progressMap(enrollment));
  enrollment = await maybeIssueCertificate(userId, course, enrollment, progress);
  if (!enrollment.certificateId) {
    const err = new Error('Finish every lesson and required checkpoint before downloading the certificate.');
    err.status = 403;
    throw err;
  }
  const learnerName = await learnerDisplayName(userId);
  const html = renderCertificateHtml({
    learnerName,
    courseTitle: course.title,
    instructorName: course.instructorName || 'HRYantra HQ',
    completedAt: enrollment.certificateIssuedAt || enrollment.completedAt || new Date(),
    certificateId: enrollment.certificateId,
    certificate: course.certificate,
  });
  return { html, certificateId: enrollment.certificateId };
}

async function fetchCertificatePdf(userId, courseId) {
  const { renderCertificatePdf } = require('./course-certificate');
  const course = await prisma.lmsCourse.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    const err = new Error('Enroll and complete this course to get a certificate.');
    err.status = 403;
    throw err;
  }
  const progress = await syncQuizCheckpoints(userId, course, progressMap(enrollment));
  enrollment = await maybeIssueCertificate(userId, course, enrollment, progress);
  if (!enrollment.certificateId) {
    const err = new Error('Finish every lesson and required checkpoint before downloading the certificate.');
    err.status = 403;
    throw err;
  }
  const learnerName = await learnerDisplayName(userId);
  const buffer = await renderCertificatePdf({
    learnerName,
    courseTitle: course.title,
    instructorName: course.instructorName || 'HRYantra HQ',
    completedAt: enrollment.certificateIssuedAt || enrollment.completedAt || new Date(),
    certificateId: enrollment.certificateId,
    certificate: course.certificate,
  });
  return { buffer, certificateId: enrollment.certificateId };
}

module.exports = {
  fetchCourses,
  fetchCourseDetail,
  enrollUser,
  toggleSaveCourse,
  markLessonComplete,
  fetchLessonDetail,
  completeCheckpoint,
  fetchCertificateHtml,
  fetchCertificatePdf,
};
