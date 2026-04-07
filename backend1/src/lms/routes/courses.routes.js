const { Router } = require('express');
const { getCourses, getCourseDetail, enrollCourse, saveCourse, completeLesson, getLessonDetail } = require('../controllers/courses.controller');
const { validateEnroll, validateSave } = require('../validators/courses.validator');

const router = Router();

router.get('/', getCourses);
router.get('/:courseId', getCourseDetail);
router.post('/enroll', validateEnroll, enrollCourse);
router.post('/save', validateSave, saveCourse);
router.post('/:courseId/lessons/:lessonId/complete', completeLesson);
router.get('/:courseId/lessons/:lessonId', getLessonDetail);

module.exports = router;
