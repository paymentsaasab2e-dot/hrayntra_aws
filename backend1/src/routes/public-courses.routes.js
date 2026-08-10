const { Router } = require('express');
const {
  listPublishedCourses,
  getPublishedCourseById,
} = require('../services/public-courses.service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const courses = await listPublishedCourses({
      search: req.query?.search,
      level: req.query?.level,
      category: req.query?.category,
    });
    res.json({ success: true, data: { courses } });
  } catch (error) {
    console.error('[public-courses:list]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load courses' });
  }
});

router.get('/:courseId', async (req, res) => {
  try {
    const course = await getPublishedCourseById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    res.json({ success: true, data: { course } });
  } catch (error) {
    console.error('[public-courses:detail]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load course' });
  }
});

module.exports = router;
