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
  
  // Get user's goal to prioritize content
  const careerPreferences = await prisma.careerPreferences.findUnique({
    where: { candidateId: userId }
  });
  const userGoal = careerPreferences?.functionalArea;

  const where = { isPublished: true };

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (category) where.category = category;
  if (level) where.level = level;
  
  // If a tag is requested specifically, use it. 
  // Otherwise, if we have a userGoal and no search/category, filter by userGoal
  if (tag) {
    where.tags = { has: tag };
  } else if (userGoal && !search && !category) {
    // If no specific filters, show courses tagged with the user's goal
    where.tags = { has: userGoal };
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

  // If we found NO courses for the user's specific goal, show ALL published courses as fallback
  if (courses.length === 0 && userGoal && !search && !category && !tag) {
    courses = await prisma.lmsCourse.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: {
        enrollments: { where: { userId } }
      }
    });
  }

  if (saved === 'true') {
    courses = courses.filter(c => c.enrollments[0]?.savedAt);
  }

  // Map progress wrapper
  let mapped = courses.map(course => {
    const enrollment = course.enrollments[0];
    const { enrollments, ...rest } = course;
    return {
      ...rest,
      enrollmentStatus: !!enrollment,
      progressPercent: enrollment ? enrollment.progressPercent : 0,
      isSaved: enrollment ? !!enrollment.savedAt : false,
      isCompleted: enrollment ? !!enrollment.completedAt : false,
      focusReason: focusTopic && rest.tags.includes(focusTopic) ? `Prioritized because it covers your focus area: ${focusTopic}.` : undefined
    };
  });

  if (focusTopic) {
    mapped = mapped.sort((a, b) => {
      // Prioritize focus topic matches
      if (a.focusReason && !b.focusReason) return -1;
      if (!a.focusReason && b.focusReason) return 1;
      return 0;
    });
  }

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
  return {
    ...courseData,
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

  if (!enrollment) {
    enrollment = await prisma.lmsEnrollment.create({
      data: {
        userId,
        courseId,
        startedAt: new Date()
      }
    });
  }
  return enrollment;
}

async function toggleSaveCourse(userId, courseId, saved) {
  let enrollment = await prisma.lmsEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } }
  });

  if (!enrollment) {
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
    enrollment = await enrollUser(userId, courseId);
    enrollment.course = await prisma.lmsCourse.findUnique({ where: { id: courseId } });
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
