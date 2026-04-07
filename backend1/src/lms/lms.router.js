const { Router } = require('express');

const { requireLmsAuth } = require('./middleware/lms.auth.middleware');

const dashboardRoutes = require('./routes/dashboard.routes');
const coursesRoutes = require('./routes/courses.routes');
const quizzesRoutes = require('./routes/quizzes.routes');
const eventsRoutes = require('./routes/events.routes');
const notesRoutes = require('./routes/notes.routes');
const resumeRoutes = require('./routes/resume.routes');
const careerpathRoutes = require('./routes/careerpath.routes');
const interviewRoutes = require('./routes/interview.routes');

const router = Router();

// Dashboard
router.use('/dashboard', requireLmsAuth, dashboardRoutes);
// Courses
router.use('/courses', requireLmsAuth, coursesRoutes);
// Quizzes
router.use('/quizzes', requireLmsAuth, quizzesRoutes);
// Events
router.use('/events', requireLmsAuth, eventsRoutes);
// Notes
router.use('/notes', requireLmsAuth, notesRoutes);
// Resume
router.use('/resume', requireLmsAuth, resumeRoutes);
// Career Path
router.use('/career-path', requireLmsAuth, careerpathRoutes);
// Interview Prep
router.use('/interview', requireLmsAuth, interviewRoutes);

// Exporting lessons for mounting internally if needed or mount alongside courses
// Assuming /api/lms/courses routes will pass some requests to lessons, we can map:
// router.use('/courses/:courseId/lessons', requireLmsAuth, lessonsRoutes);

module.exports = router;
