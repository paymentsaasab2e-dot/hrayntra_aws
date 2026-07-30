const { Router } = require('express');
const {
  listPublishedEvents,
  getPublishedEventById,
} = require('../services/public-events.service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const events = await listPublishedEvents({ search: req.query?.search });
    res.json({ success: true, data: { events } });
  } catch (error) {
    console.error('[public-events:list]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load events' });
  }
});

router.get('/:eventId', async (req, res) => {
  try {
    const event = await getPublishedEventById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: { event } });
  } catch (error) {
    console.error('[public-events:detail]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load event' });
  }
});

module.exports = router;
