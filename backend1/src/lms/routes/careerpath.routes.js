const { Router } = require('express');
const { getCareerPath, startMission, addRoadmapItem, updateRoadmapItem, removeRoadmapItem, getPlannedItem, getNextAction, updateCareerPath, setGoal, recommendGoal } = require('../controllers/careerpath.controller');
const { validateAddRoadmap, validateUpdateRoadmap } = require('../validators/careerpath.validator');

const router = Router();

router.get('/', getCareerPath);
router.post('/', updateCareerPath);
router.post('/start', startMission);
router.post('/goal', setGoal);
router.post('/roadmap/add', validateAddRoadmap, addRoadmapItem);
router.put('/roadmap/:itemId', validateUpdateRoadmap, updateRoadmapItem);
router.delete('/roadmap/:itemId', removeRoadmapItem);
router.get('/planned/:itemId', getPlannedItem);
router.get('/next-action', getNextAction);
router.get('/recommend-goal', (req, res, next) => {
  const { recommendGoal } = require('../controllers/careerpath.controller');
  return recommendGoal(req, res, next);
});

module.exports = router;
