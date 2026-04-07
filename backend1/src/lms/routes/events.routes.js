const { Router } = require('express');
const { getEvents, getEventDetail, registerEvent, unregisterEvent, addToPlan } = require('../controllers/events.controller');
const { validateEventId } = require('../validators/events.validator');

const router = Router();

router.get('/', getEvents);
router.get('/:eventId', getEventDetail);
router.post('/register', validateEventId, registerEvent);
router.post('/unregister', validateEventId, unregisterEvent);
router.post('/:eventId/add-to-plan', addToPlan);

module.exports = router;
