const coursesService = require('../services/courses.service');
const { sendSuccess, sendError, sendNotFound } = require('../lms.response.helper');

async function getCourses(req, res) {
  try {
    const filters = req.query;
    const courses = await coursesService.fetchCourses(req.user.id, filters);
    return sendSuccess(res, courses);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getCourseDetail(req, res) {
  try {
    const course = await coursesService.fetchCourseDetail(req.user.id, req.params.courseId);
    if (!course) return sendNotFound(res, 'Course not found');
    return sendSuccess(res, course);
  } catch (error) {
    return sendError(res, error);
  }
}

async function enrollCourse(req, res) {
  try {
    const result = await coursesService.enrollUser(req.user.id, req.body.courseId);
    if (result.tokenSpend?.tokenBalance != null) {
      res.setHeader('X-Token-Balance', String(result.tokenSpend.tokenBalance));
      res.setHeader('X-Tokens-Spent', String(result.tokenSpend.spent || 0));
    }
    return sendSuccess(
      res,
      {
        ...result.enrollment,
        alreadyEnrolled: result.alreadyEnrolled,
        tokenSpend: result.tokenSpend,
        course: result.course
          ? {
              id: result.course.id,
              title: result.course.title,
              accessTier: result.course.accessTier,
              tokenCost: result.course.tokenCost,
              isCertified: result.course.isCertified,
            }
          : null,
      },
      result.alreadyEnrolled
        ? 'Already enrolled'
        : result.tokenSpend?.spent
          ? `Unlocked with ${result.tokenSpend.spent} tokens`
          : 'Enrolled successfully'
    );
  } catch (error) {
    return sendError(res, error);
  }
}

async function saveCourse(req, res) {
  try {
    const enrollment = await coursesService.toggleSaveCourse(req.user.id, req.body.courseId, req.body.saved);
    return sendSuccess(res, enrollment, req.body.saved ? 'Course saved' : 'Course unsaved');
  } catch (error) {
    return sendError(res, error);
  }
}

async function completeLesson(req, res) {
  try {
    const result = await coursesService.markLessonComplete(req.user.id, req.params.courseId, req.params.lessonId);
    return sendSuccess(res, result, 'Lesson marked complete');
  } catch (error) {
    return sendError(res, error);
  }
}

async function completeCheckpoint(req, res) {
  try {
    const result = await coursesService.completeCheckpoint(req.user.id, req.params.courseId, req.params.checkpointId, {
      file: req.file,
      note: req.body?.note,
    });
    return sendSuccess(res, result, 'Checkpoint completed');
  } catch (error) {
    return sendError(res, error);
  }
}

async function getCertificate(req, res) {
  try {
    const result = await coursesService.fetchCertificateHtml(req.user.id, req.params.courseId);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getCertificatePdf(req, res) {
  try {
    const result = await coursesService.fetchCertificatePdf(req.user.id, req.params.courseId);
    const filename = `certificate-${String(result.certificateId || 'course').replace(/[^\w.-]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Certificate-Id', result.certificateId || '');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    return res.send(result.buffer);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getLessonDetail(req, res) {
  try {
    const lesson = await coursesService.fetchLessonDetail(req.user.id, req.params.courseId, req.params.lessonId);
    return sendSuccess(res, lesson);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getCourses, getCourseDetail, enrollCourse, saveCourse, completeLesson, completeCheckpoint, getCertificate, getCertificatePdf, getLessonDetail };
