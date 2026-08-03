const { prisma } = require('../../lib/prisma');

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

  let nextLessonId = null;
  const lessonsWithState = course.lessons.map(lesson => {
    const isCompleted = completedIds.includes(lesson.id);
    if (!isCompleted && !nextLessonId) {
      nextLessonId = lesson.id;
    }
    return {
      ...lesson,
      isCompleted
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
    include: { course: true }
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

  const completedIds = new Set(enrollment.completedLessonIds);
  completedIds.add(lessonId);
  const newCompletedIds = Array.from(completedIds);
  
  const totalLessons = enrollment.course.totalLessons || 1;
  const progressPercent = Math.min((newCompletedIds.length / totalLessons) * 100, 100);
  const isComplete = progressPercent === 100 && !enrollment.completedAt;

  const updatedEnrollment = await prisma.lmsEnrollment.update({
    where: { id: enrollment.id },
    data: {
      completedLessonIds: newCompletedIds,
      progressPercent,
      lastAccessedAt: new Date(),
      ...(isComplete && { completedAt: new Date() })
    }
  });

  if (isComplete) {
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
  
  if (lesson.isLocked) {
    // Basic unlock logic: all prior lessons must be completed
    const priorLessons = course.lessons.slice(0, currentIndex);
    const completedIds = enrollment ? enrollment.completedLessonIds : [];
    const priorCompleted = priorLessons.every(l => completedIds.includes(l.id));
    if (!priorCompleted && priorLessons.length > 0) {
      throw new Error('This lesson is locked until previous lessons are completed.');
    }
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

module.exports = {
  fetchCourses,
  fetchCourseDetail,
  enrollUser,
  toggleSaveCourse,
  markLessonComplete,
  fetchLessonDetail
};
