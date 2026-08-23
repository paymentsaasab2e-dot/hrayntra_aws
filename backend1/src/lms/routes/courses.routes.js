const { Router } = require('express');
const multer = require('multer');
const { getCourses, getCourseDetail, enrollCourse, saveCourse, completeLesson, completeCheckpoint, getCertificate, getCertificatePdf, getLessonDetail } = require('../controllers/courses.controller');
const { validateEnroll, validateSave } = require('../validators/courses.validator');

const assignmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

const router = Router();

router.get('/', getCourses);
router.get('/:courseId', getCourseDetail);
router.post('/enroll', validateEnroll, enrollCourse);
router.post('/save', validateSave, saveCourse);
router.post('/:courseId/lessons/:lessonId/complete', completeLesson);
router.get('/:courseId/lessons/:lessonId', getLessonDetail);
router.get('/:courseId/certificate.pdf', getCertificatePdf);
router.get('/:courseId/certificate', getCertificate);
router.post(
  '/:courseId/checkpoints/:checkpointId/complete',
  assignmentUpload.single('file'),
  completeCheckpoint,
);

module.exports = router;
