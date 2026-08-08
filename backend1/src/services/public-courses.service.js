const { prisma } = require('../lib/prisma');

function formatDuration(estimatedHours, totalLessons) {
  const hours = Number(estimatedHours) || 0;
  if (hours > 0) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours === 1) return '1 hour';
    if (Number.isInteger(hours)) return `${hours} hours`;
    return `${hours} hours`;
  }
  const lessons = Number(totalLessons) || 0;
  if (lessons > 0) return `${lessons} lesson${lessons === 1 ? '' : 's'}`;
  return '';
}

function formatPrice(course) {
  const tokenCost = Number(course.tokenCost) || 0;
  const tier = String(course.accessTier || '').toLowerCase();
  if (tokenCost <= 0 || tier === 'free') return 'Free';
  return `${tokenCost} tokens`;
}

function mapPublicCourse(course) {
  const tokenCost = Number(course.tokenCost) || 0;
  const tier = String(course.accessTier || 'free').toLowerCase();
  const levelRaw = String(course.level || '').trim();
  const skillLevel = levelRaw
    ? levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1).toLowerCase()
    : '';

  return {
    id: course.id,
    title: course.title,
    description: course.description || '',
    category: course.category || '',
    level: course.level || '',
    skillLevel,
    thumbnailUrl: course.thumbnailUrl || null,
    instructorName: course.instructorName || null,
    totalLessons: Number(course.totalLessons) || 0,
    estimatedHours: Number(course.estimatedHours) || 0,
    duration: formatDuration(course.estimatedHours, course.totalLessons),
    price: formatPrice(course),
    tags: Array.isArray(course.tags) ? course.tags.map(String) : [],
    accessTier: tier || 'free',
    tokenCost,
    isCertified: Boolean(course.isCertified) || tier === 'certified',
    isFree: tokenCost <= 0 || tier === 'free',
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

async function listPublishedCourses(filters = {}) {
  const { search, level, category } = filters;
  const where = { isPublished: true };

  if (search) {
    const q = String(search).trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (level) {
    where.level = { equals: String(level).trim(), mode: 'insensitive' };
  }

  if (category) {
    where.category = { equals: String(category).trim(), mode: 'insensitive' };
  }

  const courses = await prisma.lmsCourse.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return courses.map(mapPublicCourse);
}

async function getPublishedCourseById(courseId) {
  const course = await prisma.lmsCourse.findFirst({
    where: { id: String(courseId), isPublished: true },
  });
  if (!course) return null;
  return mapPublicCourse(course);
}

module.exports = {
  listPublishedCourses,
  getPublishedCourseById,
};
