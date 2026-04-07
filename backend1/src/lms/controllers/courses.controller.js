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
    const enrollment = await coursesService.enrollUser(req.user.id, req.body.courseId);
    return sendSuccess(res, enrollment, 'Enrolled successfully');
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

async function getLessonDetail(req, res) {
  try {
    const lesson = await coursesService.fetchLessonDetail(req.user.id, req.params.courseId, req.params.lessonId);
    return sendSuccess(res, lesson);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getCourses, getCourseDetail, enrollCourse, saveCourse, completeLesson, getLessonDetail };
